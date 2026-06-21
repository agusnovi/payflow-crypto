import { NextResponse } from "next/server"

import { isTestnetChainId } from "@/lib/chains"
import { db } from "@/lib/db"
import { getPublicClient } from "@/lib/treasury"
import type { ApiResponse, Transaction } from "@/types"

function serializeTx(tx: {
  id: string
  type: string
  status: string
  fromChain: string
  toChain: string | null
  fromToken: string
  toToken: string | null
  fromAmount: string
  toAmount: string | null
  txHash: string | null
  walletAddress: string
  metadata: string | null
  workflowId: string | null
  createdAt: Date
  updatedAt: Date
}): Transaction {
  return {
    ...tx,
    type: tx.type as Transaction["type"],
    status: tx.status as Transaction["status"],
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Transaction>>> {
  try {
    const { id } = await params

    const tx = await db.transaction.findUnique({ where: { id } })

    if (!tx) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      )
    }

    // If pending with a real txHash, check on-chain receipt and update DB
    if (tx.status === "pending" && tx.txHash) {
      try {
        const meta = tx.metadata
          ? (JSON.parse(tx.metadata) as Record<string, unknown>)
          : {}
        const chainId =
          typeof meta.chainId === "number" ? meta.chainId : null

        if (chainId !== null && isTestnetChainId(chainId)) {
          const client = getPublicClient(chainId)
          const receipt = await client.getTransactionReceipt({
            hash: tx.txHash as `0x${string}`,
          })

          const newStatus = receipt.status === "success" ? "completed" : "failed"
          const updated = await db.transaction.update({
            where: { id },
            data: { status: newStatus },
          })
          return NextResponse.json({ success: true, data: serializeTx(updated) })
        }
      } catch {
        // Receipt not yet available or chainId not in metadata — return current status
      }
    }

    return NextResponse.json({ success: true, data: serializeTx(tx) })
  } catch (error) {
    console.error("[GET /api/transactions/:id]", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
