import { NextResponse } from "next/server"
import { z } from "zod"

import { getSwapQuote } from "@/lib/oneinch"
import type { ChainId } from "@/types"

const QuerySchema = z.object({
  src: z.string().regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid source token address"),
  dst: z.string().regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid destination token address"),
  amount: z.string().regex(/^\d+$/, "Amount must be a positive integer in wei"),
  chainId: z.coerce
    .number()
    .pipe(z.union([z.literal(1), z.literal(137), z.literal(8453), z.literal(42161)])),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/i)
    .optional(),
})

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
    const isClientError = /insufficient|not enough|cannot estimate/i.test(msg)
    return NextResponse.json(
      {
        success: false,
        error: isClientError ? msg : "Swap quote unavailable. Please try again.",
      },
      { status: isClientError ? 400 : 500 }
    )
  }
}
