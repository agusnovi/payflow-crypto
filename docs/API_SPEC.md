# API Specification — PayFlow Crypto

**Version:** 1.1
**Base URL:** `http://localhost:3000` (dev) / `https://payflow-crypto.vercel.app` (prod)
**Content-Type:** `application/json` for all requests and responses

---

## Standard Response Shape

Every API endpoint returns this envelope:

```typescript
// Success
{ "success": true, "data": <T> }

// Error
{ "success": false, "error": "<human-readable message>" }
```

HTTP status codes:
- `200` — success
- `400` — validation error (bad input)
- `404` — resource not found
- `500` — internal server error (external API failure, DB error)

---

## Endpoints

---

### 1. Onramp

#### `POST /api/onramp/quote`

Calculate how much crypto the user receives for a given fiat amount.

**Request Body:**
```json
{
  "fiatAmount": 100,
  "fiatCurrency": "USD",
  "cryptoSymbol": "USDC",
  "chainId": 137,
  "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `fiatAmount` | `number` | ✅ | min: 10, max: 10000 |
| `fiatCurrency` | `"USD" \| "IDR"` | ✅ | enum |
| `cryptoSymbol` | `"USDC" \| "ETH" \| "MATIC"` | ✅ | enum |
| `chainId` | `1 \| 137 \| 8453 \| 42161` | ✅ | enum |
| `walletAddress` | `string` | ✅ | valid Ethereum address (0x..., 42 chars) |

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "fiatAmount": 100,
    "fiatCurrency": "USD",
    "cryptoAmount": "98500000",
    "cryptoSymbol": "USDC",
    "cryptoAmountFormatted": "98.50",
    "chainId": 137,
    "exchangeRate": 1.0,
    "platformFee": 1.5,
    "networkFee": 1.0,
    "totalFee": 2.5,
    "provider": "PayFlow Simulated",
    "expiresAt": 1718500000
  }
}
```

> `cryptoAmount` is in the token's smallest unit (USDC has 6 decimals → `98500000` = 98.50 USDC).

**Error Responses:**
```json
// 400 - Validation error
{ "success": false, "error": "fiatAmount must be at least 10" }

// 500 - Price fetch failed
{ "success": false, "error": "Unable to fetch exchange rate. Please try again." }
```

**curl example:**
```bash
curl -X POST http://localhost:3000/api/onramp/quote \
  -H "Content-Type: application/json" \
  -d '{"fiatAmount":100,"fiatCurrency":"USD","cryptoSymbol":"USDC","chainId":137,"walletAddress":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'
```

---

#### `POST /api/onramp/execute`

Execute the onramp: server recalculates the crypto amount server-side, broadcasts a real transaction from the treasury wallet to the user's wallet on the selected testnet, and saves to DB.

**Request Body:**
```json
{
  "fiatAmount": 100,
  "fiatCurrency": "USD",
  "cryptoSymbol": "USDC",
  "chainId": 11155111,
  "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
}
```

> `cryptoAmount` is intentionally excluded from the request — the server recalculates it to prevent manipulation. `chainId` must be a testnet chain ID (`11155111`, `84532`, `421614`, `80002`).

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "transactionId": "clxyz123abc",
    "status": "pending",
    "txHash": "0xabc123...",
    "createdAt": "2026-06-16T10:00:00.000Z"
  }
}
```

> `status` starts as `"pending"`. Poll `GET /api/transactions/:id` every 3 seconds until status is `"completed"` or `"failed"`. The `txHash` is a real testnet transaction verifiable on the appropriate testnet block explorer.

**Error Responses:**
```json
// 400 - Unsupported chain (mainnet)
{ "success": false, "error": "chainId 1 is not a supported testnet" }

