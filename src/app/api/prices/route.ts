import { NextResponse } from "next/server"
import { z } from "zod"

const COINGECKO_IDS: Record<string, string> = {
  ETH:   "ethereum",
  WETH:  "weth",
  USDC:  "usd-coin",
  USDT:  "tether",
  MATIC: "matic-network",
  DAI:   "dai",
}

const ID_TO_SYMBOL = Object.fromEntries(
  Object.entries(COINGECKO_IDS).map(([sym, id]) => [id, sym])
)

type PriceEntry = { usd: number; idr: number }

interface CacheEntry {
  data: Record<string, PriceEntry>
  cachedAt: number
}

const priceCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

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
    const cacheKey = [...tokens].sort().join(",")

    const cached = priceCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: { ...cached.data, cachedAt: new Date(cached.cachedAt).toISOString() },
      })
    }

    const ids = tokens.map((t) => COINGECKO_IDS[t]).filter(Boolean).join(",")

    if (!ids) {
      return NextResponse.json(
        { success: false, error: "No supported tokens in request" },
        { status: 400 }
      )
    }

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,idr`,
      { headers: { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY ?? "" } }
    )

    if (!res.ok) {
      throw new Error(`CoinGecko error: ${res.status}`)
    }

    const raw = (await res.json()) as Record<string, PriceEntry>

    const prices: Record<string, PriceEntry> = {}
    for (const [coinId, entry] of Object.entries(raw)) {
      const symbol = ID_TO_SYMBOL[coinId]
      if (symbol) prices[symbol] = entry
    }

    const now = Date.now()
    priceCache.set(cacheKey, { data: prices, cachedAt: now })

    return NextResponse.json({
      success: true,
      data: { ...prices, cachedAt: new Date(now).toISOString() },
    })
  } catch (error) {
    console.error("[/api/prices]", error)
    return NextResponse.json(
      { success: false, error: "Price data temporarily unavailable" },
      { status: 500 }
    )
  }
}
