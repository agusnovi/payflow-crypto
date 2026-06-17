import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import type { ApiResponse, ChainId, SwapQuote } from "@/types"

export interface SwapQuoteInput {
  fromTokenAddress: string
  toTokenAddress: string
  amount: string       // in wei
  chainId: ChainId
  walletAddress?: string
}

async function fetchSwapQuote(
  params: SwapQuoteInput,
  signal: AbortSignal,
): Promise<SwapQuote> {
  const search = new URLSearchParams({
    src: params.fromTokenAddress,
    dst: params.toTokenAddress,
    amount: params.amount,
    chainId: params.chainId.toString(),
    ...(params.walletAddress ? { walletAddress: params.walletAddress } : {}),
  })

  const res = await fetch(`/api/swap/quote?${search.toString()}`, { signal })
  const json: ApiResponse<SwapQuote> = await res.json()
  if (!json.success || !json.data) throw new Error(json.error ?? "Failed to fetch quote")
  return json.data
}

function isValidInput(params: SwapQuoteInput): boolean {
  return (
    Boolean(params.fromTokenAddress) &&
    Boolean(params.toTokenAddress) &&
    params.fromTokenAddress.toLowerCase() !== params.toTokenAddress.toLowerCase() &&
    Boolean(params.amount) &&
    params.amount !== "0" &&
    BigInt(params.amount) > BigInt(0)
  )
}

export function useSwapQuote(params: SwapQuoteInput) {
  const [debouncedParams, setDebouncedParams] = useState<SwapQuoteInput>(params)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedParams(params), 500)
    return () => clearTimeout(timer)
  }, [
    params.fromTokenAddress,
    params.toTokenAddress,
    params.amount,
    params.chainId,
    params.walletAddress,
  ])

  return useQuery({
    queryKey: ["swap-quote", debouncedParams],
    queryFn: ({ signal }) => fetchSwapQuote(debouncedParams, signal),
    enabled: isValidInput(debouncedParams),
    staleTime: 15_000,
    refetchInterval: 15_000,
    retry: 1,
  })
}