// 503 - Treasury insufficient balance
{ "success": false, "error": "Treasury balance insufficient. Contact admin." }
```

---

### 2. Swap

#### `GET /api/swap/quote`

Get real swap quote from 1inch aggregator.

**Query Parameters:**

| Param | Type | Required | Example |
|---|---|---|---|
| `fromToken` | `string` | ✅ | `0xEeee...EEeE` (ETH) |
| `toToken` | `string` | ✅ | `0xA0b8...eB48` (USDC) |
| `amount` | `string` | ✅ | `100000000000000000` (0.1 ETH in wei) |
| `chainId` | `number` | ✅ | `1` |
| `walletAddress` | `string` | ✅ | `0xd8dA...6045` |
| `slippage` | `number` | ❌ | `0.5` (default) |

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "fromToken": {
      "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      "symbol": "ETH",
      "name": "Ether",
      "decimals": 18,
      "logoURI": "https://...",
      "chainId": 1
    },
    "toToken": {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "logoURI": "https://...",
      "chainId": 1
    },
    "fromAmount": "100000000000000000",
    "toAmount": "324150000",
    "toAmountFormatted": "324.15",
    "priceImpact": 0.05,
    "fee": 0.3,
    "estimatedGasUSD": "2.30",
    "route": [
      { "protocol": "UNISWAP_V3", "portion": 80 },
      { "protocol": "CURVE", "portion": 20 }
    ],
    "expiresAt": 1718500015
  }
}
```

**Error Responses:**
```json
// 400 - Same token
{ "success": false, "error": "fromToken and toToken cannot be the same" }

// 400 - Amount too small
{ "success": false, "error": "Amount too small for quote" }

// 500 - 1inch API error
{ "success": false, "error": "Swap quote unavailable. Try again in a moment." }
```

**curl example:**
```bash
curl "http://localhost:3000/api/swap/quote?fromToken=0xEeee...EEeE&toToken=0xA0b8...eB48&amount=100000000000000000&chainId=1&walletAddress=0xd8dA...6045"
```

---

#### `POST /api/swap/execute`

Save a completed swap to DB. The frontend (not server) executes the swap transaction — this endpoint only persists the result after the user has signed and broadcast the tx.

**Request Body:**
```json
{
  "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "toToken": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "fromAmount": "100000000000000000",
  "toAmount": "324150000",
  "chainId": 11155111,
  "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "txHash": "0xabc123..."
}
```

> `txHash` is required — this is the real transaction hash from the user's wallet after signing the Uniswap swap. The server does not broadcast anything for swap.

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "transactionId": "clxyz456def",
    "status": "pending",
    "txHash": "0xabc123...",
    "createdAt": "2026-06-16T10:01:00.000Z"
  }
}
```

> Poll `GET /api/transactions/:id` until status is `"completed"` or `"failed"`.

**Error Responses:**
```json
// 400 - Missing txHash
{ "success": false, "error": "txHash is required" }
```

---

### 3. Bridge

#### `POST /api/bridge/quote`

Get a bridge quote for a cross-chain transfer via Chainlink CCIP. Returns the CCIP fee (paid in native token by the user) and estimated transfer time.

**Request Body:**
```json
{
  "fromChain": 11155111,
  "toChain": 84532,
  "token": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "amount": "100000000",
  "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `fromChain` | `number` | ✅ | testnet chainId (11155111, 84532, 421614, 80002) |
| `toChain` | `number` | ✅ | testnet chainId, different from fromChain |
| `token` | `string` | ✅ | valid testnet token address |
| `amount` | `string` | ✅ | positive integer string (wei) |
| `walletAddress` | `string` | ✅ | valid Ethereum address |

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "fromChain": 11155111,
    "toChain": 84532,
    "fromToken": { "symbol": "USDC", "address": "0x1c7D...", "chainId": 11155111 },
    "toToken": { "symbol": "USDC", "address": "0x036C...", "chainId": 84532 },
    "fromAmount": "100000000",
    "toAmount": "100000000",
    "toAmountFormatted": "100.00",
    "ccipFeeWei": "1200000000000000",
    "ccipFeeFormatted": "0.0012 ETH",
    "estimatedSeconds": 900,
    "estimatedTimeFormatted": "~15 minutes",
    "bridgeProtocol": "Chainlink CCIP",
    "expiresAt": 1718500030
  }
}
```

> CCIP fee is paid in native token (ETH) by the user on the source chain. The fee is fetched from the CCIP Router contract. Unlike simulated bridges, CCIP transfers the exact same amount — no bridge fee deducted from the token amount.

**Error Responses:**
```json
// 400 - Same chain
{ "success": false, "error": "fromChain and toChain must be different" }

