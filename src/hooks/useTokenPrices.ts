import { useQuery } from "@tanstack/react-query"

import type { ApiResponse } from "@/types"

export type TokenPriceMap = Record<string, { usd: number; idr: number }>

async function fetchPrices(tokens: string[]): Promise<TokenPriceMap> {
  const res = await fetch(`/api/prices?tokens=${tokens.join(",")}`)
  const json: ApiResponse<TokenPriceMap> = await res.json()

  if (!json.success || !json.data) {
    throw new Error(json.error ?? "Failed to fetch prices")
  }

  return json.data
}

export function useTokenPrices(tokens: string[]) {
  const key = [...tokens].sort()

  return useQuery({
    queryKey: ["prices", key],
    queryFn: () => fetchPrices(tokens),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: tokens.length > 0,
  })
}
