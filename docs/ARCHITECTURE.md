# Architecture — PayFlow Crypto

**Version:** 1.1
**Last Updated:** 2026-06-21

---

## 1. System Overview

PayFlow is a **monolithic Next.js application** — frontend and backend live in the same repository and are deployed together on Vercel. This is intentional for a portfolio project: one repo, one deployment, zero infrastructure complexity.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
│                                                                  │
│  React Pages + Components                                        │
│  wagmi hooks (read blockchain + sign swap/bridge tx)             │
│  TanStack Query (server state + polling)                         │
│  RainbowKit (wallet UI)                                          │
└────────────┬──────────────────────────────┬─────────────────────┘
             │ fetch /api/*                  │ sign tx (swap/bridge)
             ▼                               ▼
┌─────────────────────────┐     ┌───────────────────────────────┐
│  Next.js API Routes      │     │  Testnet Smart Contracts       │
│  (Server — Node.js)      │     │                               │
│                          │     │  Uniswap V3 SwapRouter02      │
│  - Input validation      │     │  (Sepolia — swap)             │
│  - External API calls    │     │                               │
│  - DB writes             │     │  Chainlink CCIP Router        │
│  - On-chain status check │     │  (Sepolia/Base/Arb/Amoy)      │
│  - Treasury tx (onramp)  │     └───────────────────────────────┘
└──────────┬───────────────┘
           │                     ┌────────────────────────────────┐
           │ broadcast tx        │  Alchemy RPC Nodes              │
           │ (onramp only)       │  (mainnet + 4 testnets)         │
           ▼                     └────────────────────────────────┘
  Treasury Wallet
  sends ETH/USDC to user        ┌────────────────────────────────┐
                                 │  1inch API (swap quotes)        │
           │ Prisma ORM          └────────────────────────────────┘
           ▼
┌─────────────────────────┐     ┌────────────────────────────────┐
│  SQLite Database         │     │  CoinGecko API (token prices)  │
│  (dev.db)                │     └────────────────────────────────┘
│  - Transaction           │
│  - WorkflowTemplate      │
└─────────────────────────┘
```

---

## 2. Layer Responsibilities

### 2.1 Frontend (React / Next.js Client)

**Responsibilities:**
- Render UI components
- Manage wallet connection state via wagmi
- Read on-chain data (balances, chain info) via wagmi hooks
- Call backend `/api/*` routes for quotes, transactions, workflows
- Display real-time data via TanStack Query with polling
- **Swap**: broadcast `approve` + `swap` transactions directly to Uniswap V3 (user signs via MetaMask)
- **Bridge**: broadcast `approve` + `ccipSend` transactions directly to CCIP Router (user signs via MetaMask)
- Poll `GET /api/transactions/:id` every 3 seconds for pending transactions until final status

**Must NOT:**
- Call 1inch, CoinGecko, or Alchemy directly (API keys must stay on server)
- Write to the database
- Execute business logic (fee calculation, validation)

### 2.2 Backend (Next.js API Routes)

**Responsibilities:**
- Validate all incoming request bodies with Zod
- Call external APIs (1inch, CoinGecko) using server-side API keys
- Execute business logic (fee calculation, workflow orchestration)
- Read/write database via Prisma
- Return standardized `{ success, data, error }` responses
- **Onramp only**: broadcast treasury wallet transaction to user's address via viem
- Check on-chain transaction receipt when `GET /api/transactions/:id` is polled; update DB status accordingly

**Must NOT:**
- Expose raw API keys or `TREASURY_PRIVATE_KEY` in responses
- Trust client-provided `cryptoAmount` for onramp — always recalculate server-side
- Allow cross-wallet data access (always filter by `walletAddress`)

### 2.3 Web3 Layer (wagmi + viem)

**Responsibilities:**
- Manage wallet connection lifecycle
- Read on-chain data: native balance, ERC-20 balance, chain ID
- Send transactions when execution is real (testnet)
- Watch for transaction confirmation

**Key hooks used:**
```typescript
useAccount()          // connected wallet address + chain
useBalance()          // native token balance
useReadContract()     // read ERC-20 balance
useSendTransaction()  // send raw transaction
useWaitForTransactionReceipt() // poll for confirmation
useChainId()          // current chain
useSwitchChain()      // prompt user to switch chain
```

### 2.4 Database (Prisma + SQLite)

**Responsibilities:**
- Persist transaction history
- Store workflow templates
- Track workflow execution state

**Access pattern:** Only accessible from API routes. Never from React components.

### 2.5 Treasury Wallet

A server-controlled wallet used exclusively for **onramp execution**. When a user confirms an onramp, the server reads `TREASURY_PRIVATE_KEY` from env, creates a viem wallet client, and sends ETH or USDC to the user's wallet on the target testnet.

**Scope:** Onramp only. Swap and bridge do NOT use the treasury — the user's own wallet signs those transactions.

**Security constraints:**
- `TREASURY_PRIVATE_KEY` is server-only — never in `NEXT_PUBLIC_` variables
- Never returned in API responses or logged
- Max per onramp transaction: equivalent of $50 USD (protects treasury balance)
- Treasury address is funded from public testnet faucets (no real money)

**Implementation:** `src/lib/treasury.ts` — exports `sendNative()` and `sendERC20()` using viem `walletClient`.

### 2.6 On-chain Status Polling

For transactions with status `"pending"`, the frontend polls `GET /api/transactions/:id` every 3 seconds. The API handler:

1. Reads current DB status
2. If still `"pending"` — checks on-chain tx receipt via Alchemy RPC
3. If receipt exists and `status === "success"` → updates DB to `"completed"`
4. If receipt exists and `status === "reverted"` → updates DB to `"failed"`
5. If no receipt yet → returns `"pending"` unchanged
6. Returns latest status to frontend

Frontend stops polling when it receives `"completed"` or `"failed"`.

---

## 3. Request Flow

### 3.1 Onramp Execution Flow

```
User fills OnrampForm → clicks Confirm
       │
       ▼ POST /api/onramp/execute { fiatAmount, cryptoSymbol, chainId, walletAddress }
API Route: src/app/api/onramp/execute/route.ts
       │
       ├─ Validate input with Zod
       ├─ Recalculate cryptoAmount server-side via CoinGecko
       ├─ Check treasury balance ≥ cryptoAmount
       ├─ Build treasury walletClient from TREASURY_PRIVATE_KEY
       ├─ Send ETH (native) or USDC (ERC-20) to walletAddress on testnet
       ├─ Save DB: { type: "onramp", status: "pending", txHash: real_hash }
       └─ Return { transactionId, status: "pending", txHash }
       │
       ▼
Frontend polls GET /api/transactions/:id every 3 seconds
       │
       ▼ GET /api/transactions/:id
       ├─ DB status is "pending" → check tx receipt via Alchemy RPC
       ├─ Receipt found + success → update DB to "completed", return "completed"
       └─ No receipt → return "pending" (keep polling)
       │
       ▼
OnrampForm shows success + Sepolia Etherscan link
```

### 3.2 Swap Execution Flow

```
User fills SwapForm → clicks Swap (on Sepolia)
       │
       ▼ useWriteContract (wagmi)
Frontend: check USDC allowance for SwapRouter02
       │
       ├─ allowance < fromAmount?
       │   └─ MetaMask popup: "Approve USDC" → user signs approve tx
       │
       ▼ MetaMask popup: "Confirm Swap" → user signs swap tx to Uniswap SwapRouter02
       │
       ▼ POST /api/swap/execute { ..., txHash: user_signed_tx_hash }
API Route: src/app/api/swap/route.ts
       │
       ├─ Validate input + txHash
       ├─ Save DB: { type: "swap", status: "pending", txHash }
       └─ Return { transactionId, status: "pending" }
       │
       ▼
Frontend polls GET /api/transactions/:id → confirms on-chain
```

### 3.3 Swap Quote Flow

```
User types amount in SwapForm
       │
       ▼ (debounced 500ms)
useSwapQuote hook
       │
       ▼ GET /api/swap/quote?fromToken=...&toToken=...&amount=...&chainId=...
API Route: src/app/api/swap/route.ts
       │
       ├─ Validate params with Zod
       ├─ Call 1inch API: GET https://api.1inch.dev/swap/v6.0/{chainId}/quote
       ├─ Transform response to SwapQuote type
       └─ Return { success: true, data: SwapQuote }
       │
       ▼
SwapForm renders: output amount, price impact, route, gas estimate
```

### 3.2 Workflow Execution Flow

```
User clicks "Run Workflow"
       │
       ▼ POST /api/workflow/execute { steps, walletAddress }
API Route: src/app/api/workflow/route.ts
       │
       ├─ Validate workflow with Zod
       ├─ Create Transaction record in DB (status: "pending")
       ├─ For each step (in order):
       │   ├─ Update step status → "running"
       │   ├─ Execute step (call relevant handler)
       │   ├─ On success: update step status → "completed"
       │   └─ On failure: update step + workflow status → "failed", STOP
       ├─ On all steps complete: update workflow status → "completed"
       └─ Return { success: true, data: { workflowId, status, steps } }
       │
       ▼
Frontend polls GET /api/workflow/:id/status every 2 seconds
useWorkflow hook updates UI with live step statuses
```

### 3.3 Balance Read Flow (On-chain, no backend)

```
User connects wallet
       │
       ▼
useAccount() → { address, chainId }
       │
       ▼
useBalance({ address }) → native token balance (ETH/MATIC)
       │
       ▼
useReadContract({ abi: ERC20_ABI, functionName: 'balanceOf' }) → token balance
       │
       ▼
GET /api/prices?tokens=ETH,USDC → USD prices from CoinGecko
       │
       ▼
Dashboard renders portfolio with USD values
```

---

## 4. Tech Decisions

### Why Next.js App Router (not Pages Router)?
- Supports React Server Components for faster initial loads
- API Routes are colocated with the pages they serve
- Native support for streaming responses (useful for workflow status)
- Industry direction — Vercel's recommended approach

### Why wagmi v2 + viem (not ethers.js)?
- wagmi v2 is built on viem, which is the modern TypeScript-native Web3 library
- viem has better TypeScript types, smaller bundle size, and better tree-shaking
- wagmi provides React hooks (TanStack Query under the hood) for on-chain reads
- This is the stack used by most modern DeFi frontends including Uniswap v4

### Why RainbowKit (not building custom wallet UI)?
- Production-quality wallet connection UI out of the box
- Supports 300+ wallets via WalletConnect
- Handles edge cases: chain switching, disconnection, account changes
- Saves ~2 days of custom wallet UI work

### Why SQLite (not PostgreSQL)?
- Zero setup for local development — no Docker, no cloud DB
- Prisma makes it trivial to switch to PostgreSQL for production
- Sufficient for portfolio demo with single-user data
- To migrate to Postgres: change `DATABASE_URL` and `provider = "postgresql"` in schema.prisma

### Why 1inch (not Uniswap SDK directly)?
- 1inch aggregates across all DEXes — always returns best price
- Single API handles routing across Uniswap, Curve, Balancer, and 200+ others
- Simpler integration: REST API vs complex on-chain multicall logic
- Free tier sufficient for demo usage

### Why CoinGecko (not Chainlink price feeds)?
- CoinGecko supports IDR pricing (needed for Indonesian market context)
- REST API is simpler than on-chain Chainlink oracle reads
- Free tier: 30 req/min — sufficient
- Chainlink would require on-chain calls per price update — overkill here

---

## 5. External Dependencies

### 5.1 Alchemy (RPC Provider)

**Used for:** Stable blockchain RPC for wagmi (frontend reads) and viem (server-side treasury tx + status polling)

**Configuration in `src/lib/wagmi.ts`:**
```typescript
const alchemyId = process.env.NEXT_PUBLIC_ALCHEMY_ID

// Mainnet chains (balance display, price quotes)
transports: {
  [mainnet.id]:  http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyId}`),
  [polygon.id]:  http(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyId}`),
  [base.id]:     http(`https://base-mainnet.g.alchemy.com/v2/${alchemyId}`),
  [arbitrum.id]: http(`https://arb-mainnet.g.alchemy.com/v2/${alchemyId}`),
  // Testnet chains (swap/bridge/onramp execution)
  [sepolia.id]:         http(`https://eth-sepolia.g.alchemy.com/v2/${alchemyId}`),
  [baseSepolia.id]:     http(`https://base-sepolia.g.alchemy.com/v2/${alchemyId}`),
  [arbitrumSepolia.id]: http(`https://arb-sepolia.g.alchemy.com/v2/${alchemyId}`),
  [polygonAmoy.id]:     http(`https://polygon-amoy.g.alchemy.com/v2/${alchemyId}`),
}
```

**Fallback:** Public RPC URLs in `src/lib/chains.ts` if Alchemy key is missing (dev only).

### 5.2 1inch API

**Used for:** Swap quotes

**Base URL:** `https://api.1inch.dev/swap/v6.0/{chainId}`

**Endpoints used:**
- `GET /quote` — get swap quote without building tx
- `GET /swap` — get swap quote + tx calldata (when executing)

**Auth:** `Authorization: Bearer {ONEINCH_API_KEY}` header

**Rate limits:** Free tier allows sufficient requests for demo. Implemented with 500ms debounce on frontend.

**Client:** `src/lib/oneinch.ts`

### 5.3 CoinGecko API

**Used for:** Real-time token prices in USD and IDR

**Base URL:** `https://api.coingecko.com/api/v3`

**Endpoint used:**
- `GET /simple/price?ids=ethereum,matic-network,usd-coin&vs_currencies=usd,idr`

**Caching:** Responses cached in memory for 60 seconds to avoid rate limits.

**Client:** `src/lib/prices.ts`

### 5.4 Reown (WalletConnect)

**Used for:** QR code wallet connection relay

**Setup:** Project ID in `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

**Used via:** RainbowKit which handles all WalletConnect logic internally.

### 5.5 Uniswap V3 (Swap Execution)

**Used for:** Real token swap execution on Sepolia testnet. The frontend calls Uniswap contracts directly — the server only gets the resulting txHash.

**Contracts on Sepolia:**
- `SwapRouter02`: `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` — executes the swap
- `Quoter V2`: `0xEd1f6473345F45b75833fd55D191EF2c763f4884` — read-only preview of output amount

**Supported pair:** ETH ↔ USDC only (pool fee 0.05% or 0.3% depending on depth)

**Flow:** Check allowance → `approve(spender, amount)` if needed → `exactInputSingle(params)`

### 5.6 Chainlink CCIP (Bridge)

**Used for:** Real cross-chain token transfers between testnets. The user signs the CCIP transaction directly from their wallet.

**CCIP Router addresses:**
| Chain | Address |
|---|---|
| Sepolia | `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59` |
| Base Sepolia | `0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93` |
| Arbitrum Sepolia | `0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165` |
| Polygon Amoy | `0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2` |

**Supported testnet lanes:**
- Sepolia ↔ Base Sepolia
- Sepolia ↔ Arbitrum Sepolia
- Sepolia ↔ Polygon Amoy

**Fee:** Paid in native token (ETH/MATIC) by the user. Estimated via `IRouterClient.getFee()` on the source chain router.

**Tracking:** Each CCIP send returns a `messageId`. Store in `metadata.ccipMessageId` for debugging at `ccip.chain.link`.

---

## 6. Bridge (Chainlink CCIP on Testnet)

Bridge execution uses Chainlink CCIP — a real cross-chain messaging protocol. Unlike the old simulated fee matrix, fees are fetched on-chain from the CCIP Router contract.

**Fee estimation:** Call `IRouterClient.getFee(destinationChainSelector, message)` on the source chain router. Returns fee in wei (native token). This is called server-side in `POST /api/bridge/quote`.

**Estimated transfer time** by lane (approximate, varies with network):

| From → To | Est. Time |
|---|---|
| Sepolia → Base Sepolia | ~15 min |
| Sepolia → Arbitrum Sepolia | ~15 min |
| Sepolia → Polygon Amoy | ~20 min |
| Base Sepolia → Sepolia | ~15 min |
| Arbitrum Sepolia → Sepolia | ~15 min |
| Polygon Amoy → Sepolia | ~20 min |

> Times are estimates. CCIP status can be tracked at `ccip.chain.link` using the `messageId` stored in transaction metadata.

---

## 7. Error Handling Strategy

### API Routes

All API routes follow this pattern:

```typescript
export async function POST(request: Request) {
  try {
    // 1. Parse and validate input
    const body = await request.json()
    const parsed = MySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.message },
        { status: 400 }
      )
    }

    // 2. Business logic
    const result = await doSomething(parsed.data)

    // 3. Success response
    return Response.json({ success: true, data: result })

  } catch (error) {
    // 4. Unexpected errors
    console.error('[API Error]', error)
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### External API Failures

| Failure | Behavior |
|---|---|
| 1inch API down | Return `{ success: false, error: 'Quote unavailable. Try again.' }` |
| CoinGecko rate limited | Return cached price if < 5 min old, else return `null` price |
| Alchemy RPC timeout | wagmi retries automatically (3 attempts) |

### Workflow Step Failure

- Log the error on the failed step
- Set step `status = "failed"` and `error = error.message`
- Set workflow `status = "failed"`
- Stop execution — do not proceed to next steps
- Do NOT rollback completed steps (document this as known limitation)

### Frontend Error States

- All data-fetching hooks return `{ data, isLoading, error }` via TanStack Query
- Components must handle all three states explicitly
- Use `<ErrorBoundary>` at page level to catch unexpected React errors

---

## 8. Security Considerations

Since this is a demo/portfolio project, the following apply:

| Area | Approach |
|---|---|
| API Keys | All secret keys in env vars, never exposed to client |
| `TREASURY_PRIVATE_KEY` | Server-only env var — never `NEXT_PUBLIC_`, never logged, never in responses |
| Input validation | All API inputs validated with Zod |
| Onramp amount | Server recalculates `cryptoAmount` — never trusts client-provided value |
| Wallet auth | No real auth — wallet address used as identifier |
| Database | No sensitive financial data — all amounts are testnet |
| CORS | Next.js default (same-origin for API routes) |
| Private keys | Treasury key in env only; user keys managed by MetaMask |
| Treasury limit | Max $50 USD equivalent per onramp tx to prevent treasury drain |

> For a production system, add: rate limiting per wallet, authentication via SIWE (Sign-In with Ethereum), PostgreSQL with connection pooling, HSM or KMS for treasury key management, and audit logging.