// 400 - Unsupported CCIP lane
{ "success": false, "error": "CCIP lane from chain 11155111 to chain 80002 is not supported" }
```

---

#### `POST /api/bridge/execute`

Save a bridge transaction to DB after the user has signed and broadcast the CCIP transaction. The frontend (not server) executes the CCIP send — this endpoint persists the result and starts tracking the CCIP message.

**Request Body:**
```json
{
  "fromChain": 11155111,
  "toChain": 84532,
  "token": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "amount": "100000000",
  "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "txHash": "0xabc123..."
}
```

> `txHash` is required — this is the real source-chain transaction hash from the user's MetaMask after signing the CCIP send. The server does not broadcast anything for bridge.

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "transactionId": "clxyz789ghi",
    "status": "pending",
    "txHash": "0xabc123...",
    "estimatedCompletionAt": "2026-06-16T10:17:00.000Z",
    "createdAt": "2026-06-16T10:02:00.000Z"
  }
}
```

> Poll `GET /api/transactions/:id` every 3 seconds. Status goes `"pending"` (source tx confirmed) → `"completed"` (token arrived at destination). The CCIP message ID is stored in `metadata.ccipMessageId` for debugging.

---

### 4. Workflow

#### `POST /api/workflow/execute`

Execute a multi-step workflow sequentially.

**Request Body:**
```json
{
  "name": "Onramp to Base",
  "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "steps": [
    {
      "id": "step_1",
      "type": "onramp",
      "label": "Buy USDC with USD",
      "params": {
        "fiatAmount": 100,
        "fiatCurrency": "USD",
        "cryptoSymbol": "USDC",
        "chainId": 1
      },
      "dependsOn": []
    },
    {
      "id": "step_2",
      "type": "bridge",
      "label": "Bridge USDC to Base",
      "params": {
        "fromChain": 1,
        "toChain": 8453,
        "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "amount": "98500000"
      },
      "dependsOn": ["step_1"]
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | `string` | ✅ | max 100 chars |
| `walletAddress` | `string` | ✅ | valid Ethereum address |
| `steps` | `WorkflowStep[]` | ✅ | min 1, max 10 steps |
| `steps[].id` | `string` | ✅ | unique within workflow |
| `steps[].type` | `"onramp" \| "swap" \| "bridge" \| "transfer"` | ✅ | |
| `steps[].params` | `object` | ✅ | validated per step type |
| `steps[].dependsOn` | `string[]` | ❌ | step IDs that must complete first |

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "workflowId": "clxyz_workflow_001",
    "status": "running",
    "steps": [
      {
        "id": "step_1",
        "type": "onramp",
        "label": "Buy USDC with USD",
        "status": "completed",
        "result": { "transactionId": "clxyz123abc", "cryptoAmount": "98500000" },
        "error": null
      },
      {
        "id": "step_2",
        "type": "bridge",
        "label": "Bridge USDC to Base",
        "status": "running",
        "result": null,
        "error": null
      }
    ],
    "createdAt": "2026-06-16T10:00:00.000Z"
  }
}
```

**Error Responses:**
```json
// 400 - Circular dependency
{ "success": false, "error": "Workflow has circular step dependencies" }

// 400 - Invalid step params
{ "success": false, "error": "Step step_1: fiatAmount is required for onramp" }

// 500 - Step execution failed
{
  "success": false,
  "error": "Workflow failed at step step_2: Bridge route unavailable",
  "data": {
    "workflowId": "clxyz_workflow_001",
    "status": "failed",
    "failedAt": "step_2"
  }
}
```

---

#### `GET /api/workflow/[id]/status`

Poll for live workflow execution status.

