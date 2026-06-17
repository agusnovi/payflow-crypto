import { formatUnits } from "viem"
import { getTokenByAddress } from "@/lib/chains"
import type { ChainId, SwapQuote, SwapRouteStep } from "@/types"

// ─── 1inch internal response types ────────────────────────
// v6 /quote only returns dstAmount, protocols, and gas — no token objects

interface OneInchProtocolStep {
  name: string
  part: number
  fromTokenAddress: string
  toTokenAddress: string
}

interface OneInchQuoteResponse {
  dstAmount: string
  protocols: OneInchProtocolStep[][][]
  gas: number
}

interface OneInchErrorResponse {
  error: string
  description?: string
  statusCode?: number
  requestId?: string
}

// ─── Params ───────────────────────────────────────────────

export interface SwapQuoteParams {
  fromTokenAddress: string
  toTokenAddress: string
  amount: string       // in wei
  chainId: ChainId
  walletAddress?: string
}

// ─── Client ───────────────────────────────────────────────

const BASE_URL = "https://api.1inch.dev/swap/v6.0"
const QUOTE_EXPIRY_SECONDS = 30

function buildQuoteUrl(chainId: ChainId, params: SwapQuoteParams): string {
  const search = new URLSearchParams({
    src: params.fromTokenAddress,
    dst: params.toTokenAddress,
    amount: params.amount,
    ...(params.walletAddress ? { walletAddress: params.walletAddress } : {}),
    includeProtocols: "true",
    includeGas: "true",
  })
  return `${BASE_URL}/${chainId}/quote?${search.toString()}`
}

function flattenProtocols(protocols: OneInchProtocolStep[][][]): SwapRouteStep[] {
  // 1inch returns a 3D array: paths > hops > splits
  // Flatten to a single list, summing portions per protocol name
  const totals = new Map<string, number>()
  for (const path of protocols) {
    for (const hop of path) {
      for (const split of hop) {
        totals.set(split.name, (totals.get(split.name) ?? 0) + split.part)
      }
    }
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0) || 1
  return [...totals.entries()].map(([protocol, part]) => ({
    protocol,
    portion: Math.round((part / total) * 100),
  }))
}

export async function getSwapQuote(params: SwapQuoteParams): Promise<SwapQuote> {
  const apiKey = process.env.ONEINCH_API_KEY
  if (!apiKey) throw new Error("ONEINCH_API_KEY is not configured")

  const url = buildQuoteUrl(params.chainId, params)

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    // No cache — quotes are time-sensitive
    cache: "no-store",
  })

  if (!res.ok) {
    let message = `1inch API error: ${res.status}`
    try {
      const err = (await res.json()) as OneInchErrorResponse
      message = err.description ?? err.error ?? message
    } catch {
      // ignore JSON parse failure, keep default message
    }
    throw new Error(message)
  }

  const data = (await res.json()) as OneInchQuoteResponse

  // Look up token metadata from our COMMON_TOKENS config
  const fromToken = getTokenByAddress(params.chainId, params.fromTokenAddress)
  const toToken   = getTokenByAddress(params.chainId, params.toTokenAddress)

  if (!fromToken) throw new Error(`Token not supported: ${params.fromTokenAddress}`)
  if (!toToken)   throw new Error(`Token not supported: ${params.toTokenAddress}`)

  const toAmountFormatted = parseFloat(
    formatUnits(BigInt(data.dstAmount), toToken.decimals)
  ).toFixed(6).replace(/\.?0+$/, "")

  const route = flattenProtocols(data.protocols)

  return {
    fromToken,
    toToken,
    fromAmount: params.amount,
    toAmount: data.dstAmount,
    toAmountFormatted,
    priceImpact: 0,
    fee: 0,
    estimatedGasUSD: data.gas.toString(),
    route,
    expiresAt: Math.floor(Date.now() / 1000) + QUOTE_EXPIRY_SECONDS,
  }
}
