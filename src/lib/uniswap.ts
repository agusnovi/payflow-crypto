import { formatUnits } from "viem"

import { NATIVE_TOKEN_ADDRESS } from "@/lib/chains"
import { getPublicClient } from "@/lib/treasury"

// ── Sepolia contract addresses ────────────────────────────────────────────────

export const SWAP_ROUTER_02 = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E" as const
export const QUOTER_V2      = "0xEd1f6473345F45b75833fd55D191EF2c763f4884" as const
export const WETH9_SEPOLIA  = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" as const
export const USDC_SEPOLIA   = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const

// ── ABIs (minimal) ────────────────────────────────────────────────────────────

export const quoterV2Abi = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",           type: "address" },
          { name: "tokenOut",          type: "address" },
          { name: "amountIn",          type: "uint256" },
          { name: "fee",               type: "uint24"  },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut",                  type: "uint256" },
      { name: "sqrtPriceX96After",          type: "uint160" },
      { name: "initializedTicksCrossed",    type: "uint32"  },
      { name: "gasEstimate",               type: "uint256" },
    ],
  },
] as const

export const swapRouterAbi = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",           type: "address" },
          { name: "tokenOut",          type: "address" },
          { name: "fee",               type: "uint24"  },
          { name: "recipient",         type: "address" },
          { name: "amountIn",          type: "uint256" },
          { name: "amountOutMinimum",  type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    name: "unwrapWETH9",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient",     type: "address" },
    ],
    outputs: [],
  },
] as const

// ── Server-side quote via Quoter V2 ───────────────────────────────────────────

// Native ETH (0xEeee…) needs to be WETH9 for Uniswap pool lookups
function resolveUniswapToken(address: string): `0x${string}` {
  return address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
    ? WETH9_SEPOLIA
    : (address as `0x${string}`)
}

export interface UniswapQuoteResult {
  amountOut: bigint
  amountOutFormatted: string
  gasEstimate: bigint
  poolFee: number   // 500 | 3000 | 10000
}

// Try fee tiers in order of typical liquidity on Sepolia
const FEE_TIERS = [3000, 500, 10000] as const

export async function getUniswapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  toDecimals: number,
): Promise<UniswapQuoteResult> {
  const client = getPublicClient(11155111)
  const resolvedIn  = resolveUniswapToken(tokenIn)
  const resolvedOut = resolveUniswapToken(tokenOut)

  let lastError: unknown

  for (const fee of FEE_TIERS) {
    try {
      const { result } = await client.simulateContract({
        address: QUOTER_V2,
        abi: quoterV2Abi,
        functionName: "quoteExactInputSingle",
        args: [{
          tokenIn:           resolvedIn,
          tokenOut:          resolvedOut,
          amountIn,
          fee,
          sqrtPriceLimitX96: BigInt(0),
        }],
      })

      const [amountOut, , , gasEstimate] = result

      const amountOutFormatted = parseFloat(
        formatUnits(amountOut, toDecimals)
      ).toFixed(toDecimals <= 6 ? 2 : 6).replace(/\.?0+$/, "")

      return { amountOut, amountOutFormatted, gasEstimate, poolFee: fee }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError ?? new Error("No Uniswap V3 pool found for this pair on Sepolia")
}
