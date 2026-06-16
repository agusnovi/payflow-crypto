import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http } from "wagmi"
import { arbitrum, base, mainnet, polygon } from "wagmi/chains"

const ALCHEMY_ID = process.env.NEXT_PUBLIC_ALCHEMY_ID ?? ""
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? ""

function alchemyRpc(subdomain: string): string {
  return `https://${subdomain}.g.alchemy.com/v2/${ALCHEMY_ID}`
}

export const wagmiConfig = getDefaultConfig({
  appName: "PayFlow Crypto",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [mainnet, polygon, base, arbitrum],
  transports: {
    [mainnet.id]: http(alchemyRpc("eth-mainnet")),
    [polygon.id]: http(alchemyRpc("polygon-mainnet")),
    [base.id]: http(alchemyRpc("base-mainnet")),
    [arbitrum.id]: http(alchemyRpc("arb-mainnet")),
  },
  ssr: true,
})
