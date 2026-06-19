"use client"

import { useEffect, useState } from "react"
import { useAccount, useBalance, useReadContracts } from "wagmi"
import { formatUnits } from "viem"
import { Wallet } from "lucide-react"

import { useTokenPrices } from "@/hooks/useTokenPrices"
import { WalletButton } from "@/components/wallet/WalletButton"
import {
  COMMON_TOKENS,
  NATIVE_TOKEN_ADDRESS,
  SUPPORTED_CHAINS,
  isValidChainId,
} from "@/lib/chains"
import { shortenAddress } from "@/lib/utils"
import type { ChainId, Token } from "@/types"

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

function formatUSD(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatBalance(value: number, decimals: number): string {
  if (value === 0) return "0"
  return value.toFixed(Math.min(decimals, 6))
}

// ─── Sub-components ────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub?: string
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
    </div>
  )
}

interface TokenRowProps {
  token: Token
  balance: number
  priceUSD: number
  loading?: boolean
}

function TokenRow({ token, balance, priceUSD, loading }: TokenRowProps) {
  const valueUSD = balance * priceUSD

  return (
    <tr className="border-t border-gray-800 transition-colors hover:bg-gray-800/40">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-bold text-indigo-400">
            {token.symbol.slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{token.symbol}</p>
            <p className="text-xs text-gray-500">{token.name}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        {loading ? (
          <span className="text-gray-600">—</span>
        ) : (
          <span className="text-sm text-white">{formatBalance(balance, token.decimals)}</span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <span className="text-sm text-gray-400">
          {priceUSD > 0 ? formatUSD(priceUSD) : "—"}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="text-sm font-medium text-white">
          {loading ? "—" : formatUSD(valueUSD)}
        </span>
      </td>
    </tr>
  )
}

// ─── Page ──────────────────────────────────────────────────

export default function DashboardPage() {
  // ── Mounted guard — prevents hydration mismatch with wagmi SSR ──
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { address, chainId, isConnected } = useAccount()

  const currentChainId: ChainId = chainId && isValidChainId(chainId) ? chainId : 1
  const chain = SUPPORTED_CHAINS[currentChainId]
  const tokens = COMMON_TOKENS[currentChainId]
  const nativeToken = tokens[0]
  const erc20Tokens = tokens.filter((t) => t.address !== NATIVE_TOKEN_ADDRESS)

  const { data: nativeBalance, isLoading: nativeLoading } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  })

  const { data: erc20Results, isLoading: erc20Loading } = useReadContracts({
    contracts: address
      ? erc20Tokens.map((token) => ({
          address: token.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf" as const,
          args: [address] as const,
        }))
      : [],
    query: { enabled: Boolean(address) },
  })

  const allSymbols = tokens.map((t) => t.symbol)
  const { data: prices } = useTokenPrices(allSymbols, isConnected)

  const nativeAmt = nativeBalance ? parseFloat(formatUnits(nativeBalance.value, 18)) : 0
  const nativePriceUSD = prices?.[nativeToken.symbol]?.usd ?? 0
  const nativeValueUSD = nativeAmt * nativePriceUSD

  const erc20Rows = erc20Tokens.map((token, i) => {
    const raw = erc20Results?.[i]?.result as bigint | undefined
    const balance = raw !== undefined ? parseFloat(formatUnits(raw, token.decimals)) : 0
    const priceUSD = prices?.[token.symbol]?.usd ?? 0
    return { token, balance, priceUSD }
  })

  const totalUSD =
    nativeValueUSD +
    erc20Rows.reduce((sum, { balance, priceUSD }) => sum + balance * priceUSD, 0)

  // ── Not mounted yet (SSR) — render nothing to avoid hydration mismatch ──
  if (!mounted) return null

  // ── Not connected ──────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/20">
          <Wallet className="h-8 w-8 text-indigo-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Connect your wallet</h2>
          <p className="max-w-sm text-sm text-gray-400">
            Connect a wallet to view your portfolio balance and start using PayFlow.
          </p>
        </div>
        <WalletButton />
        <p className="text-xs text-gray-600">
          Don&apos;t have a wallet?{" "}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 underline hover:text-indigo-300"
          >
            Install MetaMask
          </a>
        </p>
      </div>
    )
  }

  // ── Connected ──────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        {address && (
          <p className="mt-1 font-mono text-sm text-gray-400">{shortenAddress(address)}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Portfolio Value"
          value={nativeLoading || erc20Loading ? "Loading…" : formatUSD(totalUSD)}
        />
        <StatCard
          label={`${nativeToken.symbol} Balance`}
          value={nativeLoading ? "Loading…" : `${formatBalance(nativeAmt, 6)} ${nativeToken.symbol}`}
          sub={nativePriceUSD > 0 ? formatUSD(nativeValueUSD) : undefined}
        />
        <StatCard
          label="Network"
          value={chain.name}
          sub={`Chain ID: ${currentChainId}`}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-base font-semibold text-white">Token Balances</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                Token
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                Balance
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                Price
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            <TokenRow
              token={nativeToken}
              balance={nativeAmt}
              priceUSD={nativePriceUSD}
              loading={nativeLoading}
            />
            {erc20Rows.map(({ token, balance, priceUSD }) => (
              <TokenRow
                key={token.address}
                token={token}
                balance={balance}
                priceUSD={priceUSD}
                loading={erc20Loading}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
