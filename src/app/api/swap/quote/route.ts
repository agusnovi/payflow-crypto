import { NextResponse } from "next/server"
import { z } from "zod"

import { getTokenByAddress } from "@/lib/chains"
import { getSwapQuote } from "@/lib/oneinch"
import { getUniswapQuote } from "@/lib/uniswap"
import type { ChainId, SwapQuote } from "@/types"

const QuerySchema = z.object({
  src: z.string().regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid source token address"),
  dst: z.string().regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid destination token address"),
  amount: z.string().regex(/^\d+$/, "Amount must be a positive integer in wei"),
  chainId: z.coerce.number().pipe(
    z.union([
      z.literal(1),
      z.literal(137),
      z.literal(8453),
      z.literal(42161),
      z.literal(11155111), // Sepolia — uses Uniswap V3 Quoter
    ])
  ),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/i).optional(),
})

const QUOTE_EXPIRY_SECONDS = 30

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { src, dst, amount, chainId, walletAddress } = parsed.data

    if (src.toLowerCase() === dst.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Cannot swap a token for itself" },
        { status: 400 }
      )
    }

    // ── Sepolia: use Uniswap V3 Quoter V2 ─────────────────────────────────────
    if (chainId === 11155111) {
      const fromToken = getTokenByAddress(11155111, src)
      const toToken   = getTokenByAddress(11155111, dst)

      if (!fromToken) {
        return NextResponse.json(
          { success: false, error: `Token not supported on Sepolia: ${src}` },
          { status: 400 }
        )
      }
      if (!toToken) {
        return NextResponse.json(
          { success: false, error: `Token not supported on Sepolia: ${dst}` },
          { status: 400 }
        )
      }

      const result = await getUniswapQuote(src, dst, BigInt(amount), toToken.decimals)

      const quote: SwapQuote = {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: result.amountOut.toString(),
        toAmountFormatted: result.amountOutFormatted,
        priceImpact: 0,
        fee: 0,
        estimatedGasUSD: result.gasEstimate.toString(),
        route: [{ protocol: "Uniswap V3", portion: 100 }],
        expiresAt: Math.floor(Date.now() / 1000) + QUOTE_EXPIRY_SECONDS,
        poolFee: result.poolFee,
      }

      return NextResponse.json({ success: true, data: quote })
    }

    // ── Mainnet: use 1inch ────────────────────────────────────────────────────
    const quote = await getSwapQuote({
      fromTokenAddress: src,
      toTokenAddress: dst,
      amount,
      chainId: chainId as ChainId,
      walletAddress,
    })

    return NextResponse.json({ success: true, data: quote })
  } catch (error) {
    console.error("[/api/swap/quote]", error)
    const msg = error instanceof Error ? error.message : ""
    const isClientError = /insufficient|not enough|cannot estimate|no.*pool/i.test(msg)
    return NextResponse.json(
      {
        success: false,
        error: isClientError ? msg : "Swap quote unavailable. Please try again.",
      },
      { status: isClientError ? 400 : 500 }
    )
  }
}
