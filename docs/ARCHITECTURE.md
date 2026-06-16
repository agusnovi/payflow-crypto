# Architecture — PayFlow Crypto

**Version:** 1.0
**Last Updated:** 2026-06-16

---

## 1. System Overview

PayFlow is a **monolithic Next.js application** — frontend and backend live in the same repository and are deployed together on Vercel. This is intentional for a portfolio project: one repo, one deployment, zero infrastructure complexity.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
│                                                                  │
│  React Pages + Components                                        │
│  wagmi hooks (read blockchain)                                   │
│  TanStack Query (server state)                                   │
│  RainbowKit (wallet UI)                                          │
└────────────┬─────────────────────────────────┬──────────────────┘
             │ fetch /api/*                     │ RPC calls
             ▼                                  ▼
┌─────────────────────────┐        ┌────────────────────────────┐
│  Next.js API Routes      │        │  Alchemy RPC Nodes          │
│  (Server — Node.js)      │        │  (Ethereum, Base,           │
│                          │        │   Polygon, Arbitrum)        │
│  - Input validation      │        └────────────────────────────┘
│  - Business logic        │
│  - External API calls    │        ┌────────────────────────────┐
│  - DB writes             │───────▶│  1inch API                  │
│                          │        │  (swap quotes)              │
└──────────┬───────────────┘        └────────────────────────────┘
           │
           │ Prisma ORM             ┌────────────────────────────┐
           ▼                        │  CoinGecko API              │
┌─────────────────────────┐        │  (token prices)             │
│  SQLite Database         │◀──────│                            │
│  (dev.db)                │        └────────────────────────────┘
│                          │
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

**Must NOT:**
- Expose raw API keys in responses
- Trust client-provided data without validation
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

---

## 3. Request Flow

### 3.1 Swap Quote Flow

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

**Used for:** Stable blockchain RPC for wagmi

**Configuration in `src/lib/wagmi.ts`:**
```typescript
const alchemyId = process.env.NEXT_PUBLIC_ALCHEMY_ID

// Injected into wagmi transports per chain
transports: {
  [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyId}`),
  [polygon.id]: http(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyId}`),
  [base.id]:    http(`https://base-mainnet.g.alchemy.com/v2/${alchemyId}`),
  [arbitrum.id]:http(`https://arb-mainnet.g.alchemy.com/v2/${alchemyId}`),
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

---

## 6. Bridge Fee & Time Matrix (Simulated)

Since bridge execution is simulated, fees and times are deterministic:

| From → To | Fee (USD) | Est. Time |
|---|---|---|
| Ethereum → Polygon | $2.50 | 10 min |
| Ethereum → Base | $1.80 | 3 min |
| Ethereum → Arbitrum | $1.80 | 3 min |
| Polygon → Ethereum | $3.00 | 30 min |
| Polygon → Base | $0.50 | 5 min |
| Polygon → Arbitrum | $0.50 | 5 min |
| Base → Ethereum | $2.20 | 7 days* |
| Base → Polygon | $0.50 | 5 min |
| Base → Arbitrum | $0.50 | 5 min |
| Arbitrum → Ethereum | $2.20 | 7 days* |
| Arbitrum → Polygon | $0.50 | 5 min |
| Arbitrum → Base | $0.50 | 5 min |

> *7-day withdrawal period is the real Optimistic Rollup challenge period. In simulation, status progresses to `completed` after 10 seconds.

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
| Input validation | All API inputs validated with Zod |
| Wallet auth | No real auth — wallet address used as identifier |
| Database | No sensitive financial data — all tx are simulated |
| CORS | Next.js default (same-origin for API routes) |
| Private keys | Never stored — wallet manages its own keys |

> For a production system, add: rate limiting per wallet, authentication via SIWE (Sign-In with Ethereum), PostgreSQL with connection pooling, and audit logging.
