import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/db"
import { SUPPORTED_CHAINS, getTokenByAddress } from "@/lib/chains"
import type { ChainId } from "@/types"

const ExecuteSchema = z.object({
  fromToken:     z.string().regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid from token address"),
  toToken:       z.string().regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid to token address"),
  fromAmount:    z.string().regex(/^\d+$/, "fromAmount must be a positive integer string"),
  toAmount:      z.string().regex(/^\d+$/, "toAmount must be a positive integer string"),
  chainId:       z.union([z.literal(1), z.literal(137), z.literal(8453), z.literal(42161)]),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  slippage:      z.number().min(0.01).max(50).default(0.5),
  expiresAt:     z.number().int().positive(),
})

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

    const { fromToken, toToken, fromAmount, toAmount, chainId, walletAddress, expiresAt } =
      parsed.data

    if (Math.floor(Date.now() / 1000) > expiresAt) {
      return NextResponse.json(
        { success: false, error: "Quote has expired. Please get a new quote." },
        { status: 400 }
      )
    }

    if (fromToken.toLowerCase() === toToken.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Cannot swap a token for itself." },
        { status: 400 }
      )
    }

    const chainName = SUPPORTED_CHAINS[chainId as ChainId].name

    const fromSymbol =
      getTokenByAddress(chainId as ChainId, fromToken)?.symbol ??
      `${fromToken.slice(0, 6)}…${fromToken.slice(-4)}`

    const toSymbol =
      getTokenByAddress(chainId as ChainId, toToken)?.symbol ??
      `${toToken.slice(0, 6)}…${toToken.slice(-4)}`

    const txHash = `0x${randomBytes(32).toString("hex")}`

    const tx = await db.transaction.create({
      data: {
        type: "swap",
        status: "completed",
        fromChain: chainName,
        toChain: null,
        fromToken: fromSymbol,
        toToken: toSymbol,
        fromAmount,
        toAmount,
        txHash,
        walletAddress,
        metadata: JSON.stringify({ chainId }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        transactionId: tx.id,
        txHash,
        createdAt: tx.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("[/api/swap/execute]", error)
    return NextResponse.json(
      { success: false, error: "Transaction failed. Please try again." },
      { status: 500 }
    )
  }
}
