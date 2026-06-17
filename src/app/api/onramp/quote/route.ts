import { NextResponse } from "next/server"
import { z } from "zod"

import { getTokenPrices } from "@/lib/prices"
import type { OnrampQuote } from "@/types"

const QuoteSchema = z.object({
  fiatAmount: z.number().min(10, "Minimum amount is 10").max(10000, "Maximum amount is 10,000"),
  fiatCurrency: z.enum(["USD", "IDR"]),
  cryptoSymbol: z.enum(["USDC", "ETH", "MATIC"]),
  chainId: z.union([z.literal(1), z.literal(137), z.literal(8453), z.literal(42161)]),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
})

const PLATFORM_FEE_USD = 1.5
const NETWORK_FEE_USD = 1.0

const TOKEN_DECIMALS: Record<"USDC" | "ETH" | "MATIC", number> = {
  USDC: 6,
  ETH:  18,
  MATIC: 18,
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const parsed = QuoteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { fiatAmount, fiatCurrency, cryptoSymbol, chainId } = parsed.data

    // Fetch prices for the requested token + USDC (for USD/IDR rate)
    const symbols = cryptoSymbol === "USDC" ? ["USDC"] : ["USDC", cryptoSymbol]
    const prices = await getTokenPrices(symbols)

    const usdcPrice = prices["USDC"]
    if (!usdcPrice) {
      return NextResponse.json(
        { success: false, error: "Unable to fetch exchange rate. Please try again." },
        { status: 500 }
      )
    }

    // Convert USD fees to the requested fiat currency
    const usdToFiat = fiatCurrency === "USD" ? 1 : usdcPrice.idr
    const platformFee = Math.round(PLATFORM_FEE_USD * usdToFiat * 100) / 100
    const networkFee  = Math.round(NETWORK_FEE_USD  * usdToFiat * 100) / 100
    const totalFee    = platformFee + networkFee

    if (fiatAmount <= totalFee) {
      return NextResponse.json(
        { success: false, error: "Amount too small to cover fees." },
        { status: 400 }
      )
    }

    // Token price in the selected fiat currency
    const tokenPrice = prices[cryptoSymbol] ?? usdcPrice
    const exchangeRate = fiatCurrency === "USD" ? tokenPrice.usd : tokenPrice.idr

    if (!exchangeRate || exchangeRate === 0) {
      return NextResponse.json(
        { success: false, error: "Unable to fetch exchange rate. Please try again." },
        { status: 500 }
      )
    }

    // Crypto amount in smallest unit (BigInt-safe calculation)
    const effectiveFiat = fiatAmount - totalFee
    const decimals = TOKEN_DECIMALS[cryptoSymbol]
    const cryptoAmountRaw = (effectiveFiat / exchangeRate) * Math.pow(10, decimals)
    const cryptoAmount = BigInt(Math.round(cryptoAmountRaw)).toString()

    // Human-readable amount (e.g. "98.50")
    const cryptoAmountFormatted = (effectiveFiat / exchangeRate).toFixed(
      cryptoSymbol === "USDC" ? 2 : 6
    )

    const quote: OnrampQuote = {
      fiatAmount,
      fiatCurrency,
      cryptoAmount,
      cryptoSymbol,
      cryptoAmountFormatted,
      chainId,
      exchangeRate,
      platformFee,
      networkFee,
      totalFee,
      provider: "PayFlow Simulated",
      expiresAt: Math.floor(Date.now() / 1000) + 30,
    }

    return NextResponse.json({ success: true, data: quote })
  } catch (error) {
    console.error("[/api/onramp/quote]", error)
    return NextResponse.json(
      { success: false, error: "Unable to fetch exchange rate. Please try again." },
      { status: 500 }
    )
  }
}
