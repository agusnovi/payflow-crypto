import { useQuery } from "@tanstack/react-query"
import type {
  ApiResponse,
  TransactionListResponse,
  TransactionType,
  TransactionStatus,
} from "@/types"

interface Params {
  walletAddress: string
  type?: TransactionType
  status?: TransactionStatus
  page?: number
  limit?: number
}

async function fetchTransactions(params: Params): Promise<TransactionListResponse> {
  const search = new URLSearchParams({ walletAddress: params.walletAddress })
  if (params.type) search.set("type", params.type)
  if (params.status) search.set("status", params.status)
  if (params.page) search.set("page", String(params.page))
  if (params.limit) search.set("limit", String(params.limit))

  const res = await fetch(`/api/transactions?${search.toString()}`)
  const json: ApiResponse<TransactionListResponse> = await res.json()

  if (!json.success || !json.data) {
    throw new Error(json.error ?? "Failed to fetch transactions")
  }

  return json.data
}

export function useTransactions(params: Params) {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => fetchTransactions(params),
    enabled: Boolean(params.walletAddress),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
