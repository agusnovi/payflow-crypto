import { createPublicClient, createWalletClient, erc20Abi, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { arbitrumSepolia, baseSepolia, polygonAmoy, sepolia } from "wagmi/chains"
import type { Chain, Hash } from "viem"

import type { TestnetChainId } from "@/types"

// ── Internal chain maps ───────────────────────────────────────────────────────

const VIEM_CHAINS: Record<TestnetChainId, Chain> = {
  11155111: sepolia,
  84532:    baseSepolia,
  421614:   arbitrumSepolia,
  80002:    polygonAmoy,
}

const ALCHEMY_SUBDOMAINS: Record<TestnetChainId, string> = {
  11155111: "eth-sepolia",
  84532:    "base-sepolia",
  421614:   "arb-sepolia",
  80002:    "polygon-amoy",
}

function alchemyRpc(chainId: TestnetChainId): string {
  const id = process.env.NEXT_PUBLIC_ALCHEMY_ID ?? ""
  return `https://${ALCHEMY_SUBDOMAINS[chainId]}.g.alchemy.com/v2/${id}`
}

// ── Private helpers ───────────────────────────────────────────────────────────

function getTreasuryAccount() {
  const key = process.env.TREASURY_PRIVATE_KEY
  if (!key) throw new Error("TREASURY_PRIVATE_KEY is not configured")
  return privateKeyToAccount(key as `0x${string}`)
}

function walletClient(chainId: TestnetChainId) {
  return createWalletClient({
    account: getTreasuryAccount(),
    chain: VIEM_CHAINS[chainId],
    transport: http(alchemyRpc(chainId)),
  })
}

// ── Public exports ────────────────────────────────────────────────────────────

export function getPublicClient(chainId: TestnetChainId) {
  return createPublicClient({
    chain: VIEM_CHAINS[chainId],
    transport: http(alchemyRpc(chainId)),
  })
}

export function getTreasuryAddress(): `0x${string}` {
  return getTreasuryAccount().address
}

export async function getTreasuryBalance(chainId: TestnetChainId) {
  const account = getTreasuryAccount()
  const client = getPublicClient(chainId)
  const native = await client.getBalance({ address: account.address })
  return { native, address: account.address }
}

export async function sendNative(
  to: `0x${string}`,
  amountWei: bigint,
  chainId: TestnetChainId
): Promise<Hash> {
  return walletClient(chainId).sendTransaction({ to, value: amountWei })
}

export async function sendERC20(
  to: `0x${string}`,
  tokenAddress: `0x${string}`,
  amountWei: bigint,
  chainId: TestnetChainId
): Promise<Hash> {
  return walletClient(chainId).writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amountWei],
  })
}
