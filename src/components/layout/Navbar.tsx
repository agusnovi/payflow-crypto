"use client"

import Link from "next/link"
import { WalletButton } from "@/components/wallet/WalletButton"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            P
          </div>
          <span className="text-lg font-semibold text-white">PayFlow</span>
          <span className="text-lg font-semibold text-indigo-400">Crypto</span>
        </Link>

        <WalletButton />
      </div>
    </header>
  )
}
