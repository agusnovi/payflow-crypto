import { useBalance, useReadContract } from "wagmi"
import { formatUnits } from "viem"

import { NATIVE_TOKEN_ADDRESS } from "@/lib/chains"
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

interface TokenBalanceResult {
  balanceWei: bigint
  balanceFormatted: string
  isLoading: boolean
}

export function useTokenBalance(
  token: Token | null,
  walletAddress: string | undefined,
  chainId: ChainId,
): TokenBalanceResult {
  const isNative = token?.address === NATIVE_TOKEN_ADDRESS
  const enabled = Boolean(token) && Boolean(walletAddress)

  const { data: nativeData, isLoading: nativeLoading } = useBalance({
    address: walletAddress as `0x${string}` | undefined,
    chainId,
    query: { enabled: enabled && isNative },
  })

  const { data: erc20Raw, isLoading: erc20Loading } = useReadContract({
    address: (token?.address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    chainId,
    query: { enabled: enabled && !isNative },
  })

  if (!token || !walletAddress) {
    return { balanceWei: BigInt(0), balanceFormatted: "0", isLoading: false }
  }

  const balanceWei: bigint = isNative
    ? (nativeData?.value ?? BigInt(0))
    : ((erc20Raw as bigint | undefined) ?? BigInt(0))

  const isLoading = isNative ? nativeLoading : erc20Loading

  const raw = parseFloat(formatUnits(balanceWei, token.decimals))
  const balanceFormatted =
    raw === 0
      ? "0"
      : raw.toFixed(token.decimals === 6 ? 2 : 6).replace(/\.?0+$/, "")

  return { balanceWei, balanceFormatted, isLoading }
}
