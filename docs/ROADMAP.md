# Roadmap — PayFlow Crypto

**Version:** 1.0
**Last Updated:** 2026-06-16

---

## Overview

| Phase | Focus | Duration | Status |
|---|---|---|---|
| Phase 1 | Foundation — project setup, wallet connect, dashboard | Day 1–2 | 🔜 Not Started |
| Phase 2 | Onramp — fiat to crypto simulation | Day 3 | 🔜 Not Started |
| Phase 3 | Swap — real 1inch integration | Day 4–5 | 🔜 Not Started |
| Phase 4 | Bridge — cross-chain simulation | Day 6 | 🔜 Not Started |
| Phase 5 | Workflow Builder — composable flows | Day 7–9 | 🔜 Not Started |
| Phase 6 | Polish & Deploy | Day 10 | 🔜 Not Started |

---

## Phase 1 — Foundation

**Goal:** A running Next.js app where user can connect a wallet and see their balance.

### Tasks

- [x] Initialize Next.js 15 project with TypeScript
  ```bash
  npx create-next-app@latest payflow-crypto --typescript --tailwind --app --src-dir
  ```
- [x] Install all dependencies from `package.json`
- [x] Setup `.env.local` with all API keys
- [x] Configure wagmi + RainbowKit in `src/lib/wagmi.ts`
- [x] Create `Web3Provider` in `src/components/providers/Web3Provider.tsx`
- [x] Wrap root `layout.tsx` with `Web3Provider`
- [x] Create `WalletButton` component using RainbowKit's `ConnectButton`
- [x] Create `Navbar` with wallet button
- [x] Create `Sidebar` with navigation links
- [x] Create `src/lib/chains.ts` with all supported chains and tokens
- [x] Create `src/types/index.ts` with all TypeScript types
- [x] Create `src/lib/utils.ts` with `cn()`, `formatAmount()`, `shortenAddress()`
- [x] Setup Prisma: `npx prisma init`, write schema, `npx prisma db push`
- [x] Create Prisma singleton in `src/lib/db.ts`
- [x] Create Dashboard page (`src/app/page.tsx`):
  - Display connected wallet address
  - Display ETH balance via `useBalance()`
  - Display top ERC-20 balances via `useReadContract()`
  - Display portfolio USD value via `/api/prices`
- [x] Create `/api/prices` route (CoinGecko proxy with 60s cache)
- [x] Create `useTokenPrices` hook

### Acceptance Criteria
- [x] `npm run dev` starts without errors
- [x] MetaMask can connect and disconnect
- [x] Dashboard shows real ETH balance from connected wallet
- [x] Dashboard shows USD value of holdings
- [x] TypeScript compiles with zero errors (`npx tsc --noEmit`)

---

## Phase 2 — Onramp

**Goal:** User can simulate buying crypto with fiat and see it in transaction history.

### Tasks

- [x] Create `OnrampForm` component (`src/components/onramp/OnrampForm.tsx`):
  - Fiat currency selector (USD / IDR)
  - Fiat amount input with validation
  - Crypto token selector (USDC / ETH / MATIC)
  - Chain selector
  - Real-time quote display
  - Confirm button
- [x] Create `POST /api/onramp/quote` route:
  - Validate input with Zod (`OnrampQuoteSchema`)
  - Fetch ETH/USDC price from CoinGecko
  - Calculate crypto amount, fees, exchange rate
  - Return `OnrampQuote` object
- [x] Create `POST /api/onramp/execute` route:
  - Validate input
  - Save `Transaction` to DB (type: "onramp", status: "completed")
  - Generate simulated tx hash
  - Return transaction ID
- [x] Create `useOnrampQuote` hook with 30s auto-refresh
- [x] Create Onramp page (`src/app/onramp/page.tsx`)
- [x] Create Transaction History page (`src/app/history/page.tsx`):
  - Fetch from `GET /api/transactions`
  - Show onramp transactions with status
