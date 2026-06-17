"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { History } from "lucide-react"

import { useTransactions } from "@/hooks/useTransactions"
import { TransactionTable } from "@/components/history/TransactionTable"
import { WalletButton } from "@/components/wallet/WalletButton"
import { cn } from "@/lib/utils"
import type { TransactionType } from "@/types"

const PAGE_LIMIT = 20

type FilterTab = "all" | TransactionType

const TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Onramp", value: "onramp" },
]

export default function HistoryPage() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<FilterTab>("all")
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching } = useTransactions({
    walletAddress: address ?? "",
    type: activeTab === "all" ? undefined : activeTab,
    page,
    limit: PAGE_LIMIT,
  })

  const transactions = data?.transactions ?? []
  const pagination = data?.pagination

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab)
    setPage(1)
  }

  if (!isConnected) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Transaction History</h1>
          <p className="mt-1 text-sm text-gray-400">
            View all your past transactions.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-800">
            <History className="h-6 w-6 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-300">Connect your wallet</p>
            <p className="mt-1 text-xs text-gray-500">
              Connect to see your transaction history.
            </p>
          </div>
          <WalletButton />
        </div>
      </div>
    )
  }

  const totalPages = pagination ? Math.ceil(pagination.total / PAGE_LIMIT) : 0

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Transaction History</h1>
        <p className="mt-1 text-sm text-gray-400">
          {pagination
            ? `${pagination.total} transaction${pagination.total !== 1 ? "s" : ""} found`
            : "Loading…"}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.value
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <TransactionTable transactions={transactions} isLoading={isLoading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
          <button
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
