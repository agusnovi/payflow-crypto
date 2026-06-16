# CLAUDE.md — Agent Context for PayFlow Crypto

> Read this file completely before touching any code. Every decision you make must align with the rules defined here.

---

## 1. What Is This Project

**PayFlow Crypto** is a portfolio project built to demonstrate deep understanding of crypto payment gateway architecture for a Senior Software Engineer application at [Halliday](https://halliday.xyz) — a blockchain company building a unified cross-chain payments ecosystem.

PayFlow is a simplified implementation of Halliday Payments, supporting:
- **Onramp** — convert fiat (USD/IDR) into crypto (USDC, ETH)
- **Swap** — exchange one token for another on the same chain
- **Bridge** — move assets across different blockchains
- **Workflow Builder** — compose multiple steps into a single automated payment flow (inspired by Halliday's Workflow Protocol)

The project is intentionally scoped for portfolio demonstration. Onramp and Bridge are simulated; Swap uses real 1inch API quotes.

---

## 2. Tech Stack (Exact Versions)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.1.0 |
| Language | TypeScript | ^5 |
| Web3 Library | viem | ^2.21.58 |
| Web3 React Hooks | wagmi | ^2.14.9 |
| Wallet UI | RainbowKit | ^2.2.3 |
| Styling | TailwindCSS | ^3.4.1 |
| Database ORM | Prisma | ^5.22.0 |
| Database | SQLite (dev) | via Prisma |
| Data Fetching | TanStack Query | ^5.62.10 |
| Validation | Zod | ^3.24.1 |
| Icons | Lucide React | ^0.468.0 |
| Runtime | Node.js | >=20 |
| Package Manager | npm | latest |
| Deployment | Vercel | - |

**External APIs:**
| Service | Purpose | Docs |
|---|---|---|
| Alchemy | RPC provider (Ethereum, Base, Polygon, Arbitrum) | https://docs.alchemy.com |
| 1inch | Swap quote aggregation | https://portal.1inch.dev |
| CoinGecko | Token price in USD/IDR | https://docs.coingecko.com |
| Reown (WalletConnect) | Wallet relay server | https://dashboard.reown.com |

---

## 3. Project Structure

```
payflow-crypto/
├── CLAUDE.md                          ← YOU ARE HERE
├── .env.example                       ← copy to .env.local, fill all values
├── .env.local                         ← never commit this
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── prisma/
│   ├── schema.prisma                  ← database schema (source of truth)
│   └── dev.db                        ← sqlite file (git-ignored)
├── docs/
│   ├── PRD.md                        ← product requirements
│   ├── ARCHITECTURE.md               ← system design & data flow
│   ├── API_SPEC.md                   ← all API endpoints
│   ├── DATABASE.md                   ← schema detail & query patterns
│   ├── WORKFLOW_PROTOCOL.md          ← workflow engine deep-dive
│   ├── CONVENTIONS.md                ← coding rules (READ THIS TOO)
│   ├── ROADMAP.md                    ← build phases & status
│   └── GLOSSARY.md                   ← crypto terminology
└── src/
    ├── app/                           ← Next.js App Router pages
    │   ├── layout.tsx                 ← root layout, wraps Web3Provider
    │   ├── page.tsx                   ← dashboard / home
    │   ├── onramp/page.tsx            ← fiat → crypto UI
    │   ├── swap/page.tsx              ← token swap UI
    │   ├── bridge/page.tsx            ← cross-chain UI
    │   ├── workflow/page.tsx          ← workflow builder UI
    │   ├── history/page.tsx           ← transaction history UI
    │   └── api/                       ← backend API routes
    │       ├── onramp/route.ts        ← POST /api/onramp/quote
    │       ├── swap/route.ts          ← GET /api/swap/quote
    │       ├── bridge/route.ts        ← POST /api/bridge/quote
    │       ├── workflow/
    │       │   ├── route.ts           ← POST /api/workflow/execute
    │       │   └── [id]/
    │       │       └── route.ts       ← GET /api/workflow/:id/status
    │       ├── transactions/
    │       │   └── route.ts           ← GET/POST /api/transactions
    │       └── prices/route.ts        ← GET /api/prices (CoinGecko proxy)
    ├── components/
    │   ├── providers/
    │   │   └── Web3Provider.tsx       ← wagmi + RainbowKit + TanStack Query
    │   ├── layout/
    │   │   ├── Navbar.tsx
    │   │   └── Sidebar.tsx
    │   ├── ui/                        ← reusable primitives (Button, Input, Card, Badge, Spinner)
    │   ├── wallet/
    │   │   └── WalletButton.tsx       ← connect wallet button
    │   ├── shared/
    │   │   ├── TokenSelector.tsx      ← token picker dropdown
    │   │   ├── ChainSelector.tsx      ← chain picker dropdown
    │   │   └── TransactionStatus.tsx  ← tx hash + status display
    │   ├── onramp/
    │   │   └── OnrampForm.tsx
    │   ├── swap/
    │   │   └── SwapForm.tsx
    │   ├── bridge/
    │   │   └── BridgeForm.tsx
    │   ├── workflow/
    │   │   ├── WorkflowBuilder.tsx    ← main builder component
    │   │   ├── WorkflowStep.tsx       ← single step card
    │   │   └── WorkflowStatus.tsx     ← execution status display
    │   └── history/
    │       └── TransactionTable.tsx
    ├── hooks/
    │   ├── useTokenBalance.ts         ← read ERC-20 + native balance on-chain
    │   ├── useTokenPrices.ts          ← fetch USD prices from /api/prices
    │   ├── useSwapQuote.ts            ← debounced 1inch quote fetching
    │   ├── useOnrampQuote.ts          ← quote from /api/onramp/quote
    │   ├── useBridgeQuote.ts          ← quote from /api/bridge/quote
    │   └── useWorkflow.ts             ← workflow state machine + execution
    ├── lib/
    │   ├── wagmi.ts                   ← wagmi config (chains + connectors)
    │   ├── chains.ts                  ← SUPPORTED_CHAINS + COMMON_TOKENS
    │   ├── db.ts                      ← Prisma client singleton
    │   ├── prices.ts                  ← CoinGecko API client
    │   ├── oneinch.ts                 ← 1inch API client
    │   └── utils.ts                   ← formatAmount, shortenAddress, cn()
    └── types/
        └── index.ts                   ← all shared TypeScript types (source of truth)
```

---

## 4. Environment Variables

Copy `.env.example` to `.env.local` and fill all values before running.

```bash
# Required
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # from dashboard.reown.com
NEXT_PUBLIC_ALCHEMY_ID=                 # from alchemy.com
ONEINCH_API_KEY=                        # from portal.1inch.dev
COINGECKO_API_KEY=                      # from coingecko.com/en/api
DATABASE_URL="file:./dev.db"

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never put secret keys in `NEXT_PUBLIC_` variables.

---

## 5. How to Run

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env.local
# fill .env.local with your API keys

# 3. Setup database
npx prisma db push

# 4. Run development server
npm run dev
# → http://localhost:3000

# 5. (Optional) Open Prisma Studio to inspect DB
npm run db:studio
```

---

## 6. Key Concepts (Project-Specific)

### Onramp (Simulated)
- User inputs fiat amount + currency (USD/IDR)
- Backend calculates crypto amount using CoinGecko price + fee
- Transaction is saved to DB with status `completed` (simulation — no real fiat charged)
- No real payment provider integrated (Moonpay etc. would be the real equivalent)

### Swap (Real Quotes, Simulated Execution)
- Uses real 1inch API to get live swap quotes
- User sees real market price, price impact, route
- Execution is simulated on testnet or mocked — no mainnet funds required
- Quote expires after 30 seconds; UI must re-fetch

### Bridge (Simulated)
- Both quote and execution are simulated
- Fee and time estimates are deterministic based on chain pair
- Saves transaction to DB with realistic status progression: `pending` → `processing` → `completed`

### Workflow
- Composed of ordered steps: each step is onramp, swap, bridge, or transfer
- Each step has `params` and `dependsOn` (array of step IDs)
- Execution is sequential by default; parallel execution not supported in v1
- If a step fails, workflow halts and marks itself `failed` — no automatic rollback
- See `docs/WORKFLOW_PROTOCOL.md` for the full execution engine spec

---

## 7. Coding Rules (Summary)

> Full rules in `docs/CONVENTIONS.md`. These are the non-negotiables:

1. **Never use `any` in TypeScript.** Use `unknown` and narrow with Zod or type guards.
2. **All API responses must follow the standard shape:** `{ success: boolean, data?: T, error?: string }`
3. **All server-side errors must be caught** — never let an unhandled promise rejection reach the client.
4. **Components must not call Prisma directly** — only API routes interact with the database.
5. **Hooks must not contain JSX** — keep logic and UI strictly separated.
6. **All monetary amounts are stored and transmitted as strings** (to avoid floating-point precision loss). Format only at display time using `formatAmount()` from `lib/utils.ts`.
7. **Chain IDs are always numbers** (`1`, `137`, `8453`) — never strings.
8. **Token amounts are always in the smallest unit (wei)** when passed between backend and frontend. Convert to human-readable only in the UI layer.

---

## 8. What NOT To Do

- Do NOT call external APIs (Alchemy, 1inch, CoinGecko) from frontend components directly — proxy through `/api/*` routes to protect API keys.
- Do NOT store private keys or seed phrases anywhere in the codebase.
- Do NOT use `localStorage` for sensitive data (wallet state is managed by wagmi).
- Do NOT create new TypeScript types without checking `src/types/index.ts` first — extend existing types where possible.
- Do NOT skip Zod validation on API route inputs — always validate `request.json()` before using it.
- Do NOT hardcode chain RPC URLs — always use the Alchemy URL from environment variables.
- Do NOT implement real money movement — this is a portfolio/demo project.

---

## 9. Supported Chains

| Chain | ID | Native Token | Status |
|---|---|---|---|
| Ethereum | 1 | ETH | ✅ Supported |
| Polygon | 137 | MATIC | ✅ Supported |
| Base | 8453 | ETH | ✅ Supported |
| Arbitrum | 42161 | ETH | ✅ Supported |
| Optimism | 10 | ETH | 🔜 Phase 2 |
| BNB Chain | 56 | BNB | 🔜 Phase 2 |

---

## 10. Docs Index

| Document | Read When |
|---|---|
| `docs/PRD.md` | Need to understand what features to build and why |
| `docs/ARCHITECTURE.md` | Need to understand how the system fits together |
| `docs/API_SPEC.md` | Building or consuming any API route |
| `docs/DATABASE.md` | Working with Prisma, writing queries, changing schema |
| `docs/WORKFLOW_PROTOCOL.md` | Working on the Workflow Builder feature |
| `docs/CONVENTIONS.md` | Before writing any new file or component |
| `docs/ROADMAP.md` | Checking what's done and what's next |
| `docs/GLOSSARY.md` | Unsure about a crypto or project-specific term |