- [x] Create `GET /api/transactions` route with pagination and filtering
- [x] Create `TransactionTable` component

### Acceptance Criteria
- [x] Quote updates when fiat amount changes
- [x] Fee breakdown shows platform fee + network fee
- [x] Confirming saves transaction to DB
- [x] Transaction appears in history page immediately
- [x] Amount below $10 shows validation error

---

## Phase 3 — Swap

**Goal:** User can get real swap quotes from 1inch and simulate execution.

### Tasks

- [x] Setup 1inch API client in `src/lib/oneinch.ts`:
  - `getSwapQuote(params)` function
  - Handle 1inch error responses
  - TypeScript types for 1inch API response
- [ ] Create `GET /api/swap/quote` route:
  - Validate query params with Zod
  - Proxy to 1inch API
  - Transform response to `SwapQuote` type
- [ ] Create `POST /api/swap/execute` route:
  - Validate input
  - Save Transaction to DB
  - Return transaction ID
- [ ] Create `useSwapQuote` hook:
  - 500ms debounce on amount input
  - 15s auto-refresh
  - Cancel previous request on new input
- [ ] Create `TokenSelector` component (`src/components/shared/TokenSelector.tsx`):
  - Shows token logo, symbol, name
  - Shows user's balance for each token
  - Searchable dropdown
- [ ] Create `SwapForm` component (`src/components/swap/SwapForm.tsx`):
  - From token + amount input
  - To token display (read-only)
  - Quote details: output amount, price impact, route, gas
  - Price impact warning (yellow > 1%, red > 3%)
  - Slippage settings
  - Swap button (disabled if no wallet, insufficient balance, same token)
- [ ] Create `useTokenBalance` hook (reads on-chain ERC-20 balance)
- [ ] Create Swap page (`src/app/swap/page.tsx`)

### Acceptance Criteria
- [ ] Quotes fetch from real 1inch API (not mocked)
- [ ] Quote shows DEX routing (e.g., "80% Uniswap V3 + 20% Curve")
- [ ] Price impact warning appears when impact > 1%
- [ ] Quote auto-refreshes every 15 seconds
- [ ] Swap disabled when same token selected on both sides
- [ ] Completed swap appears in history

---

## Phase 4 — Bridge

**Goal:** User can simulate bridging assets between chains with realistic status progression.

### Tasks

- [ ] Create bridge fee matrix in `src/lib/bridge.ts` (all 12 supported routes)
- [ ] Create `POST /api/bridge/quote` route:
  - Validate input
  - Look up fee matrix
  - Return `BridgeQuote`
- [ ] Create `POST /api/bridge/execute` route:
  - Validate input
  - Save Transaction to DB (status: "pending")
  - Trigger simulated status progression (setTimeout chain):
    - After 3s: update to "processing"
    - After 10s: update to "completed"
  - Return transaction ID
- [ ] Create `ChainSelector` component (`src/components/shared/ChainSelector.tsx`)
- [ ] Create `BridgeForm` component (`src/components/bridge/BridgeForm.tsx`):
  - Source chain + token selector
  - Destination chain selector
  - Amount input
  - Quote: received amount, fee, estimated time
  - Cannot select same chain on both sides
- [ ] Create `useBridgeQuote` hook
- [ ] Create Bridge page (`src/app/bridge/page.tsx`)
- [ ] Update Transaction History to show bridge status with live polling:
  - Poll `GET /api/transactions/:id` every 3s for "pending" / "processing" transactions
  - Show status badge with animation

### Acceptance Criteria
- [ ] All 12 bridge routes work (6 chain pairs × 2 directions)
- [ ] Cannot bridge to same chain (validation error)
- [ ] Bridge status progressively updates: pending → processing → completed
- [ ] Estimated time shown correctly per route (e.g., 3 min for Ethereum→Base)

---

## Phase 5 — Workflow Builder

