# Roadmap — PayFlow Crypto

**Version:** 1.1
**Last Updated:** 2026-06-21

---

## Overview

| Phase | Focus | Status |
|---|---|---|
| Phase 1 | Foundation — setup, wallet, dashboard | ✅ Done (needs testnet updates) |
| Phase 2 | Onramp — treasury-backed testnet execution | ✅ Done (needs testnet updates) |
| Phase 3 | Swap — 1inch quotes + Uniswap V3 Sepolia execution | 🔄 In Progress |
| Phase 4 | Bridge — Chainlink CCIP cross-chain on testnet | 🔜 Not Started |
| Phase 5 | Workflow Builder — composable flows | 🔜 Not Started |
| Phase 6 | Polish & Deploy | 🔜 Not Started |

---

## Build Order — Testnet Implementation

Jangan kerjakan per phase berurutan. Kerjakan per **layer** — setiap layer shared oleh semua fitur.

```
Layer 1 — Foundation (Phase 1 testnet updates)
  types/index.ts + chains.ts + wagmi.ts + dashboard
  → prerequisite untuk semua layer di bawah

Layer 2 — Backend Utilities (shared, build once)
  src/lib/treasury.ts         → dipakai oleh: onramp
  /api/transactions/[id]      → dipakai oleh: onramp, swap, bridge

Layer 3 — Feature Execution (per fitur, setelah Layer 1+2 selesai)
  Onramp execute  → update schema + treasury send
  Swap execute    → update schema + accept txHash + SwapForm signing
  Bridge          → baru (Phase 4)
```

**Urutan konkret saat ini:**
1. Phase 1 testnet updates (Layer 1)
2. `treasury.ts` + `/api/transactions/[id]` (Layer 2)
3. Phase 2 onramp testnet updates (Layer 3a)
4. Phase 3 swap testnet execution (Layer 3b)
5. Phase 4 bridge CCIP (Layer 3c)

---

## Phase 1 — Foundation

**Goal:** A running Next.js app where user can connect a wallet and see their balance.

### Original Tasks (Done ✅)

- [x] Initialize Next.js 15 project with TypeScript
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
- [x] Create Dashboard page (`src/app/page.tsx`)
- [x] Create `/api/prices` route (CoinGecko proxy with 60s cache)
- [x] Create `useTokenPrices` hook

### Testnet Foundation Updates ✅ Done

- [x] `src/types/index.ts` — `ChainId` extended, `MainnetChainId` + `TestnetChainId` added, `OnrampExecuteResult.status` fixed, `BridgeQuote` updated for CCIP
- [x] `src/lib/chains.ts` — 4 testnet chains in `SUPPORTED_CHAINS` + `COMMON_TOKENS`, `isTestnetChainId()` + `isMainnetChainId()` helpers added
- [x] `src/lib/wagmi.ts` — `sepolia`, `baseSepolia`, `arbitrumSepolia`, `polygonAmoy` registered with Alchemy transports
- [x] `.env.example` — `TREASURY_PRIVATE_KEY` added with security warnings
- Dashboard (`src/app/page.tsx`) — no changes needed; `isValidChainId()` and `SUPPORTED_CHAINS` automatically handle testnet after chains.ts update

### Acceptance Criteria
- [x] `npm run dev` starts without errors
- [x] MetaMask can connect and disconnect
- [x] Dashboard shows real ETH balance from connected wallet
- [x] Dashboard shows USD value of holdings
- [x] TypeScript compiles with zero errors (`npx tsc --noEmit`)
- [ ] Switching MetaMask to Sepolia shows correct chain name on dashboard
- [ ] wagmi accepts Sepolia as valid chain without console errors

---

## Phase 2 — Onramp

**Goal:** User can buy crypto with fiat; treasury wallet sends real testnet tokens to user's wallet.

### Original Tasks (Done ✅)

- [x] Create `OnrampForm` component with fiat selector, amount input, token + chain selector, quote display
- [x] Create `POST /api/onramp/quote` route (CoinGecko price, fee calculation, `OnrampQuote`)
- [x] Create `POST /api/onramp/execute` route (saves to DB)
- [x] Create `useOnrampQuote` hook with 30s auto-refresh
- [x] Create Onramp page (`src/app/onramp/page.tsx`)
- [x] Create Transaction History page + `GET /api/transactions` route + `TransactionTable`

