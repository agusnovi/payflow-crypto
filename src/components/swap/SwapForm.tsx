"use client"

import { useEffect, useState } from "react"
import { useAccount, useConfig, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "@wagmi/core"
import { erc20Abi, encodeFunctionData, parseUnits } from "viem"
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react"

import { useSwapQuote } from "@/hooks/useSwapQuote"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import { SUPPORTED_CHAINS, getTokensByChain } from "@/lib/chains"
import { SWAP_ROUTER_02, WETH9_SEPOLIA, USDC_SEPOLIA, swapRouterAbi } from "@/lib/uniswap"
import { cn } from "@/lib/utils"
import { NATIVE_TOKEN_ADDRESS } from "@/lib/chains"
import { TokenSelector } from "@/components/shared/TokenSelector"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import type { ApiResponse, Token, Transaction } from "@/types"

// ─── Constants ────────────────────────────────────────────

const SEPOLIA_CHAIN_ID = 11155111 as const
const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0]

// Always use Sepolia tokens — swap is Sepolia-only
const SEPOLIA_TOKENS = getTokensByChain(SEPOLIA_CHAIN_ID)

// ─── Types ────────────────────────────────────────────────

type SwapPhase = null | "approving" | "swapping"

interface SwapExecuteResult {
  transactionId: string
  txHash: `0x${string}`
  status: "pending" | "completed" | "failed"
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

function isNativeETH(address: string): boolean {
  return address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
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
  const config = useConfig()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()

  const isSepolia = chainId === SEPOLIA_CHAIN_ID

  const [fromToken, setFromToken] = useState<Token | null>(SEPOLIA_TOKENS[0] ?? null)
  const [toToken, setToToken]     = useState<Token | null>(SEPOLIA_TOKENS[1] ?? null)
  const [amountStr, setAmountStr] = useState("")
  const [slippage, setSlippage]   = useState(0.5)
  const [customSlippage, setCustomSlippage] = useState("")
  const [showSlippage, setShowSlippage]     = useState(false)
  const [secondsLeft, setSecondsLeft]       = useState<number | null>(null)
  const [swapPhase, setSwapPhase]           = useState<SwapPhase>(null)
  const [swapError, setSwapError]           = useState<string | null>(null)
  const [txResult, setTxResult]             = useState<SwapExecuteResult | null>(null)

  // ── Balance of fromToken ──────────────────────────────────
  const { balanceWei: fromBalanceWei, balanceFormatted: fromBalanceFormatted } =
    useTokenBalance(fromToken, address, SEPOLIA_CHAIN_ID)

  // ── USDC allowance for SwapRouter02 ──────────────────────
  const isUSDCFrom = fromToken?.address.toLowerCase() === USDC_SEPOLIA.toLowerCase()

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    abi: erc20Abi,
    address: USDC_SEPOLIA,
    functionName: "allowance",
    args: [address!, SWAP_ROUTER_02],
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: isUSDCFrom && Boolean(address) },
  })

  // ── Wei amount for quote ─────────────────────────────────
  const amountWei = fromToken ? toWei(amountStr, fromToken.decimals) : null

  // ── Quote (always Sepolia) ───────────────────────────────
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
    chainId: SEPOLIA_CHAIN_ID,
    walletAddress: address,
  })

  // ── Expiry countdown ─────────────────────────────────────
  useEffect(() => {
    if (!quote) { setSecondsLeft(null); return }
    const update = () =>
      setSecondsLeft(Math.max(0, quote.expiresAt - Math.floor(Date.now() / 1000)))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [quote])

  const isExpired = secondsLeft === 0

  // ── Poll for confirmation after submit ───────────────────
  useEffect(() => {
    if (!txResult || txResult.status !== "pending") return

    const poll = async () => {
      try {
        const res = await fetch(`/api/transactions/${txResult.transactionId}`)
        const json: ApiResponse<Transaction> = await res.json()
        if (json.success && json.data) {
          const s = json.data.status
          if (s === "completed" || s === "failed") {
            setTxResult((prev) => prev ? { ...prev, status: s as "completed" | "failed" } : null)
          }
        }
      } catch {
        // ignore transient errors
      }
    }

    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [txResult?.transactionId, txResult?.status])

  // ── Validation ───────────────────────────────────────────
  const isSameToken =
    fromToken && toToken &&
    fromToken.address.toLowerCase() === toToken.address.toLowerCase()

  const amountNum = parseFloat(amountStr)
  const amountExceedsBalance =
    Boolean(amountWei) && fromToken
      ? BigInt(amountWei!) > fromBalanceWei
      : false

  const isSwapping = swapPhase !== null

  const canSwap =
    isConnected &&
    isSepolia &&
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
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) setSlippage(parsed)
  }

  // ── Execute: approve (if needed) → swap → save ───────────
  async function handleSwap() {
    if (!quote || !address) return
    setSwapPhase("swapping")
    setSwapError(null)

    try {
      const amountIn = BigInt(quote.fromAmount)
      const minOut   = BigInt(Math.floor(Number(quote.toAmount) * (1 - slippage / 100)))
      const poolFee  = quote.poolFee ?? 3000
      let approveTxHash: `0x${string}` | undefined
      let swapTxHash: `0x${string}`

      // Step 1: Approve USDC allowance if needed
      if (isUSDCFrom) {
        const currentAllowance = usdcAllowance ?? BigInt(0)
        if (currentAllowance < amountIn) {
          setSwapPhase("approving")
          approveTxHash = await writeContractAsync({
            abi: erc20Abi,
            address: USDC_SEPOLIA,
            functionName: "approve",
            args: [SWAP_ROUTER_02, amountIn],
          })
          // Wait for approve to be mined before proceeding
          await waitForTransactionReceipt(config, { hash: approveTxHash })
          await refetchAllowance()
          setSwapPhase("swapping")
        }
      }

      // Step 2: Execute swap
      if (isUSDCFrom) {
        // USDC → ETH: multicall(exactInputSingle → unwrapWETH9)
        // Send WETH to router first, then unwrap to native ETH for recipient
        const exactInputData = encodeFunctionData({
          abi: swapRouterAbi,
          functionName: "exactInputSingle",
          args: [{
            tokenIn:           USDC_SEPOLIA,
            tokenOut:          WETH9_SEPOLIA,
            fee:               poolFee,
            recipient:         SWAP_ROUTER_02, // router holds WETH for unwrapping
            amountIn,
            amountOutMinimum:  minOut,
            sqrtPriceLimitX96: BigInt(0),
          }],
        })
        const unwrapData = encodeFunctionData({
          abi: swapRouterAbi,
          functionName: "unwrapWETH9",
          args: [minOut, address],
        })
        swapTxHash = await writeContractAsync({
          address: SWAP_ROUTER_02,
          abi: swapRouterAbi,
          functionName: "multicall",
          args: [[exactInputData, unwrapData]],
        })
      } else {
        // ETH → USDC: exactInputSingle with msg.value (router auto-wraps to WETH)
        swapTxHash = await writeContractAsync({
          address: SWAP_ROUTER_02,
          abi: swapRouterAbi,
          functionName: "exactInputSingle",
          args: [{
            tokenIn:           WETH9_SEPOLIA,
            tokenOut:          USDC_SEPOLIA,
            fee:               poolFee,
            recipient:         address,
            amountIn,
            amountOutMinimum:  minOut,
            sqrtPriceLimitX96: BigInt(0),
          }],
          value: amountIn,
        })
      }

      // Step 3: Save to DB (server only records — no server-side execution)
      const res = await fetch("/api/swap/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromToken: quote.fromToken.address,
          toToken: quote.toToken.address,
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          chainId: SEPOLIA_CHAIN_ID,
          walletAddress: address,
          txHash: swapTxHash,
          ...(approveTxHash ? { approveTxHash } : {}),
        }),
      })

      const json: ApiResponse<SwapExecuteResult> = await res.json()
      if (!json.success || !json.data) throw new Error(json.error ?? "Swap failed")

      setTxResult({ transactionId: json.data.transactionId, txHash: swapTxHash, status: "pending" })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Swap failed"
      setSwapError(/user rejected|denied|cancelled/i.test(msg) ? "Transaction cancelled." : msg)
    } finally {
      setSwapPhase(null)
    }
  }

  function handleReset() {
    setTxResult(null)
    setAmountStr("")
    setSwapError(null)
  }

  // ── Post-submit states ────────────────────────────────────
  if (txResult && quote) {
    const explorerUrl = `${SUPPORTED_CHAINS[SEPOLIA_CHAIN_ID].blockExplorerUrl}/tx/${txResult.txHash}`

    if (txResult.status === "pending") {
      return (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <Spinner className="h-8 w-8 text-indigo-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Swap Submitted</h3>
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
              View on Sepolia Explorer
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
            <h3 className="text-lg font-semibold text-white">Swap Failed</h3>
            <p className="mt-1 text-sm text-gray-400">The transaction was reverted on-chain.</p>
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
          <Button variant="outline" onClick={handleReset} className="w-full">Try Again</Button>
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
          <h3 className="text-lg font-semibold text-white">Swap Successful</h3>
          <p className="mt-1 text-sm text-gray-400">
            {quote.toAmountFormatted} {quote.toToken.symbol} arrived in your wallet
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
            View on Sepolia Explorer
          </a>
        </div>
        <Button variant="outline" onClick={handleReset} className="w-full">New Swap</Button>
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
          <p className="mt-0.5 text-xs text-gray-500">
            Uniswap V3 · Sepolia testnet · ETH ↔ USDC
          </p>
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
                tokens={SEPOLIA_TOKENS}
                selectedToken={fromToken}
                onChange={(t) => {
                  if (t.address === toToken?.address) setToToken(fromToken)
                  setFromToken(t)
                  setAmountStr("")
                }}
                chainId={SEPOLIA_CHAIN_ID}
              />
            </div>
          </div>
          {amountExceedsBalance && (
            <p className="mt-1.5 text-xs text-red-400">Insufficient balance</p>
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
                <p className="text-2xl font-semibold text-white">{quote.toAmountFormatted}</p>
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
                tokens={SEPOLIA_TOKENS}
                selectedToken={toToken}
                onChange={(t) => {
                  if (t.address === fromToken?.address) setFromToken(toToken)
                  setToToken(t)
                }}
                chainId={SEPOLIA_CHAIN_ID}
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
                Calculating quote…
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
                    {(parseFloat(quote.toAmountFormatted) / parseFloat(amountStr || "1"))
                      .toFixed(6)
                      .replace(/\.?0+$/, "")}{" "}
                    {quote.toToken.symbol}
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-gray-500">Price impact</span>
                  <PriceImpactBadge impact={quote.priceImpact} />
                </div>

                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-gray-500">Pool fee</span>
                  <span className="text-gray-300">
                    {quote.poolFee ? `${quote.poolFee / 10000}%` : "0.3%"}
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-gray-500">Route</span>
                  <span className="text-gray-300">
                    {quote.route.map((r) => r.protocol).join(" · ")}
                  </span>
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

                {/* USDC allowance indicator */}
                {isUSDCFrom && usdcAllowance !== undefined && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-gray-500">Approval needed</span>
                    <span className={usdcAllowance < BigInt(quote.fromAmount) ? "text-yellow-400" : "text-green-400"}>
                      {usdcAllowance < BigInt(quote.fromAmount) ? "Yes (step 1/2)" : "No"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Execute error */}
        {swapError && (
          <p className="text-sm text-red-400">{swapError}</p>
        )}

        {/* Swap / Switch Network button */}
        {isConnected && !isSepolia ? (
          <Button
            size="lg"
            className="w-full"
            onClick={() => switchChainAsync({ chainId: SEPOLIA_CHAIN_ID })}
          >
            Switch to Sepolia to Swap
          </Button>
        ) : (
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
                          : swapPhase === "approving"
                            ? "Approving USDC… (1/2)"
                            : swapPhase === "swapping"
                              ? "Swapping… (2/2)"
                              : isUSDCFrom && usdcAllowance !== undefined && usdcAllowance < BigInt(quote.fromAmount)
                                ? `Approve + Swap ${amountStr} ${fromToken.symbol}`
                                : `Swap ${amountStr} ${fromToken.symbol} → ${quote.toAmountFormatted} ${toToken.symbol}`}
          </Button>
        )}
      </div>
    </div>
  )
}
