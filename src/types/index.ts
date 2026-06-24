// ─────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────

export type MainnetChainId = 1 | 137 | 8453 | 42161
export type TestnetChainId = 11155111 | 84532 | 421614 | 80002
export type ChainId = MainnetChainId | TestnetChainId

export type FiatCurrency = "USD" | "IDR"

export type TransactionType = "onramp" | "swap" | "bridge" | "workflow"

export type TransactionStatus = "pending" | "processing" | "completed" | "failed"

export type WorkflowStatus = "draft" | "running" | "completed" | "failed"

export type WorkflowStepType = "onramp" | "swap" | "bridge" | "transfer"

export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed"

// ─────────────────────────────────────────
// Chain & Token
// ─────────────────────────────────────────

export interface ChainConfig {
  id: ChainId
  name: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: 18
  }
  blockExplorerUrl: string
}

export interface Token {
  symbol: string
  name: string
  address: string
  decimals: number
  chainId: ChainId
  logoUrl?: string
}

// ─────────────────────────────────────────
// API Response Envelope
// ─────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ─────────────────────────────────────────
// Onramp
// ─────────────────────────────────────────

export interface OnrampQuote {
  fiatAmount: number
  fiatCurrency: FiatCurrency
  cryptoAmount: string
  cryptoSymbol: string
  cryptoAmountFormatted: string
  chainId: ChainId
  exchangeRate: number
  platformFee: number
  networkFee: number
  totalFee: number
  provider: string
  expiresAt: number
}

export interface OnrampRequest {
  fiatAmount: number
  fiatCurrency: FiatCurrency
  cryptoSymbol: "USDC" | "ETH" | "MATIC"
  chainId: ChainId
  walletAddress: string
}

export interface OnrampExecuteResult {
  transactionId: string
  status: "pending" | "completed" | "failed"
  txHash: string
  createdAt: string
}

// ─────────────────────────────────────────
// Swap
// ─────────────────────────────────────────

export interface SwapRouteStep {
  protocol: string
  portion: number
}

export interface SwapQuote {
  fromToken: Token
  toToken: Token
  fromAmount: string
  toAmount: string
  toAmountFormatted: string
  priceImpact: number
  fee: number
  estimatedGasUSD: string
  route: SwapRouteStep[]
  expiresAt: number
  poolFee?: number       // Uniswap V3 pool fee tier (500 | 3000 | 10000) — Sepolia only
  isSimulated?: boolean  // true when Uniswap pool unavailable; price from CoinGecko
}

export interface SwapRequest {
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  chainId: ChainId
  walletAddress: string
}

// ─────────────────────────────────────────
// Bridge
// ─────────────────────────────────────────

export interface BridgeQuote {
  fromChain: ChainId
  toChain: ChainId
  fromToken: Pick<Token, "symbol" | "address" | "chainId">
  toToken: Pick<Token, "symbol" | "address" | "chainId">
  fromAmount: string
  toAmount: string
  toAmountFormatted: string
  ccipFeeWei: string
  ccipFeeFormatted: string
  estimatedSeconds: number
  estimatedTimeFormatted: string
  bridgeProtocol: string
  expiresAt: number
}

export interface BridgeRequest {
  fromChain: ChainId
  toChain: ChainId
  token: string
  amount: string
  walletAddress: string
}

// ─────────────────────────────────────────
// Transaction
// ─────────────────────────────────────────

export interface Transaction {
  id: string
  type: TransactionType
  status: TransactionStatus
  fromChain: string
  toChain: string | null
  fromToken: string
  toToken: string | null
  fromAmount: string
  toAmount: string | null
  txHash: string | null
  walletAddress: string
  metadata: string | null
  workflowId: string | null
  createdAt: string
  updatedAt: string
}

export interface TransactionListResponse {
  transactions: Transaction[]
  pagination: {
    total: number
    page: number
    limit: number
    hasMore: boolean
  }
}

// ─────────────────────────────────────────
// Workflow
// ─────────────────────────────────────────

export interface WorkflowStep {
  id: string
  type: WorkflowStepType
  label: string
  params: Record<string, unknown>
  dependsOn: string[]
  status: WorkflowStepStatus
  result: Record<string, unknown> | null
  error: string | null
}

export interface WorkflowExecutionResult {
  workflowId: string
  status: WorkflowStatus
  steps: WorkflowStep[]
  completedAt?: string
  createdAt: string
}
