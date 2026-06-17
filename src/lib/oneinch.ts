import { formatUnits } from "viem"
import type { ChainId, SwapQuote, SwapRouteStep } from "@/types"

// ─── 1inch internal response types ────────────────────────

interface OneInchToken {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

interface OneInchProtocolStep {
  name: string
  part: number
  fromTokenAddress: string
  toTokenAddress: string
}

interface OneInchQuoteResponse {
  dstAmount: string
  srcToken: OneInchToken
  dstToken: OneInchToken
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

function estimatePriceImpact(
  srcToken: OneInchToken,
  dstToken: OneInchToken,
  fromAmountWei: string,
  toAmountWei: string,
): number {
  // Approximation: compare ratio to expected 1:1 in USD terms is not possible
  // without price data here. Return 0 — the API route will enrich this with
  // CoinGecko prices if needed. Actual price impact from 1inch is not in the
  // quote endpoint; it requires the /price endpoint for spot comparison.
  void srcToken; void dstToken; void fromAmountWei; void toAmountWei
  return 0
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

  const toAmountFormatted = parseFloat(
    formatUnits(BigInt(data.dstAmount), data.dstToken.decimals)
  ).toFixed(6).replace(/\.?0+$/, "")

  const route = flattenProtocols(data.protocols)

  // Gas cost: 1inch returns gas units; convert to USD requires gas price + ETH price.
  // We store gas units as a string — the API route layer can convert to USD if needed.
  const estimatedGasUSD = data.gas.toString()

  return {
    fromToken: {
      address: data.srcToken.address as `0x${string}`,
      symbol: data.srcToken.symbol,
      name: data.srcToken.name,
      decimals: data.srcToken.decimals,
      chainId: params.chainId,
    },
    toToken: {
      address: data.dstToken.address as `0x${string}`,
      symbol: data.dstToken.symbol,
      name: data.dstToken.name,
      decimals: data.dstToken.decimals,
      chainId: params.chainId,
    },
    fromAmount: params.amount,
    toAmount: data.dstAmount,
    toAmountFormatted,
    priceImpact: estimatePriceImpact(
      data.srcToken,
      data.dstToken,
      params.amount,
      data.dstAmount,
    ),
    fee: 0,
    estimatedGasUSD,
    route,
    expiresAt: Math.floor(Date.now() / 1000) + QUOTE_EXPIRY_SECONDS,
  }
}
