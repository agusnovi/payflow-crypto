"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider, cookieToInitialState } from "wagmi"

import "@rainbow-me/rainbowkit/styles.css"

import { wagmiConfig } from "@/lib/wagmi"

interface Web3ProviderProps {
  children: ReactNode
  cookie?: string
}

export function Web3Provider({ children, cookie }: Web3ProviderProps) {
  // cookieToInitialState runs during SSR of this client component — safe here
  const initialState = cookieToInitialState(wagmiConfig, cookie)
  // useState ensures a new QueryClient per mount — avoids shared state across SSR requests
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
