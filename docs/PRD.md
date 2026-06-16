# Product Requirements Document — PayFlow Crypto

**Version:** 1.0
**Last Updated:** 2026-06-16
**Status:** Active

---

## 1. Problem Statement

Interacting with multiple blockchains today requires users to navigate several separate platforms to complete a single payment goal. For example, converting fiat to crypto and sending it to a different chain involves:

1. Buying crypto on an onramp provider (Moonpay, Ramp)
2. Swapping to the desired token on a DEX (Uniswap, 1inch)
3. Bridging to the destination chain (Stargate, Across)
4. Executing the final transfer

Each step lives on a different platform, requires separate wallet approvals, and has no shared state — if step 3 fails, the user must manually recover from step 2. This fragmentation creates a poor user experience and is a major barrier to crypto adoption.

**PayFlow** solves this by providing a unified interface where users can perform onramp, swap, bridge, and transfer operations — individually or composed into a single automated workflow.

---

## 2. Goals

| Goal | Description |
|---|---|
| **Learning** | Demonstrate deep understanding of crypto payment gateway architecture |
| **Portfolio** | Serve as a live, deployable demo for Halliday Senior SWE application |
| **Engineering** | Show production-quality code: type safety, error handling, scalable API design |
| **Domain** | Prove understanding of cross-chain concepts: chains, tokens, gas, liquidity |

---

## 3. Non-Goals (Out of Scope)

- Real fiat payment processing (no Moonpay/Stripe integration)
- Real bridge protocol integration (no Stargate, Across, LayerZero)
- Mainnet token spending (no real user funds at risk)
- User authentication / accounts (wallet address is the identity)
- Mobile app
- Admin dashboard
- Multi-language support

---

## 4. Target Users

**Primary:** Halliday interviewers and technical reviewers evaluating the candidate's crypto engineering skills.

**Secondary:** Developers learning how a crypto payment gateway works, used as a reference implementation.

---

## 5. Features

### Priority Levels
- **P0** — Must have. Project is incomplete without it.
- **P1** — Should have. Significantly improves value.
- **P2** — Nice to have. Can be deferred to later phases.

---

### 5.1 Wallet Connection (P0)

Allow users to connect their crypto wallet to the app.

**Acceptance Criteria:**
- [ ] User can connect MetaMask browser extension
- [ ] User can connect any WalletConnect-compatible mobile wallet via QR code
- [ ] Connected state shows: wallet address (shortened), ETH balance, current chain
- [ ] User can disconnect wallet
- [ ] User can switch chains from within the app
- [ ] Wallet state persists across page refreshes (wagmi handles this)
- [ ] If no wallet is connected, all action pages show a "Connect Wallet" prompt

---

### 5.2 Dashboard (P0)

Home page showing wallet summary and quick access to all features.

**Acceptance Criteria:**
- [ ] Displays connected wallet address
- [ ] Displays native token balance (ETH/MATIC/BNB depending on chain)
- [ ] Displays top 3 ERC-20 token balances with USD value
- [ ] Displays total portfolio value in USD
- [ ] Shows recent transactions (last 5) with status
- [ ] Quick-action buttons to Onramp, Swap, Bridge, Workflow

---

### 5.3 Onramp (P0)

Simulate conversion of fiat currency (USD/IDR) into crypto.

**Acceptance Criteria:**
- [ ] User selects fiat currency (USD or IDR)
- [ ] User inputs fiat amount (minimum $10 / Rp 100.000)
- [ ] User selects output crypto token (USDC, ETH, MATIC)
- [ ] User selects destination chain (Ethereum, Polygon, Base, Arbitrum)
- [ ] App displays real-time quote: crypto amount, exchange rate, fee breakdown
- [ ] Quote refreshes every 30 seconds automatically
- [ ] User confirms transaction
- [ ] Transaction saved to DB with status `completed` (simulated)
- [ ] User sees success screen with tx details
- [ ] Validation: amount must be within min/max range ($10–$10,000)

**Fee Structure (Simulated):**
- Platform fee: 1.5% of fiat amount
- Network fee: fixed $1.00 equivalent
- Exchange rate: from CoinGecko API

---

### 5.4 Token Swap (P0)

Exchange one crypto token for another on the same blockchain using real 1inch quotes.

**Acceptance Criteria:**
- [ ] User selects source token and amount
- [ ] User selects destination token
- [ ] App fetches real quote from 1inch API
- [ ] Quote shows: output amount, price impact, route (which DEXes), estimated gas
- [ ] Price impact warning shown if > 1% (yellow) or > 3% (red)
- [ ] User can set custom slippage tolerance (default 0.5%, range 0.1%–5%)
- [ ] Quote auto-refreshes every 15 seconds
- [ ] User confirms swap
- [ ] Transaction is simulated (no mainnet execution) and saved to DB
- [ ] Swap disabled if: wallet not connected, insufficient balance, same token selected
- [ ] Token list shows user's current balances next to each token

---

### 5.5 Bridge (P1)

Simulate moving crypto assets from one blockchain to another.

