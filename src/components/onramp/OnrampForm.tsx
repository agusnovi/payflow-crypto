"use client"

import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { CheckCircle, ExternalLink, RefreshCw, XCircle } from "lucide-react"

import { useOnrampQuote } from "@/hooks/useOnrampQuote"
import { SUPPORTED_CHAINS } from "@/lib/chains"
import { formatAmount, formatFiat } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import type { ApiResponse, FiatCurrency, OnrampExecuteResult, TestnetChainId, Transaction } from "@/types"

type CryptoSymbol = "USDC" | "ETH" | "MATIC"

// Testnet chains per crypto (ETH not on Amoy, MATIC only on Amoy)
const CRYPTO_CHAINS: Record<CryptoSymbol, TestnetChainId[]> = {
  USDC:  [11155111, 84532, 421614, 80002],
  ETH:   [11155111, 84532, 421614],
  MATIC: [80002],
}

const FIAT_CURRENCIES: FiatCurrency[] = ["USD", "IDR"]
const CRYPTO_SYMBOLS: CryptoSymbol[] = ["USDC", "ETH", "MATIC"]

// Max $50 USD equivalent to protect testnet treasury
const FIAT_MIN: Record<FiatCurrency, number> = { USD: 10, IDR: 150_000 }
const FIAT_MAX: Record<FiatCurrency, number> = { USD: 50, IDR: 800_000 }

