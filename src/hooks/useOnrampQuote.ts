import { useQuery } from "@tanstack/react-query"

import type { ApiResponse, OnrampQuote, OnrampRequest } from "@/types"

async function fetchOnrampQuote(params: OnrampRequest): Promise<OnrampQuote> {
  const res = await fetch("/api/onramp/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  const json: ApiResponse<OnrampQuote> = await res.json()
  if (!json.success || !json.data) throw new Error(json.error ?? "Failed to fetch quote")
  return json.data
}

export function useOnrampQuote(params: OnrampRequest) {
  return useQuery({
    queryKey: ["onramp-quote", params],
    queryFn: () => fetchOnrampQuote(params),
    enabled: params.fiatAmount >= 10 && Boolean(params.walletAddress),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  })
}
