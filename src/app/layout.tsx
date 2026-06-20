import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
import { cookieToInitialState } from "wagmi"
import "./globals.css"

import { wagmiConfig } from "@/lib/wagmi"
import { Navbar } from "@/components/layout/Navbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { Web3Provider } from "@/components/providers/Web3Provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "PayFlow Crypto",
  description: "Cross-chain crypto payment gateway — onramp, swap, bridge, and workflow automation.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookie = (await headers()).get("cookie")
  const initialState = cookieToInitialState(wagmiConfig, cookie)

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white`}>
        <Web3Provider initialState={initialState}>
          <Navbar />
          <div className="flex min-h-[calc(100vh-4rem)]">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </Web3Provider>
      </body>
    </html>
  )
}
