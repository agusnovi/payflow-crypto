import type { Metadata } from "next"
import { SwapForm } from "@/components/swap/SwapForm"

export const metadata: Metadata = {
  title: "Swap — PayFlow Crypto",
  description: "Exchange tokens at the best rate via 1inch aggregation.",
}

export default function SwapPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Swap</h1>
        <p className="mt-1 text-sm text-gray-400">
          Get real-time quotes from 1inch. Quotes refresh every 15 seconds.
        </p>
      </div>

      <div className="mx-auto max-w-lg">
        <SwapForm />
      </div>
    </div>
  )
}
