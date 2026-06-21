import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/db"
import { SUPPORTED_CHAINS, getTokensByChain } from "@/lib/chains"
import { getTokenPrices } from "@/lib/prices"
import { sendNative, sendERC20, getTreasuryBalance } from "@/lib/treasury"
import type { TestnetChainId } from "@/types"

const PLATFORM_FEE_USD = 1.5
const NETWORK_FEE_USD = 1.0

const TOKEN_DECIMALS: Record<"USDC" | "ETH" | "MATIC", number> = {
  USDC: 6,
  ETH: 18,
  MATIC: 18,
}

// Protect treasury: $50 USD max per transaction
const FIAT_CAP: Record<"USD" | "IDR", number> = { USD: 50, IDR: 800_000 }

// ETH is not native on Polygon Amoy; MATIC is not available on Sepolia / Base / Arb
function isValidTokenChain(
  symbol: "USDC" | "ETH" | "MATIC",
  chainId: TestnetChainId
): boolean {
  if (symbol === "MATIC") return chainId === 80002
  if (symbol === "ETH") return chainId !== 80002
  return true // USDC on all testnet chains
}

const ExecuteSchema = z.object({
  fiatAmount: z.number().positive(),
  fiatCurrency: z.enum(["USD", "IDR"]),
  cryptoSymbol: z.enum(["USDC", "ETH", "MATIC"]),
  chainId: z.union([
    z.literal(11155111),
    z.literal(84532),
    z.literal(421614),
    z.literal(80002),
  ]),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  expiresAt: z.number().int().positive(),
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

    const { fiatAmount, fiatCurrency, cryptoSymbol, chainId, walletAddress, expiresAt } =
      parsed.data

    if (Math.floor(Date.now() / 1000) > expiresAt) {
      return NextResponse.json(
        { success: false, error: "Quote has expired. Please get a new quote." },
        { status: 400 }
      )
    }

    if (fiatAmount > FIAT_CAP[fiatCurrency]) {
      return NextResponse.json(
        { success: false, error: "Maximum onramp amount is $50 USD equivalent." },
        { status: 400 }
      )
    }

    if (!isValidTokenChain(cryptoSymbol, chainId)) {
      return NextResponse.json(
        {
          success: false,
          error: `${cryptoSymbol} is not available on ${SUPPORTED_CHAINS[chainId].name}.`,
        },
        { status: 400 }
      )
    }

    // Recalculate crypto amount server-side — never trust frontend amount
    const symbols = cryptoSymbol === "USDC" ? ["USDC"] : ["USDC", cryptoSymbol]
    const prices = await getTokenPrices(symbols)

    const usdcPrice = prices["USDC"]
    if (!usdcPrice) {
      return NextResponse.json(
        { success: false, error: "Unable to fetch exchange rate. Please try again." },
        { status: 500 }
      )
    }

    const usdToFiat = fiatCurrency === "USD" ? 1 : usdcPrice.idr
    const platformFee = Math.round(PLATFORM_FEE_USD * usdToFiat * 100) / 100
    const networkFee = Math.round(NETWORK_FEE_USD * usdToFiat * 100) / 100
    const totalFee = platformFee + networkFee

    if (fiatAmount <= totalFee) {
      return NextResponse.json(
        { success: false, error: "Amount too small to cover fees." },
        { status: 400 }
      )
    }

    const tokenPrice = prices[cryptoSymbol] ?? usdcPrice
    const exchangeRate = fiatCurrency === "USD" ? tokenPrice.usd : tokenPrice.idr

    if (!exchangeRate || exchangeRate === 0) {
      return NextResponse.json(
        { success: false, error: "Unable to fetch exchange rate. Please try again." },
        { status: 500 }
      )
    }

    const effectiveFiat = fiatAmount - totalFee
    const decimals = TOKEN_DECIMALS[cryptoSymbol]
    const amountWei = BigInt(
      Math.round((effectiveFiat / exchangeRate) * Math.pow(10, decimals))
    )

    // Guard: check treasury native balance before attempting send
    const isNative = cryptoSymbol === "ETH" || cryptoSymbol === "MATIC"
    const { native: treasuryNative } = await getTreasuryBalance(chainId)

    if (isNative && treasuryNative < amountWei) {
      return NextResponse.json(
        {
          success: false,
          error: "Treasury balance insufficient. Please try a smaller amount.",
        },
        { status: 503 }
      )
    }

    // Broadcast transaction from treasury wallet
    let txHash: `0x${string}`

    if (isNative) {
      txHash = await sendNative(walletAddress as `0x${string}`, amountWei, chainId)
    } else {
      const tokens = getTokensByChain(chainId)
      const usdcToken = tokens.find((t) => t.symbol === "USDC")

      if (!usdcToken) {
        return NextResponse.json(
          { success: false, error: "USDC not available on selected chain." },
          { status: 400 }
        )
      }

      txHash = await sendERC20(
        walletAddress as `0x${string}`,
        usdcToken.address as `0x${string}`,
        amountWei,
        chainId
      )
    }

    const chainName = SUPPORTED_CHAINS[chainId].name

    const tx = await db.transaction.create({
      data: {
        type: "onramp",
        status: "pending",
        fromChain: fiatCurrency,
        toChain: chainName,
        fromToken: fiatCurrency,
        toToken: cryptoSymbol,
        fromAmount: fiatAmount.toString(),
        toAmount: amountWei.toString(),
        txHash,
        walletAddress,
        metadata: JSON.stringify({
          chainId,
          fiatCurrency,
          provider: "PayFlow Treasury",
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        transactionId: tx.id,
        status: "pending" as const,
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
