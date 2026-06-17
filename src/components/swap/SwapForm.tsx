"use client"

import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { parseUnits } from "viem"
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Settings,
} from "lucide-react"

import { useSwapQuote } from "@/hooks/useSwapQuote"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import { SUPPORTED_CHAINS, getTokensByChain, isValidChainId } from "@/lib/chains"
import { cn } from "@/lib/utils"
import { TokenSelector } from "@/components/shared/TokenSelector"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import type { ApiResponse, ChainId, Token } from "@/types"

// ─── Constants ────────────────────────────────────────────

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0]

interface SwapExecuteResult {
  transactionId: string
  txHash: string
}

// ─── Helpers ──────────────────────────────────────────────

function toWei(amount: string, decimals: number): string | null {
  try {
    if (!amount || amount === "0" || amount === ".") return null
    return parseUnits(amount as `${number}`, decimals).toString()
  } catch {
    return null
  }
}

function PriceImpactBadge({ impact }: { impact: number }) {
  if (impact <= 0) return null
  const isHigh = impact >= 3
  const isMedium = impact >= 1
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isHigh
          ? "bg-red-600/20 text-red-400"
          : isMedium
            ? "bg-yellow-600/20 text-yellow-400"
            : "bg-gray-700 text-gray-400"
      )}
    >
      {(isHigh || isMedium) && <AlertTriangle className="h-3 w-3" />}
      {impact.toFixed(2)}%
    </span>
  )
}

// ─── Component ────────────────────────────────────────────

