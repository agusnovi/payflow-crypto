import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http, cookieStorage, createStorage } from "wagmi"
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  polygon,
  polygonAmoy,
  sepolia,
} from "wagmi/chains"

const ALCHEMY_ID = process.env.NEXT_PUBLIC_ALCHEMY_ID ?? ""
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? ""

function alchemyRpc(subdomain: string): string {
  return `https://${subdomain}.g.alchemy.com/v2/${ALCHEMY_ID}`
}

export const wagmiConfig = getDefaultConfig({
  appName: "PayFlow Crypto",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [
    // Mainnet (balance display, price quotes)
    mainnet, polygon, base, arbitrum,
    // Testnet (swap, bridge, onramp execution)
    sepolia, baseSepolia, arbitrumSepolia, polygonAmoy,
  ],
  transports: {
    // Mainnet
    [mainnet.id]:   http(alchemyRpc("eth-mainnet")),
    [polygon.id]:   http(alchemyRpc("polygon-mainnet")),
    [base.id]:      http(alchemyRpc("base-mainnet")),
    [arbitrum.id]:  http(alchemyRpc("arb-mainnet")),
    // Testnet
    [sepolia.id]:         http(alchemyRpc("eth-sepolia")),
    [baseSepolia.id]:     http(alchemyRpc("base-sepolia")),
    [arbitrumSepolia.id]: http(alchemyRpc("arb-sepolia")),
    [polygonAmoy.id]:     http(alchemyRpc("polygon-amoy")),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
})
