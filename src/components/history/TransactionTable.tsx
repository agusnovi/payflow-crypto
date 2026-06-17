"use client"

import { useState } from "react"
import { Copy, Check, ExternalLink } from "lucide-react"
import { formatAmount, cn } from "@/lib/utils"
import type { Transaction, TransactionStatus, TransactionType } from "@/types"

const CHAIN_EXPLORER: Record<string, string> = {
  Ethereum: "https://etherscan.io",
  Polygon: "https://polygonscan.com",
  Base: "https://basescan.org",
  "Arbitrum One": "https://arbiscan.io",
}

// Decimals per token symbol (display only — not authoritative config)
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  MATIC: 18,
  WETH: 18,
  DAI: 18,
}

const STATUS_STYLES: Record<TransactionStatus, string> = {
  pending:    "bg-yellow-600/20 text-yellow-400",
  processing: "bg-blue-600/20 text-blue-400",
  completed:  "bg-green-600/20 text-green-400",
  failed:     "bg-red-600/20 text-red-400",
}

const TYPE_STYLES: Record<TransactionType, string> = {
  onramp:   "bg-indigo-600/20 text-indigo-400",
  swap:     "bg-purple-600/20 text-purple-400",
  bridge:   "bg-orange-600/20 text-orange-400",
  workflow: "bg-cyan-600/20 text-cyan-400",
}

function formatFiat(amount: string, currency: string): string {
  const num = parseFloat(amount)
  if (currency === "IDR") {
    return `Rp ${num.toLocaleString("id-ID")}`
  }
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatCrypto(amount: string, symbol: string): string {
  const decimals = TOKEN_DECIMALS[symbol] ?? 18
  return `${formatAmount(amount, decimals)} ${symbol}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function TxHashCell({ hash, chainName }: { hash: string; chainName: string }) {
  const [copied, setCopied] = useState(false)
  const explorerBase = CHAIN_EXPLORER[chainName]

  function handleCopy() {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs text-gray-400">
          {hash.slice(0, 6)}…{hash.slice(-4)}
        </span>
        <button
          onClick={handleCopy}
          className="rounded p-0.5 text-gray-600 transition-colors hover:text-gray-300"
          title="Copy tx hash"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      {explorerBase && (
        <a
          href={`${explorerBase}/tx/${hash}`}
          onClick={(e) => e.preventDefault()}
          tabIndex={-1}
          aria-disabled="true"
          title="Simulated — not on-chain"
          className="inline-flex cursor-not-allowed items-center gap-1 text-xs text-gray-600"
        >
          <ExternalLink className="h-3 w-3" />
          View on Explorer
          <span className="rounded bg-gray-800 px-1 py-0.5 text-xs text-gray-500">
            Simulated
          </span>
        </a>
      )}
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-gray-800" />
        </td>
      ))}
    </tr>
  )
}

interface Props {
  transactions: Transaction[]
  isLoading: boolean
}

export function TransactionTable({ transactions, isLoading }: Props) {
  if (!isLoading && transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 py-16 text-center">
        <p className="text-sm font-medium text-gray-400">No transactions yet</p>
        <p className="text-xs text-gray-600">
          Complete your first onramp to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/60">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">You Paid</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">You Got</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tx Hash</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-900">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : transactions.map((tx) => (
                <tr key={tx.id} className="transition-colors hover:bg-gray-800/50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                    {formatDate(tx.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        TYPE_STYLES[tx.type]
                      )}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {tx.type === "onramp"
                      ? formatFiat(tx.fromAmount, tx.fromToken)
                      : `${tx.fromAmount} ${tx.fromToken}`}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-white">
                    {tx.toAmount && tx.toToken
                      ? formatCrypto(tx.toAmount, tx.toToken)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        STATUS_STYLES[tx.status]
                      )}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {tx.txHash ? (
                      <TxHashCell hash={tx.txHash} chainName={tx.fromChain} />
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
