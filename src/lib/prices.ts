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

export interface TokenPrice {
  usd: number
  idr: number
}

interface CacheEntry {
  data: Record<string, TokenPrice>
  cachedAt: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

export async function getTokenPrices(
  symbols: string[]
): Promise<Record<string, TokenPrice>> {
  const key = [...symbols].sort().join(",")

  const hit = cache.get(key)
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) return hit.data

  const ids = symbols.map((s) => COINGECKO_IDS[s]).filter(Boolean).join(",")
  if (!ids) return {}

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,idr`,
    { headers: { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY ?? "" } }
  )

  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)

  const raw = (await res.json()) as Record<string, TokenPrice>

  const data: Record<string, TokenPrice> = {}
  for (const [coinId, price] of Object.entries(raw)) {
    const symbol = ID_TO_SYMBOL[coinId]
    if (symbol) data[symbol] = price
  }

  cache.set(key, { data, cachedAt: Date.now() })
  return data
}