**Goal:** User can compose multi-step flows and execute them end-to-end.

### Tasks

- [ ] Create workflow step handlers in `src/app/api/workflow/handlers.ts`:
  - `executeOnrampStep()`
  - `executeSwapStep()`
  - `executeBridgeStep()`
  - `executeTransferStep()`
- [ ] Create workflow execution engine in `src/app/api/workflow/engine.ts`:
  - `validateWorkflow()` — Zod + dependency graph validation
  - `executeWorkflow()` — sequential step runner
  - `buildExecutionOrder()` — topological sort
  - `hasCycle()` — circular dependency detection
- [ ] Create `POST /api/workflow/execute` route
- [ ] Create `GET /api/workflow/[id]/status` route
- [ ] Create `useWorkflow` hook:
  - Step management (add, remove, reorder, update)
  - Execution trigger
  - Status polling (2s interval until completed/failed)
- [ ] Create `WorkflowStep` component (`src/components/workflow/WorkflowStep.tsx`):
  - Step type icon + label
  - Collapsible config form
  - Status indicator (pending/running/completed/failed)
  - Remove button
  - Move up/down buttons
- [ ] Create `WorkflowBuilder` component (`src/components/workflow/WorkflowBuilder.tsx`):
  - Add Step dropdown
  - List of WorkflowStep cards
  - Workflow summary (total fee, total time)
  - Run Workflow button
  - Save as Template button
  - Load Template dropdown
- [ ] Create `WorkflowStatus` component (`src/components/workflow/WorkflowStatus.tsx`):
  - Live step-by-step progress display
  - Error message on failure
  - Success summary on completion
- [ ] Create `WorkflowExecution` DB model queries
- [ ] Create `WorkflowTemplate` DB model queries
- [ ] Add 3 preset templates to `src/lib/workflowTemplates.ts`
- [ ] Create Workflow page (`src/app/workflow/page.tsx`)

### Acceptance Criteria
- [ ] Can add up to 10 steps
- [ ] Can remove and reorder steps
- [ ] Each step has correct config form
- [ ] Workflow validates before execution (shows errors)
- [ ] Steps execute sequentially with live status updates
- [ ] If step 2 fails, step 3 does not run
- [ ] Error message shows which step failed and why
- [ ] Can save workflow as named template
- [ ] Can load saved template and edit it
- [ ] All 3 preset templates execute successfully

---

## Phase 6 — Polish & Deploy

**Goal:** Production-ready app deployed on Vercel with clean README.

### Tasks

- [ ] Audit all TypeScript types (`npx tsc --noEmit` zero errors)
- [ ] Audit all API routes for missing Zod validation
- [ ] Add loading states to all data-fetching components
- [ ] Add empty states to transaction history and workflow template list
- [ ] Add error boundaries to all pages
- [ ] Responsive design check (works on 375px mobile width)
- [ ] Add `TransactionStatus` component for showing tx hash + explorer link
- [ ] Create `README.md` with:
  - Project description + screenshot
  - Architecture diagram
  - Tech stack table
  - Setup instructions
  - Live demo link
  - Key design decisions
- [ ] Create `next.config.ts` with security headers
- [ ] Deploy to Vercel:
  - Connect GitHub repo
  - Set all environment variables in Vercel dashboard
  - Verify deployment at `https://payflow-crypto.vercel.app`
- [ ] Smoke test all features on production URL

### Acceptance Criteria
- [ ] Live URL accessible without setup
- [ ] Zero TypeScript errors
- [ ] Zero console errors in browser
- [ ] All 5 pages load and function correctly
- [ ] Wallet connects on first try
- [ ] README has live demo link and architecture explanation

---

## Status Legend

| Symbol | Meaning |
|---|---|
| 🔜 Not Started | Phase not yet begun |
| 🔄 In Progress | Currently being worked on |
| ✅ Completed | All acceptance criteria met |
| ⚠️ Blocked | Waiting on something external |