export function SwapForm() {
  const { address, chainId, isConnected } = useAccount()

  const currentChainId: ChainId = chainId && isValidChainId(chainId) ? chainId : 1
  const tokens = getTokensByChain(currentChainId)

  const [fromToken, setFromToken] = useState<Token | null>(tokens[0] ?? null)
  const [toToken, setToToken]     = useState<Token | null>(tokens[1] ?? null)
  const [amountStr, setAmountStr] = useState("")
  const [slippage, setSlippage]   = useState(0.5)
  const [customSlippage, setCustomSlippage] = useState("")
  const [showSlippage, setShowSlippage]     = useState(false)
  const [secondsLeft, setSecondsLeft]       = useState<number | null>(null)
  const [isSwapping, setIsSwapping]         = useState(false)
  const [swapError, setSwapError]           = useState<string | null>(null)
  const [txResult, setTxResult]             = useState<SwapExecuteResult | null>(null)

  // Reset token list when chain changes
  useEffect(() => {
    const list = getTokensByChain(currentChainId)
    setFromToken(list[0] ?? null)
    setToToken(list[1] ?? null)
    setAmountStr("")
  }, [currentChainId])

  // ── Balance of the selected fromToken ───────────────────
  const { balanceWei: fromBalanceWei, balanceFormatted: fromBalanceFormatted } =
    useTokenBalance(fromToken, address, currentChainId)

  // ── Wei amount for quote ─────────────────────────────────
  const amountWei = fromToken ? toWei(amountStr, fromToken.decimals) : null

  // ── Quote ────────────────────────────────────────────────
  const {
    data: quote,
    isLoading: quoteLoading,
    isFetching: quoteFetching,
    error: quoteError,
    refetch: refetchQuote,
  } = useSwapQuote({
    fromTokenAddress: fromToken?.address ?? "",
    toTokenAddress: toToken?.address ?? "",
    amount: amountWei ?? "0",
    chainId: currentChainId,
    walletAddress: address,
  })

  // ── Expiry countdown ─────────────────────────────────────
  useEffect(() => {
    if (!quote) { setSecondsLeft(null); return }
    const update = () => {
      setSecondsLeft(Math.max(0, quote.expiresAt - Math.floor(Date.now() / 1000)))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [quote])

  const isExpired = secondsLeft === 0

  // ── Validation ───────────────────────────────────────────
  const isSameToken =
    fromToken && toToken &&
    fromToken.address.toLowerCase() === toToken.address.toLowerCase()

  const amountNum = parseFloat(amountStr)
  const amountExceedsBalance =
    Boolean(amountWei) && fromToken
      ? BigInt(amountWei!) > fromBalanceWei
      : false

  const canSwap =
    isConnected &&
    Boolean(quote) &&
    !isExpired &&
    !isSameToken &&
    !amountExceedsBalance &&
    !isSwapping

  // ── Switch tokens ─────────────────────────────────────────
  function handleSwitch() {
    setFromToken(toToken)
    setToToken(fromToken)
  }

  // ── Slippage ──────────────────────────────────────────────
  function handleSlippagePreset(value: number) {
    setSlippage(value)
    setCustomSlippage("")
  }

  function handleCustomSlippage(raw: string) {
    setCustomSlippage(raw)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      setSlippage(parsed)
    }
  }

  // ── Execute ──────────────────────────────────────────────
  async function handleSwap() {
    if (!quote || !address) return
    setIsSwapping(true)
    setSwapError(null)

    try {
      const res = await fetch("/api/swap/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromToken: quote.fromToken.address,
          toToken: quote.toToken.address,
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          chainId: currentChainId,
          walletAddress: address,
          slippage,
          expiresAt: quote.expiresAt,
        }),
      })

      const json: ApiResponse<SwapExecuteResult> = await res.json()
      if (!json.success || !json.data) throw new Error(json.error ?? "Swap failed")
      setTxResult(json.data)
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : "Swap failed. Please try again.")
    } finally {
      setIsSwapping(false)
    }
  }

  function handleReset() {
    setTxResult(null)
    setAmountStr("")
    setSwapError(null)
  }

  // ── Success state ────────────────────────────────────────
  if (txResult && quote) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600/20">
          <CheckCircle className="h-7 w-7 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Swap Submitted</h3>
          <p className="mt-1 text-sm text-gray-400">
            {quote.toAmountFormatted} {quote.toToken.symbol} will arrive in your wallet
          </p>
        </div>
        <div className="w-full rounded-lg border border-gray-800 bg-gray-950 p-3 text-left">
          <p className="text-xs text-gray-500">Transaction ID</p>
          <p className="mt-0.5 font-mono text-xs text-gray-300">{txResult.transactionId}</p>
          <p className="mt-2 text-xs text-gray-500">Tx Hash</p>
          <p className="mt-0.5 truncate font-mono text-xs text-gray-300">{txResult.txHash}</p>
          <a
            href={`${SUPPORTED_CHAINS[currentChainId].blockExplorerUrl}/tx/${txResult.txHash}`}
            onClick={(e) => e.preventDefault()}
            tabIndex={-1}
            aria-disabled="true"
            title="Simulated — not on-chain"
            className="mt-1.5 inline-flex cursor-not-allowed items-center gap-1 text-xs text-gray-600"
          >
            <ExternalLink className="h-3 w-3" />
            View on Explorer
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-500">Simulated</span>
          </a>
        </div>
        <Button variant="outline" onClick={handleReset} className="w-full">
          New Swap
        </Button>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────
  const quoteEnabled = Boolean(amountWei) && !isSameToken && Boolean(fromToken) && Boolean(toToken)

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">Swap</h2>
          <p className="mt-0.5 text-xs text-gray-500">Simulated — powered by 1inch quotes</p>
        </div>
        <button
          onClick={() => setShowSlippage((v) => !v)}
          className={cn(
            "rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white",
            showSlippage && "bg-gray-800 text-white"
          )}
          title="Slippage settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Slippage panel */}
      {showSlippage && (
        <div className="border-b border-gray-800 bg-gray-950 px-6 py-3">
          <p className="mb-2 text-xs font-medium text-gray-400">Max slippage</p>
          <div className="flex items-center gap-2">
            {SLIPPAGE_PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => handleSlippagePreset(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  slippage === v && !customSlippage
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                )}
              >
                {v}%
              </button>
            ))}
            <div className="relative ml-1 flex items-center">
              <input
                type="number"
                min="0.01"
                max="50"
                step="0.1"
                placeholder="Custom"
                value={customSlippage}
                onChange={(e) => handleCustomSlippage(e.target.value)}
                className="h-7 w-20 rounded-md border border-gray-700 bg-gray-800 pl-2 pr-5 text-xs text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />
              <span className="pointer-events-none absolute right-2 text-xs text-gray-500">%</span>
            </div>
            <span className="ml-1 text-xs text-gray-500">Current: {slippage}%</span>
          </div>
        </div>
      )}

      <div className="space-y-3 p-6">
        {/* From token */}
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-400">You pay</p>
            {isConnected && fromToken && (
              <button
                className="text-xs text-gray-500 hover:text-indigo-400"
                onClick={() => {
                  if (fromBalanceFormatted !== "0") setAmountStr(fromBalanceFormatted)
                }}
              >
                Balance: {fromBalanceFormatted} {fromToken.symbol}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-white placeholder-gray-700 focus:outline-none"
            />
            <div className="w-40 shrink-0">
              <TokenSelector
                tokens={tokens}
                selectedToken={fromToken}
                onChange={(t) => {
                  if (t.address === toToken?.address) setToToken(fromToken)
                  setFromToken(t)
                  setAmountStr("")
                }}
                chainId={currentChainId}
              />
            </div>
          </div>
          {amountExceedsBalance && (
            <p className="mt-1.5 text-xs text-red-400">
              Insufficient balance
            </p>
          )}
        </div>

        {/* Switch button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwitch}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-gray-400 transition-colors hover:border-indigo-500 hover:text-indigo-400"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>

        {/* To token */}
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <p className="mb-2 text-xs font-medium text-gray-400">You receive</p>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {quote && !isExpired ? (
                <p className="text-2xl font-semibold text-white">
                  {quote.toAmountFormatted}
                </p>
              ) : quoteLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm">Fetching quote…</span>
                </div>
              ) : (
                <p className="text-2xl font-semibold text-gray-700">0</p>
              )}
            </div>
            <div className="w-40 shrink-0">
              <TokenSelector
                tokens={tokens}
                selectedToken={toToken}
                onChange={(t) => {
                  if (t.address === fromToken?.address) setFromToken(toToken)
                  setToToken(t)
                }}
                chainId={currentChainId}
              />
            </div>
          </div>
        </div>

        {/* Same token warning */}
        {isSameToken && (
          <p className="text-center text-sm text-red-400">Select different tokens</p>
        )}

        {/* Quote panel */}
        {quoteEnabled && (
          <div className="rounded-lg border border-gray-800 bg-gray-950 text-xs">
            {quoteLoading && !quote && (
              <div className="flex items-center justify-center gap-2 py-5 text-gray-400">
                <Spinner className="h-4 w-4" />
                Calculating best route…
              </div>
            )}

            {!quoteLoading && quoteError && (
              <p className="py-4 text-center text-red-400">
                {quoteError instanceof Error ? quoteError.message : "Failed to fetch quote"}
              </p>
            )}

            {quote && (
              <div className="divide-y divide-gray-800">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-gray-500">Rate</span>
                  <span className="text-gray-300">
                    1 {quote.fromToken.symbol} ={" "}
                    {(
                      parseFloat(quote.toAmountFormatted) /
                      parseFloat(
                        amountStr || "1"
                      )
                    ).toFixed(6).replace(/\.?0+$/, "")}{" "}
                    {quote.toToken.symbol}
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-gray-500">Price impact</span>
                  <PriceImpactBadge impact={quote.priceImpact} />
                </div>

                {quote.priceImpact >= 3 && (
                  <div className="flex items-start gap-2 bg-red-900/20 px-4 py-2.5 text-red-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>High price impact — you may receive significantly less than expected.</span>
                  </div>
                )}

                {quote.priceImpact >= 1 && quote.priceImpact < 3 && (
                  <div className="flex items-start gap-2 bg-yellow-900/20 px-4 py-2.5 text-yellow-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Moderate price impact.</span>
                  </div>
                )}

                {quote.route.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-gray-500">Route</span>
                    <span className="text-gray-300">
                      {quote.route
                        .slice(0, 3)
                        .map((r) => `${r.protocol} ${r.portion}%`)
                        .join(" · ")}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-gray-500">Est. gas</span>
                  <span className="text-gray-300">~{parseInt(quote.estimatedGasUSD).toLocaleString()} units</span>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-gray-500">Quote expires</span>
                  {isExpired ? (
                    <button
                      onClick={() => refetchQuote()}
                      disabled={quoteFetching}
                      className="flex items-center gap-1 font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                    >
                      <RefreshCw className={cn("h-3 w-3", quoteFetching && "animate-spin")} />
                      {quoteFetching ? "Fetching…" : "Recalculate"}
                    </button>
                  ) : (
                    <span className={cn(
                      "font-medium",
                      secondsLeft !== null && secondsLeft <= 5 ? "text-red-400" : "text-gray-400"
                    )}>
                      {secondsLeft !== null ? `${secondsLeft}s` : "—"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Execute error */}
        {swapError && (
          <p className="text-sm text-red-400">{swapError}</p>
        )}

        {/* Swap button */}
        <Button
          size="lg"
          className="w-full"
          disabled={!canSwap}
          loading={isSwapping}
          onClick={handleSwap}
        >
          {!isConnected
            ? "Connect wallet to swap"
            : !fromToken || !toToken
              ? "Select tokens"
              : isSameToken
                ? "Select different tokens"
                : !amountStr || amountNum <= 0
                  ? "Enter an amount"
                  : amountExceedsBalance
                    ? `Insufficient ${fromToken.symbol} balance`
                    : isExpired
                      ? "Quote expired — click Recalculate"
                      : !quote
                        ? "Fetching quote…"
                        : `Swap ${amountStr} ${fromToken.symbol} → ${quote.toAmountFormatted} ${toToken.symbol}`}
        </Button>
      </div>
    </div>
  )
}