**URL Params:** `id` — workflow ID from execute response

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "workflowId": "clxyz_workflow_001",
    "status": "completed",
    "steps": [
      {
        "id": "step_1",
        "type": "onramp",
        "label": "Buy USDC with USD",
        "status": "completed",
        "result": { "transactionId": "clxyz123abc" },
        "error": null
      },
      {
        "id": "step_2",
        "type": "bridge",
        "label": "Bridge USDC to Base",
        "status": "completed",
        "result": { "transactionId": "clxyz789ghi" },
        "error": null
      }
    ],
    "completedAt": "2026-06-16T10:03:00.000Z"
  }
}
```

**Error Response:**
```json
// 404 - Not found
{ "success": false, "error": "Workflow not found" }
```

---

### 5. Transactions

#### `GET /api/transactions`

List all transactions for a wallet with optional filtering.

**Query Parameters:**

| Param | Type | Required | Default |
|---|---|---|---|
| `walletAddress` | `string` | ✅ | - |
| `type` | `"onramp" \| "swap" \| "bridge" \| "workflow"` | ❌ | all |
| `status` | `"pending" \| "processing" \| "completed" \| "failed"` | ❌ | all |
| `page` | `number` | ❌ | `1` |
| `limit` | `number` | ❌ | `20` (max: 100) |

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "clxyz123abc",
        "type": "onramp",
        "status": "completed",
        "fromChain": "Ethereum",
        "toChain": null,
        "fromToken": "USD",
        "toToken": "USDC",
        "fromAmount": "100",
        "toAmount": "98500000",
        "txHash": "0xsimulated_abc123",
        "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        "createdAt": "2026-06-16T10:00:00.000Z",
        "updatedAt": "2026-06-16T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 20,
      "hasMore": true
    }
  }
}
```

---

#### `GET /api/transactions/[id]`

Get a single transaction by ID. When the transaction status is `"pending"`, the server also checks the on-chain receipt via Alchemy RPC and updates the DB status before responding. This makes it safe to use as a polling endpoint.

**Polling behavior:**
- `"pending"` + no on-chain receipt → returns `"pending"` (keep polling)
- `"pending"` + receipt with `status: "success"` → updates DB to `"completed"`, returns `"completed"`
- `"pending"` + receipt with `status: "reverted"` → updates DB to `"failed"`, returns `"failed"`
- `"completed"` or `"failed"` → returns immediately from DB (no on-chain check needed)

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123abc",
    "type": "onramp",
    "status": "completed",
    "fromChain": "Sepolia",
    "toChain": null,
    "fromToken": "USD",
    "toToken": "USDC",
    "fromAmount": "100",
    "toAmount": "98500000",
    "txHash": "0xabc123...",
    "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "metadata": null,
    "createdAt": "2026-06-16T10:00:00.000Z",
    "updatedAt": "2026-06-16T10:00:00.000Z"
  }
}
```

> For bridge transactions, `metadata` contains `ccipMessageId` for debugging on the CCIP explorer.

**Error Response:**
```json
// 404 - Not found
{ "success": false, "error": "Transaction not found" }
```

---

### 6. Prices

#### `GET /api/prices`

Get current token prices in USD and IDR. Proxies CoinGecko and caches for 60 seconds.

**Query Parameters:**

| Param | Type | Required | Example |
|---|---|---|---|
| `tokens` | `string` (comma-separated) | ✅ | `ETH,USDC,MATIC,WBTC` |

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "ETH":  { "usd": 3241.50, "idr": 52100000 },
    "USDC": { "usd": 1.00,    "idr": 16080 },
    "MATIC":{ "usd": 0.52,    "idr": 8362 },
    "WBTC": { "usd": 67500.00,"idr": 1085400000 },
    "cachedAt": "2026-06-16T10:00:00.000Z"
  }
}
```

**Error Response:**
```json
// 500 - CoinGecko unavailable
{ "success": false, "error": "Price data temporarily unavailable" }
```

---

## Zod Validation Schemas

All schemas live in `src/lib/schemas.ts`:

```typescript
export const OnrampQuoteSchema = z.object({
  fiatAmount: z.number().min(10).max(10000),
  fiatCurrency: z.enum(["USD", "IDR"]),
  cryptoSymbol: z.enum(["USDC", "ETH", "MATIC"]),
  chainId: z.union([z.literal(1), z.literal(137), z.literal(8453), z.literal(42161)]),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
})

export const SwapQuoteSchema = z.object({
  fromToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/, "Must be a positive integer string"),
  chainId: z.union([z.literal(1), z.literal(137), z.literal(8453), z.literal(42161)]),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  slippage: z.number().min(0.1).max(5).optional().default(0.5),
})

export const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["onramp", "swap", "bridge", "transfer"]),
  label: z.string().min(1).max(100),
  params: z.record(z.unknown()),
  dependsOn: z.array(z.string()).optional().default([]),
})

export const WorkflowExecuteSchema = z.object({
  name: z.string().min(1).max(100),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  steps: z.array(WorkflowStepSchema).min(1).max(10),
})
```
