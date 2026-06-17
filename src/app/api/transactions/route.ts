import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import type { ApiResponse, Transaction, TransactionListResponse } from "@/types"

const QuerySchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  type: z.enum(["onramp", "swap", "bridge", "workflow"]).optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<TransactionListResponse>>> {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams)
    const parsed = QuerySchema.safeParse(params)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { walletAddress, type, status, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const where = {
      walletAddress,
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
    }

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.transaction.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions.map((tx) => ({
          ...tx,
          type: tx.type as Transaction["type"],
          status: tx.status as Transaction["status"],
          createdAt: tx.createdAt.toISOString(),
          updatedAt: tx.updatedAt.toISOString(),
        })),
        pagination: {
          total,
          page,
          limit,
          hasMore: skip + transactions.length < total,
        },
      },
    })
  } catch (error) {
    console.error("[GET /api/transactions]", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 }
    )
  }
}
