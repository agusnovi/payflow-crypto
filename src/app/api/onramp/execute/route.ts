import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/db"
import { SUPPORTED_CHAINS } from "@/lib/chains"
import type { ChainId } from "@/types"

const ExecuteSchema = z.object({
  fiatAmount: z.number().positive(),
  fiatCurrency: z.enum(["USD", "IDR"]),
  cryptoAmount: z.string().regex(/^\d+$/, "Must be a positive integer string"),
  cryptoSymbol: z.enum(["USDC", "ETH", "MATIC"]),
  chainId: z.union([z.literal(1), z.literal(137), z.literal(8453), z.literal(42161)]),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
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

    const {
      fiatAmount,
      fiatCurrency,
      cryptoAmount,
      cryptoSymbol,
      chainId,
      walletAddress,
    } = parsed.data

    const chainName = SUPPORTED_CHAINS[chainId as ChainId].name
    const txHash = `0x${randomBytes(32).toString("hex")}`

    const tx = await db.transaction.create({
      data: {
        type: "onramp",
        status: "completed",
        fromChain: fiatCurrency,
        toChain: chainName,
        fromToken: fiatCurrency,
        toToken: cryptoSymbol,
        fromAmount: fiatAmount.toString(),
        toAmount: cryptoAmount,
        txHash,
        walletAddress,
        metadata: JSON.stringify({
          fiatCurrency,
          provider: "PayFlow Simulated",
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        transactionId: tx.id,
        status: "completed",
        txHash,
        createdAt: tx.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("[/api/onramp/execute]", error)
    return NextResponse.json(
      { success: false, error: "Transaction failed. Please try again." },
      { status: 500 }
    )
  }
}
