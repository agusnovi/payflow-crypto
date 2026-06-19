import { NextResponse } from "next/server"
import { z } from "zod"

import { getTokenPrices } from "@/lib/prices"

const QuerySchema = z.object({
  tokens: z.string().min(1),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "tokens query parameter is required" },
        { status: 400 }
      )
    }

    const tokens = [
      ...new Set(parsed.data.tokens.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)),
    ]

    const prices = await getTokenPrices(tokens)

    if (Object.keys(prices).length === 0) {
      return NextResponse.json(
        { success: false, error: "No supported tokens in request" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, data: prices })
  } catch (error) {
    console.error("[/api/prices]", error)
    return NextResponse.json(
      { success: false, error: "Price data temporarily unavailable" },
      { status: 500 }
    )
  }
}
