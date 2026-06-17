"use client"

import { useEffect, useRef, useState } from "react"
import { useAccount, useBalance, useReadContracts } from "wagmi"
import { formatUnits } from "viem"
import { ChevronDown, Search } from "lucide-react"

import { NATIVE_TOKEN_ADDRESS } from "@/lib/chains"
import { cn } from "@/lib/utils"
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

interface TokenSelectorProps {
  tokens: Token[]
  selectedToken: Token | null
  onChange: (token: Token) => void
  chainId: ChainId
  label?: string
  disabled?: boolean
}

function TokenAvatar({ symbol }: { symbol: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-bold text-indigo-400">
      {symbol.slice(0, 2)}
    </div>
  )
}

export function TokenSelector({
  tokens,
  selectedToken,
  onChange,
  chainId,
  label,
  disabled = false,
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const { address } = useAccount()

  const nativeToken = tokens.find((t) => t.address === NATIVE_TOKEN_ADDRESS)
  const erc20Tokens = tokens.filter((t) => t.address !== NATIVE_TOKEN_ADDRESS)

  const { data: nativeBalance } = useBalance({
    address,
    chainId,
    query: { enabled: Boolean(address) && Boolean(nativeToken) },
  })

  const { data: erc20Results } = useReadContracts({
    contracts: address
      ? erc20Tokens.map((token) => ({
          address: token.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf" as const,
          args: [address] as const,
          chainId,
        }))
      : [],
    query: { enabled: Boolean(address) && erc20Tokens.length > 0 },
  })

  function getBalance(token: Token): string {
    if (!address) return ""
    if (token.address === NATIVE_TOKEN_ADDRESS) {
      if (!nativeBalance) return ""
      const amt = parseFloat(formatUnits(nativeBalance.value, token.decimals))
      return amt === 0 ? "0" : amt.toFixed(6).replace(/\.?0+$/, "")
    }
    const idx = erc20Tokens.findIndex((t) => t.address === token.address)
    const raw = erc20Results?.[idx]?.result as bigint | undefined
    if (raw === undefined) return ""
    const amt = parseFloat(formatUnits(raw, token.decimals))
    return amt === 0 ? "0" : amt.toFixed(token.decimals === 6 ? 2 : 6).replace(/\.?0+$/, "")
  }

  const filtered = tokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
  )

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
    else setSearch("")
  }, [open])

  function handleSelect(token: Token) {
    onChange(token)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <p className="mb-1.5 text-sm font-medium text-gray-300">{label}</p>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50",
          open ? "border-indigo-500 ring-2 ring-indigo-500" : "hover:border-gray-600"
        )}
      >
        {selectedToken ? (
          <>
            <TokenAvatar symbol={selectedToken.symbol} />
            <span className="flex-1 text-left font-medium text-white">
              {selectedToken.symbol}
            </span>
          </>
        ) : (
          <span className="flex-1 text-left text-gray-500">Select token</span>
        )}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
          {/* Search */}
          <div className="border-b border-gray-800 p-2">
            <div className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or symbol…"
                className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Token list */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-gray-500">
                No tokens found
              </li>
            ) : (
              filtered.map((token) => {
                const balance = getBalance(token)
                const isSelected = selectedToken?.address === token.address

                return (
                  <li key={token.address}>
                    <button
                      type="button"
                      onClick={() => handleSelect(token)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-800",
                        isSelected && "bg-indigo-600/10"
                      )}
                    >
                      <TokenAvatar symbol={token.symbol} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{token.symbol}</p>
                        <p className="truncate text-xs text-gray-500">{token.name}</p>
                      </div>
                      {balance && (
                        <span className="shrink-0 text-xs text-gray-400">{balance}</span>
                      )}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
