import type { ChainConfig, ChainId, MainnetChainId, TestnetChainId, Token } from "@/types"

// Used by 1inch and wagmi to represent native tokens (ETH, MATIC)
export const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

export const MAINNET_CHAIN_IDS = [1, 137, 8453, 42161] as const satisfies MainnetChainId[]
export const TESTNET_CHAIN_IDS = [11155111, 84532, 421614, 80002] as const satisfies TestnetChainId[]
export const SUPPORTED_CHAIN_IDS = [...MAINNET_CHAIN_IDS, ...TESTNET_CHAIN_IDS] as const satisfies ChainId[]

export const SUPPORTED_CHAINS = {
  // ── Mainnet ──────────────────────────────────────────────
  1: {
    id: 1,
    name: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://etherscan.io",
  },
  137: {
    id: 137,
    name: "Polygon",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorerUrl: "https://polygonscan.com",
  },
  8453: {
    id: 8453,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://basescan.org",
  },
  42161: {
    id: 42161,
    name: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://arbiscan.io",
  },
  // ── Testnet ──────────────────────────────────────────────
  11155111: {
    id: 11155111,
    name: "Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://sepolia.etherscan.io",
  },
  84532: {
    id: 84532,
    name: "Base Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  421614: {
    id: 421614,
    name: "Arbitrum Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://sepolia.arbiscan.io",
  },
  80002: {
    id: 80002,
    name: "Polygon Amoy",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorerUrl: "https://amoy.polygonscan.com",
  },
} satisfies Record<ChainId, ChainConfig>

export const COMMON_TOKENS: Record<ChainId, Token[]> = {
  // ── Mainnet ──────────────────────────────────────────────
  // Ethereum
  1: [
    {
      symbol: "ETH",
      name: "Ether",
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      chainId: 1,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      chainId: 1,
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
      chainId: 1,
    },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      decimals: 18,
      chainId: 1,
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      decimals: 18,
      chainId: 1,
    },
  ],
  // Polygon
  137: [
    {
      symbol: "MATIC",
      name: "MATIC",
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      chainId: 137,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      decimals: 6,
      chainId: 137,
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
      chainId: 137,
    },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      decimals: 18,
      chainId: 137,
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      decimals: 18,
      chainId: 137,
    },
  ],
  // Base
  8453: [
    {
      symbol: "ETH",
      name: "Ether",
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      chainId: 8453,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      chainId: 8453,
    },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      chainId: 8453,
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      decimals: 18,
      chainId: 8453,
    },
  ],
  // Arbitrum One
  42161: [
    {
      symbol: "ETH",
      name: "Ether",
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      chainId: 42161,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
      chainId: 42161,
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
      chainId: 42161,
    },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      decimals: 18,
      chainId: 42161,
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      decimals: 18,
      chainId: 42161,
    },
  ],
  // ── Testnet ──────────────────────────────────────────────
  // Sepolia (Ethereum testnet)
  11155111: [
    {
      symbol: "ETH",
      name: "Ether",
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      chainId: 11155111,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      decimals: 6,
      chainId: 11155111,
    },
  ],
  // Base Sepolia
  84532: [
    {
      symbol: "ETH",
      name: "Ether",
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      chainId: 84532,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      decimals: 6,
      chainId: 84532,
    },
  ],
  // Arbitrum Sepolia
  421614: [
    {
      symbol: "ETH",
      name: "Ether",
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      chainId: 421614,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
      decimals: 6,
      chainId: 421614,
    },
  ],
  // Polygon Amoy
  80002: [
    {
      symbol: "MATIC",
      name: "MATIC",
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      chainId: 80002,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
      decimals: 6,
      chainId: 80002,
    },
  ],
}

export function isValidChainId(id: number): id is ChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(id)
}

export function isTestnetChainId(id: number): id is TestnetChainId {
  return (TESTNET_CHAIN_IDS as readonly number[]).includes(id)
}

export function isMainnetChainId(id: number): id is MainnetChainId {
  return (MAINNET_CHAIN_IDS as readonly number[]).includes(id)
}

export function getChainName(chainId: ChainId): string {
  return SUPPORTED_CHAINS[chainId].name
}

export function getTokensByChain(chainId: ChainId): Token[] {
  return COMMON_TOKENS[chainId]
}

export function getTokenByAddress(chainId: ChainId, address: string): Token | undefined {
  return COMMON_TOKENS[chainId].find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  )
}
