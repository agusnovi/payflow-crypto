import type { Metadata } from "next"
import { OnrampForm } from "@/components/onramp/OnrampForm"

export const metadata: Metadata = {
  title: "Onramp — PayFlow Crypto",
  description: "Convert fiat currency to crypto instantly.",
}

export default function OnrampPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Onramp</h1>
        <p className="mt-1 text-sm text-gray-400">
          Convert fiat (USD / IDR) to crypto. Quotes refresh every 30 seconds.
        </p>
      </div>

      <div className="mx-auto max-w-lg">
        <OnrampForm />
      </div>
    </div>
  )
}
