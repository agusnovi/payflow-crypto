import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatAmount(amount: string, decimals: number): string {
  const big = BigInt(amount)
  const divisor = BigInt(10 ** decimals)
  const whole = big / divisor
  const remainder = big % divisor
  const remainderStr = remainder.toString().padStart(decimals, "0").slice(0, 6)
  return `${whole}.${remainderStr}`.replace(/\.?0+$/, "")
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatFiat(amount: number, currency: string): string {
  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