**Acceptance Criteria:**
- [ ] User selects source chain and token
- [ ] User selects destination chain
- [ ] App shows simulated quote: received amount, bridge fee, estimated time
- [ ] Bridge fee and time are deterministic per chain pair (see `docs/ARCHITECTURE.md`)
- [ ] User confirms bridge
- [ ] Transaction saved to DB with status `pending`
- [ ] Status automatically progresses: `pending` → `processing` → `completed` (simulated with delays)
- [ ] User sees live status update on history page
- [ ] Cannot bridge to same chain

**Supported Bridge Routes (Phase 1):**
- Ethereum ↔ Polygon
- Ethereum ↔ Base
- Ethereum ↔ Arbitrum
- Polygon ↔ Base
- Polygon ↔ Arbitrum
- Base ↔ Arbitrum

---

### 5.6 Workflow Builder (P0 — Key Feature)

Compose multiple payment actions (onramp, swap, bridge, transfer) into a single automated flow, inspired by Halliday's Workflow Protocol.

**Acceptance Criteria:**
- [ ] User can add steps from: Onramp, Swap, Bridge, Transfer
- [ ] User can reorder steps via drag-and-drop or up/down buttons
- [ ] User can remove any step
- [ ] Each step has a configuration form (same fields as individual pages)
- [ ] App validates the full workflow before execution (chain continuity, token availability)
- [ ] Workflow preview shows: total estimated fee, total estimated time, step-by-step summary
- [ ] User can save workflow as a named template
- [ ] User can load a saved template
- [ ] Execution runs steps sequentially
- [ ] Each step shows live status: `pending` → `running` → `completed` / `failed`
- [ ] If a step fails, workflow halts at that step with error message
- [ ] No automatic rollback of completed steps (v1 limitation — must be documented)
- [ ] Completed workflow is saved to DB as a single transaction record

**Preset Templates (to demonstrate capability):**
1. "Onramp to Base" — Onramp USD→USDC on Ethereum → Bridge to Base
2. "Cross-chain Swap" — Onramp USD→ETH on Ethereum → Swap ETH→USDC → Bridge USDC to Polygon
3. "Full Flow" — Onramp → Swap → Bridge → Transfer to another address

---

### 5.7 Transaction History (P1)

View all past transactions across all feature types.

**Acceptance Criteria:**
- [ ] Lists all transactions for the connected wallet address
- [ ] Columns: type, from/to token, amount, chain, status, date
- [ ] Filter by type (onramp/swap/bridge/workflow)
- [ ] Filter by status (pending/processing/completed/failed)
- [ ] Each transaction links to blockchain explorer (for simulated tx, show mock hash)
- [ ] Pagination: 20 items per page
- [ ] Empty state when no transactions

---

### 5.8 Token Prices (P2)

Display real-time token prices throughout the app.

**Acceptance Criteria:**
- [ ] Prices fetched from CoinGecko via `/api/prices` (backend proxy)
- [ ] Prices cached for 60 seconds to avoid rate limiting
- [ ] Supported tokens: ETH, MATIC, BNB, USDC, USDT, WBTC
- [ ] Prices shown in USD and IDR

---

## 6. User Stories

### Wallet
- As a user, I want to connect my MetaMask so I can use the app without creating an account.
- As a user, I want to see my ETH balance after connecting so I know how much I have.
- As a user, I want to disconnect my wallet so I can switch to a different wallet.

### Onramp
- As a user, I want to convert $100 USD to USDC on Polygon so I can use it in DeFi.
- As a user, I want to see the exact fee before confirming so there are no surprises.
- As a user, I want to see my converted crypto in my history after the transaction.

### Swap
- As a user, I want to swap 0.1 ETH to USDC so I can lock in my value.
- As a user, I want to see price impact before swapping so I know if I'm getting a fair deal.
- As a user, I want the quote to auto-refresh so I always see the current rate.

### Bridge
- As a user, I want to move my ETH from Ethereum to Base so I can use cheaper gas.
- As a user, I want to know how long the bridge will take before I start.
- As a user, I want to track my bridge progress without refreshing the page.

### Workflow
- As a user, I want to onramp $50 USD, swap to ETH, and bridge to Base in one click, so I don't have to use three different apps.
- As a user, I want to save my workflow so I can run it again next time.
- As a user, I want to see which step is currently running so I know the progress.
- As a user, I want to know exactly which step failed so I can troubleshoot.

---

## 7. Success Metrics

Since this is a portfolio project, success is measured by:

| Metric | Target |
|---|---|
| App deploys without errors on Vercel | ✅ Required |
| Wallet connects on first try | ✅ Required |
| Swap page shows real 1inch quotes | ✅ Required |
| Workflow executes 3-step flow end-to-end | ✅ Required |
| TypeScript compiles with zero errors | ✅ Required |
| No `any` types in codebase | ✅ Required |
| All API routes have Zod validation | ✅ Required |
| README explains architecture clearly | ✅ Required |
| Live demo URL shareable in 1 click | ✅ Required |