### Testnet Updates ✅ Done

- [x] `POST /api/onramp/quote` — chainId updated to testnet IDs, token/chain combo validation added
- [x] `POST /api/onramp/execute` — real treasury send via `sendNative`/`sendERC20`, server recalculates cryptoAmount, $50 cap, status `"pending"`, `chainId` in metadata
- [x] `OnrampForm` — testnet chains in selector, cryptoAmount removed from request, polling every 3s, three UI states (pending/completed/failed), real explorer links

### Acceptance Criteria
- [x] Quote updates when fiat amount changes
- [x] Fee breakdown shows platform fee + network fee
- [x] Amount below $10 shows validation error
- [x] Chain selector shows testnet chains (Sepolia, Base Sepolia, Arbitrum Sepolia, Polygon Amoy)
- [x] Confirming triggers real treasury transaction (not random hash)
- [x] txHash verifiable on correct testnet block explorer
- [x] Status stays "pending" until on-chain confirmed, then shows "completed"
- [x] Transaction appears in history with explorer link

---

## Layer 2 — Backend Utilities ✅ Done

### `src/lib/treasury.ts`
- [x] `getPublicClient(chainId)` — viem publicClient per testnet chain via Alchemy
- [x] `getTreasuryAddress()` — read-only address without signing (no key required)
- [x] `getTreasuryBalance(chainId)` — native balance of treasury address
- [x] `sendNative(to, amountWei, chainId)` — send ETH/MATIC from treasury
- [x] `sendERC20(to, tokenAddress, amountWei, chainId)` — send USDC via `erc20Abi.transfer()`
- [x] Guard: throws if `TREASURY_PRIVATE_KEY` not set

### `src/app/api/transactions/[id]/route.ts`
- [x] `GET /api/transactions/:id` — returns single transaction from DB
- [x] If `status === "pending"` + `txHash` + `metadata.chainId` → calls `getTransactionReceipt`
  - success → DB updated to `"completed"`, returned immediately
  - reverted → DB updated to `"failed"`, returned immediately
  - no receipt yet → silently continues, returns `"pending"` (caller keeps polling)
- [x] Returns `404` if not found

---

## Phase 3 — Swap

**Goal:** User can get real swap quotes from 1inch and execute a real swap on Uniswap V3 Sepolia.

### Foundation (Done ✅)

- [x] Setup 1inch API client in `src/lib/oneinch.ts`
- [x] Create `GET /api/swap/quote` route (proxies 1inch, returns `SwapQuote`)
- [x] Create `POST /api/swap/execute` route (saves to DB)
- [x] Create `useSwapQuote` hook (debounced 500ms, 15s auto-refresh)
- [x] Create `TokenSelector` component
- [x] Create `SwapForm` component (quote display, price impact warning, slippage)
- [x] Create `useTokenBalance` hook
- [x] Create Swap page (`src/app/swap/page.tsx`)

### Testnet Execution (TODO — start here 👇 after Phase 1 updates)

> These tasks upgrade the existing simulation to real Uniswap V3 execution on Sepolia.
> **Prerequisite:** Phase 1 Testnet Foundation Updates harus selesai dulu.
> **Order matters** — do them top to bottom.

**Step 1 — Create `GET /api/transactions/[id]` route:**
- [ ] `src/app/api/transactions/[id]/route.ts` — returns single transaction from DB
- [ ] If status is `"pending"`, check on-chain receipt via Alchemy RPC (viem `getTransactionReceipt`)
- [ ] If receipt found + success → update DB status to `"completed"`, return `"completed"`
- [ ] If receipt found + reverted → update DB status to `"failed"`, return `"failed"`
- [ ] If no receipt → return `"pending"` unchanged

**Step 3 — Update `POST /api/swap/execute` to accept real txHash:**
- [ ] Add `txHash` field to `ExecuteSchema` (required, `0x` hex string)
- [ ] Remove `randomBytes` txHash generation
- [ ] Change `status` from `"completed"` to `"pending"` when saving to DB
- [ ] Update `chainId` enum to accept testnet IDs (`11155111`, etc.)