export function OnrampForm() {
  const { address, isConnected } = useAccount()

  const [amountStr, setAmountStr] = useState("")
  const [debouncedAmount, setDebouncedAmount] = useState(0)
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>("USD")
  const [cryptoSymbol, setCryptoSymbol] = useState<CryptoSymbol>("USDC")
  const [chainId, setChainId] = useState<TestnetChainId>(11155111)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [txResult, setTxResult] = useState<OnrampExecuteResult | null>(null)

  // Debounce amount input
  useEffect(() => {
    const timer = setTimeout(() => {
      const n = parseFloat(amountStr.replace(/,/g, ""))
      setDebouncedAmount(isNaN(n) ? 0 : n)
    }, 500)
    return () => clearTimeout(timer)
  }, [amountStr])

  // Auto-switch chain when crypto changes
  useEffect(() => {
    const supported = CRYPTO_CHAINS[cryptoSymbol]
    setChainId((prev) => (supported.includes(prev) ? prev : supported[0]))
  }, [cryptoSymbol])

  // Poll GET /api/transactions/:id every 3s until confirmed/failed
  useEffect(() => {
    if (!txResult || txResult.status !== "pending") return

    const poll = async () => {
      try {
        const res = await fetch(`/api/transactions/${txResult.transactionId}`)
        const json: ApiResponse<Transaction> = await res.json()
        if (json.success && json.data) {
          const s = json.data.status
          if (s === "completed" || s === "failed") {
            setTxResult((prev) =>
              prev ? { ...prev, status: s as "completed" | "failed" } : null
            )
          }
        }
      } catch {
        // ignore transient polling errors
      }
    }

    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [txResult?.transactionId, txResult?.status])

  const min = FIAT_MIN[fiatCurrency]
  const max = FIAT_MAX[fiatCurrency]
  const amountNum = parseFloat(amountStr.replace(/,/g, ""))
  const amountError =
    amountStr !== "" && !isNaN(amountNum)
      ? amountNum < min
        ? `Minimum amount is ${formatFiat(min, fiatCurrency)}`
        : amountNum > max
          ? `Maximum amount is ${formatFiat(max, fiatCurrency)}`
          : null
      : null

  const quoteEnabled = debouncedAmount >= min && debouncedAmount <= max && isConnected

  // ── Quote expiry countdown ────────────────────────────────
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

  useEffect(() => {
    if (!quote) { setSecondsLeft(null); return }
    const update = () => {
      const left = Math.max(0, quote.expiresAt - Math.floor(Date.now() / 1000))
      setSecondsLeft(left)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [quote])

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

  // ── Post-execute states ───────────────────────────────────
  if (txResult) {
    const explorerUrl = `${SUPPORTED_CHAINS[quote!.chainId].blockExplorerUrl}/tx/${txResult.txHash}`

    if (txResult.status === "pending") {
      return (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <Spinner className="h-8 w-8 text-indigo-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Transaction Submitted</h3>
            <p className="mt-1 text-sm text-gray-400">
              Waiting for blockchain confirmation…
            </p>
          </div>
          <div className="w-full rounded-lg border border-gray-800 bg-gray-950 p-3 text-left">
            <p className="text-xs text-gray-500">Tx Hash</p>
            <p className="mt-0.5 truncate font-mono text-xs text-gray-300">{txResult.txHash}</p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <ExternalLink className="h-3 w-3" />
              View on {SUPPORTED_CHAINS[quote!.chainId].name} Explorer
            </a>
          </div>
        </div>
      )
    }

    if (txResult.status === "failed") {
      return (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600/20">
            <XCircle className="h-7 w-7 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Transaction Failed</h3>
            <p className="mt-1 text-sm text-gray-400">
              The on-chain transaction was reverted.
            </p>
          </div>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
          >
            <ExternalLink className="h-3 w-3" />
            View on Explorer
          </a>
          <Button variant="outline" onClick={handleReset} className="w-full">
            Try Again
          </Button>
        </div>
      )
    }

    // completed
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
            </span>{" "}
            on {SUPPORTED_CHAINS[quote!.chainId].name}
          </p>
        </div>
        <div className="w-full rounded-lg border border-gray-800 bg-gray-950 p-3 text-left">
          <p className="text-xs text-gray-500">Transaction ID</p>
          <p className="mt-0.5 font-mono text-xs text-gray-300">{txResult.transactionId}</p>
          <p className="mt-2 text-xs text-gray-500">Tx Hash</p>
          <p className="mt-0.5 truncate font-mono text-xs text-gray-300">{txResult.txHash}</p>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
          >
            <ExternalLink className="h-3 w-3" />
            View on {SUPPORTED_CHAINS[quote!.chainId].name} Explorer
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
          Testnet only — no real funds · max {formatFiat(FIAT_MAX.USD, "USD")} per transaction
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
                placeholder={fiatCurrency === "USD" ? "20" : "300,000"}
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
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {!amountError && (
            <p className="mt-1.5 text-xs text-gray-500">
              Min {formatFiat(min, fiatCurrency)} · Max {formatFiat(max, fiatCurrency)}
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
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={chainId}
              onChange={(e) => setChainId(Number(e.target.value) as TestnetChainId)}
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
              MATIC is only available on Polygon Amoy
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
                : `Enter an amount (min ${formatFiat(min, fiatCurrency)}) to see quote`}
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
                  1 {quote.cryptoSymbol} = {formatFiat(quote.exchangeRate, fiatCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Platform fee</span>
                <span className="text-xs text-gray-300">
                  {formatFiat(quote.platformFee, fiatCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Network fee</span>
                <span className="text-xs text-gray-300">
                  {formatFiat(quote.networkFee, fiatCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-gray-400">Total fee</span>
                <span className="text-xs font-medium text-white">
                  {formatFiat(quote.totalFee, fiatCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Network</span>
                <div className="flex items-center gap-1.5">
                  {quoteFetching && <RefreshCw className="h-3 w-3 animate-spin text-gray-500" />}
                  <span className="text-xs text-gray-500">{quote.provider}</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Quote expires</span>
                {isExpired ? (
                  <button
                    onClick={() => refetchQuote()}
                    disabled={quoteFetching}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${quoteFetching ? "animate-spin" : ""}`} />
                    {quoteFetching ? "Fetching…" : "Recalculate"}
                  </button>
                ) : (
                  <span
                    className={`text-xs font-medium ${
                      secondsLeft !== null && secondsLeft <= 10
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {secondsLeft !== null ? `${secondsLeft}s` : "—"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {executeError && (
          <p className="text-sm text-red-400">{executeError}</p>
        )}

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
                ? "Quote expired — click Recalculate"
                : `Buy ${quote.cryptoAmountFormatted} ${quote.cryptoSymbol}`}
        </Button>
      </div>
    </div>
  )
}
