"use client"

import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { CheckCircle, ExternalLink, RefreshCw } from "lucide-react"

import { useOnrampQuote } from "@/hooks/useOnrampQuote"
import { SUPPORTED_CHAINS } from "@/lib/chains"
import { formatAmount } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import type { ApiResponse, ChainId, FiatCurrency, OnrampExecuteResult } from "@/types"

type CryptoSymbol = "USDC" | "ETH" | "MATIC"

// Which chains support each crypto for onramp
const CRYPTO_CHAINS: Record<CryptoSymbol, ChainId[]> = {
  USDC:  [1, 137, 8453, 42161],
  ETH:   [1, 8453, 42161],
  MATIC: [137],
}

const FIAT_CURRENCIES: FiatCurrency[] = ["USD", "IDR"]
const CRYPTO_SYMBOLS: CryptoSymbol[] = ["USDC", "ETH", "MATIC"]

const FIAT_MIN: Record<FiatCurrency, number> = { USD: 10, IDR: 150_000 }
const FIAT_MAX: Record<FiatCurrency, number> = { USD: 10_000, IDR: 150_000_000 }

function fiatLabel(currency: FiatCurrency, amount: number): string {
  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`
  }
  return `$${amount.toLocaleString("en-US")}`
}

export function OnrampForm() {
  const { address, isConnected } = useAccount()

  const [amountStr, setAmountStr] = useState("")
  const [debouncedAmount, setDebouncedAmount] = useState(0)
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>("USD")
  const [cryptoSymbol, setCryptoSymbol] = useState<CryptoSymbol>("USDC")
  const [chainId, setChainId] = useState<ChainId>(1)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [txResult, setTxResult] = useState<OnrampExecuteResult | null>(null)

  // Debounce amount input — avoids API call on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      const n = parseFloat(amountStr.replace(/,/g, ""))
      setDebouncedAmount(isNaN(n) ? 0 : n)
    }, 500)
    return () => clearTimeout(timer)
  }, [amountStr])

  // Auto-switch chain when selected crypto doesn't support current chain
  useEffect(() => {
    const supported = CRYPTO_CHAINS[cryptoSymbol]
    setChainId((prev) => (supported.includes(prev) ? prev : supported[0]))
  }, [cryptoSymbol])

  const min = FIAT_MIN[fiatCurrency]
  const max = FIAT_MAX[fiatCurrency]
  const amountNum = parseFloat(amountStr.replace(/,/g, ""))
  const amountError =
    amountStr !== "" && !isNaN(amountNum)
      ? amountNum < min
        ? `Minimum amount is ${fiatLabel(fiatCurrency, min)}`
        : amountNum > max
          ? `Maximum amount is ${fiatLabel(fiatCurrency, max)}`
          : null
      : null

  const quoteEnabled = debouncedAmount >= min && debouncedAmount <= max && isConnected

  // ── Quote expiry countdown ───────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  const {
    data: quote,
    isLoading: quoteLoading,
    isFetching: quoteFetching,
    error: quoteError,
    refetch: refetchQuote,
  } = useOnrampQuote({
    fiatAmount: debouncedAmount,
    fiatCurrency,
    cryptoSymbol,
    chainId,
    walletAddress: address ?? "",
  })

  // Tick down secondsLeft every second when quote is available
  useEffect(() => {
    if (!quote) { setSecondsLeft(null); return }
    const update = () => {
      const left = Math.max(0, quote.expiresAt - Math.floor(Date.now() / 1000))
      setSecondsLeft(left)
      if (left === 0) refetchQuote()
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [quote, refetchQuote])

  const isExpired = secondsLeft !== null && secondsLeft === 0

  async function handleConfirm() {
    if (!quote || !address) return
    setIsExecuting(true)
    setExecuteError(null)

    try {
      const res = await fetch("/api/onramp/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiatAmount: quote.fiatAmount,
          fiatCurrency: quote.fiatCurrency,
          cryptoAmount: quote.cryptoAmount,
          cryptoSymbol: quote.cryptoSymbol,
          chainId: quote.chainId,
          walletAddress: address,
          expiresAt: quote.expiresAt,
        }),
      })

      const json: ApiResponse<OnrampExecuteResult> = await res.json()
      if (!json.success || !json.data) throw new Error(json.error ?? "Transaction failed")
      setTxResult(json.data)
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : "Transaction failed. Please try again.")
    } finally {
      setIsExecuting(false)
    }
  }

  function handleReset() {
    setTxResult(null)
    setAmountStr("")
    setDebouncedAmount(0)
    setExecuteError(null)
  }

  // ── Success state ────────────────────────────────────────
  if (txResult) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600/20">
          <CheckCircle className="h-7 w-7 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Purchase Successful</h3>
          <p className="mt-1 text-sm text-gray-400">
            You received{" "}
            <span className="font-medium text-white">
              {formatAmount(quote!.cryptoAmount, quote!.cryptoSymbol === "USDC" ? 6 : 18)}{" "}
              {quote!.cryptoSymbol}
            </span>
          </p>
        </div>
        <div className="w-full rounded-lg border border-gray-800 bg-gray-950 p-3 text-left">
          <p className="text-xs text-gray-500">Transaction ID</p>
          <p className="mt-0.5 font-mono text-xs text-gray-300">{txResult.transactionId}</p>
          <p className="mt-2 text-xs text-gray-500">Tx Hash</p>
          <p className="mt-0.5 truncate font-mono text-xs text-gray-300">{txResult.txHash}</p>
          <a
            href={`${SUPPORTED_CHAINS[quote!.chainId].blockExplorerUrl}/tx/${txResult.txHash}`}
            onClick={(e) => e.preventDefault()}
            tabIndex={-1}
            aria-disabled="true"
            title="Simulated — not on-chain"
            className="mt-1.5 inline-flex cursor-not-allowed items-center gap-1 text-xs text-gray-600"
          >
            <ExternalLink className="h-3 w-3" />
            View on Explorer
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-500">
              Simulated
            </span>
          </a>
        </div>
        <Button variant="outline" onClick={handleReset} className="w-full">
          Buy More
        </Button>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────
  const supportedChains = CRYPTO_CHAINS[cryptoSymbol]

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      <div className="border-b border-gray-800 px-6 py-4">
        <h2 className="text-base font-semibold text-white">Buy Crypto</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Simulated — no real funds will be charged
        </p>
      </div>

      <div className="space-y-5 p-6">
        {/* Fiat amount + currency */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-300">You pay</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="fiat-amount"
                type="number"
                placeholder={fiatCurrency === "USD" ? "100" : "1,500,000"}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                error={amountError ?? undefined}
                min={min}
                max={max}
              />
            </div>
            <select
              value={fiatCurrency}
              onChange={(e) => {
                setFiatCurrency(e.target.value as FiatCurrency)
                setAmountStr("")
                setDebouncedAmount(0)
              }}
              className="h-10 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FIAT_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {!amountError && (
            <p className="mt-1.5 text-xs text-gray-500">
              Min {fiatLabel(fiatCurrency, min)} · Max {fiatLabel(fiatCurrency, max)}
            </p>
          )}
        </div>

        {/* Crypto + chain selectors */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-300">You receive</p>
          <div className="flex gap-2">
            <select
              value={cryptoSymbol}
              onChange={(e) => setCryptoSymbol(e.target.value as CryptoSymbol)}
              className="h-10 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CRYPTO_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={chainId}
              onChange={(e) => setChainId(Number(e.target.value) as ChainId)}
              className="h-10 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {supportedChains.map((id) => (
                <option key={id} value={id}>
                  {SUPPORTED_CHAINS[id].name}
                </option>
              ))}
            </select>
          </div>
          {cryptoSymbol === "MATIC" && (
            <p className="mt-1.5 text-xs text-gray-500">
              MATIC is only available on Polygon
            </p>
          )}
        </div>

        {/* Quote panel */}
        <div className="rounded-lg border border-gray-800 bg-gray-950">
          {quoteLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <Spinner className="h-4 w-4" />
              Fetching quote…
            </div>
          )}

          {!quoteLoading && quoteError && quoteEnabled && (
            <div className="py-4 text-center text-sm text-red-400">
              {quoteError instanceof Error ? quoteError.message : "Failed to fetch quote"}
            </div>
          )}

          {!quoteLoading && !quoteEnabled && (
            <div className="py-4 text-center text-sm text-gray-500">
              {!isConnected
                ? "Connect wallet to see quote"
                : `Enter an amount (min ${fiatLabel(fiatCurrency, min)}) to see quote`}
            </div>
          )}

          {!quoteLoading && quote && quoteEnabled && (
            <div className="divide-y divide-gray-800">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-400">You receive</span>
                <span className="text-sm font-semibold text-white">
                  {quote.cryptoAmountFormatted} {quote.cryptoSymbol}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Exchange rate</span>
                <span className="text-xs text-gray-300">
                  1 {quote.cryptoSymbol} ={" "}
                  {fiatLabel(fiatCurrency, quote.exchangeRate)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Platform fee</span>
                <span className="text-xs text-gray-300">
                  {fiatLabel(fiatCurrency, quote.platformFee)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Network fee</span>
                <span className="text-xs text-gray-300">
                  {fiatLabel(fiatCurrency, quote.networkFee)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-gray-400">Total fee</span>
                <span className="text-xs font-medium text-white">
                  {fiatLabel(fiatCurrency, quote.totalFee)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Provider</span>
                <div className="flex items-center gap-1.5">
                  {quoteFetching && <RefreshCw className="h-3 w-3 animate-spin text-gray-500" />}
                  <span className="text-xs text-gray-500">{quote.provider}</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Quote expires</span>
                <span className={`text-xs font-medium ${
                  secondsLeft !== null && secondsLeft <= 10
                    ? "text-red-400"
                    : "text-gray-400"
                }`}>
                  {isExpired
                    ? "Refreshing…"
                    : secondsLeft !== null
                      ? `${secondsLeft}s`
                      : "—"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Error from execute */}
        {executeError && (
          <p className="text-sm text-red-400">{executeError}</p>
        )}

        {/* Confirm button */}
        <Button
          size="lg"
          className="w-full"
          disabled={!quote || !isConnected || !!amountError || isExpired}
          loading={isExecuting}
          onClick={handleConfirm}
        >
          {!isConnected
            ? "Connect wallet first"
            : !quote
              ? "Enter amount to continue"
              : isExpired
                ? "Quote expired — refreshing…"
                : `Buy ${quote.cryptoAmountFormatted} ${quote.cryptoSymbol}`}
        </Button>
      </div>
    </div>
  )
}