**Step 4 — Add Uniswap V3 execution in `SwapForm.tsx`:**
- [ ] Add chain detection — show "Switch to Sepolia" button if user is on wrong chain (`useSwitchChain`)
- [ ] Add allowance check — call `useReadContract` on USDC `allowance(owner, spender)` before swap
- [ ] If allowance < fromAmount → call `useWriteContract` for `approve(SwapRouter02, amount)` + wait for confirmation
- [ ] Call `useWriteContract` for `exactInputSingle(params)` on SwapRouter02 Sepolia (`0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`)
- [ ] After swap tx confirmed → call `POST /api/swap/execute` with real `txHash`
- [ ] Poll `GET /api/transactions/:id` every 3 seconds until status is final
- [ ] Show Sepolia Etherscan link (`https://sepolia.etherscan.io/tx/{txHash}`) in success state

**Step 5 — Update transaction history:**
- [ ] `TransactionTable` or History page — link txHash to correct testnet explorer based on chain

### Acceptance Criteria
- [ ] Swap page shows real 1inch quotes (not mocked)
- [ ] Quote shows DEX routing (e.g., "80% Uniswap V3 + 20% Curve")
- [ ] Price impact warning appears when > 1%
- [ ] User on wrong network sees "Switch to Sepolia" button
- [ ] ERC-20 swap: user signs approve tx first, then swap tx (2 popups)
- [ ] ETH swap: user signs only swap tx (1 popup)
- [ ] Real txHash verifiable on Sepolia Etherscan
- [ ] Transaction appears in history with correct status
- [ ] `npx tsc --noEmit` zero errors

---

## Phase 4 — Bridge (Chainlink CCIP)

**Goal:** User can bridge assets between testnets via Chainlink CCIP with real cross-chain transactions.

### Tasks

- [ ] Create `src/lib/bridge.ts`:
  - `CCIP_ROUTERS` — router address per testnet chain
  - `CCIP_CHAIN_SELECTORS` — CCIP chain selector per chain ID
  - `SUPPORTED_CCIP_LANES` — valid source→destination pairs
  - `getCCIPFee(fromChain, toChain, token, amount)` — call `IRouterClient.getFee()` on-chain
- [ ] Create `POST /api/bridge/quote` route:
  - Validate testnet chain IDs with Zod
  - Call `getCCIPFee()` for real fee from CCIP Router
  - Return `BridgeQuote` with `ccipFeeWei`, `estimatedSeconds`, `bridgeProtocol: "Chainlink CCIP"`
- [ ] Create `POST /api/bridge/execute` route:
  - Accept `txHash` from frontend (user's signed CCIP tx)
  - Validate and save Transaction to DB (status: "pending")
  - Extract `ccipMessageId` from tx receipt logs, store in `metadata`
  - Return transaction ID
- [ ] Create `GET /api/transactions/:id` route (if not already):
  - For bridge "pending" tx: check CCIP message status via destination chain or CCIP API
  - Update DB to "completed" when token arrives at destination
- [ ] Create `ChainSelector` component (`src/components/shared/ChainSelector.tsx`):
  - Shows testnet chain name, chain ID
  - Filters to testnet chains only
- [ ] Create `BridgeForm` component (`src/components/bridge/BridgeForm.tsx`):
  - Source testnet chain + token selector
  - Destination testnet chain selector (filters out same chain)
  - Amount input
  - Quote: CCIP fee, estimated time, "Chainlink CCIP" label
  - Frontend logic: check ERC-20 allowance → approve if needed → call `ccipSend`
  - After tx broadcast → POST txHash to `/api/bridge/execute`
- [ ] Create `useBridgeQuote` hook
- [ ] Create Bridge page (`src/app/bridge/page.tsx`)
- [ ] Update Transaction History to show bridge status with live polling:
  - Poll `GET /api/transactions/:id` every 3s for "pending" transactions
  - Show status badge with animation
  - Show link to CCIP explorer (`ccip.chain.link`) using `ccipMessageId` from metadata

### Acceptance Criteria
- [ ] All 6 supported CCIP lanes work (Sepolia ↔ Base/Arbitrum/Amoy, both directions)
- [ ] Cannot bridge to same chain (validation error)
- [ ] Cannot bridge between unsupported chains (e.g., Base Sepolia → Polygon Amoy directly)
- [ ] User prompted to approve ERC-20 if needed before bridge tx
- [ ] CCIP fee shown in ETH before confirmation
- [ ] txHash and ccipMessageId stored in DB
- [ ] Status updates from "pending" to "completed" when token arrives at destination (~15 min)
- [ ] History page shows CCIP explorer link for bridge transactions

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
