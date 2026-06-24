import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/db"
import { getTokenByAddress } from "@/lib/chains"

const HEX_HASH = /^0x[a-fA-F0-9]{64}$/

const ExecuteSchema = z.object({
  fromToken:     z.string().regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid from token address"),
  toToken:       z.string().regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid to token address"),
  fromAmount:    z.string().regex(/^\d+$/, "fromAmount must be a positive integer string"),
  toAmount:      z.string().regex(/^\d+$/, "toAmount must be a positive integer string"),
  chainId:       z.literal(11155111),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  txHash:        z.string().regex(HEX_HASH, "Invalid tx hash").optional(),
  approveTxHash: z.string().regex(HEX_HASH).optional(),
  simulated:     z.boolean().optional(),
}).refine(
  (d) => d.simulated === true || (typeof d.txHash === "string" && HEX_HASH.test(d.txHash)),
  { message: "txHash is required for real swaps", path: ["txHash"] }
)

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const parsed = ExecuteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const {
      fromToken, toToken, fromAmount, toAmount,
      chainId, walletAddress, txHash, approveTxHash, simulated,
    } = parsed.data

    if (fromToken.toLowerCase() === toToken.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Cannot swap a token for itself." },
        { status: 400 }
      )
    }

    const fromSymbol =
      getTokenByAddress(chainId, fromToken)?.symbol ??
      `${fromToken.slice(0, 6)}…${fromToken.slice(-4)}`

    const toSymbol =
      getTokenByAddress(chainId, toToken)?.symbol ??
      `${toToken.slice(0, 6)}…${toToken.slice(-4)}`

    const tx = await db.transaction.create({
      data: {
        type: "swap",
        status: simulated ? "completed" : "pending",
        fromChain: "Sepolia",
        toChain: null,
        fromToken: fromSymbol,
        toToken: toSymbol,
        fromAmount,
        toAmount,
        txHash: txHash ?? null,
        walletAddress,
        metadata: JSON.stringify({
          chainId,
          ...(simulated ? { simulated: true } : {}),
          ...(approveTxHash ? { approveTxHash } : {}),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        transactionId: tx.id,
        txHash: txHash ?? null,
        status: simulated ? ("completed" as const) : ("pending" as const),
        createdAt: tx.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("[/api/swap/execute]", error)
    return NextResponse.json(
      { success: false, error: "Failed to save transaction. Please try again." },
      { status: 500 }
    )
  }
}
