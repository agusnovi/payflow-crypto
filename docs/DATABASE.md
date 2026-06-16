# Database — PayFlow Crypto

**Version:** 1.0
**ORM:** Prisma 5.x
**Engine (dev):** SQLite (`prisma/dev.db`)
**Engine (prod):** PostgreSQL (change provider in schema.prisma + DATABASE_URL)

---

## 1. Schema (Source of Truth: `prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"       // change to "postgresql" for production
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// Transaction
// Records every user action: onramp, swap, bridge, or workflow execution
// ─────────────────────────────────────────
model Transaction {
  id            String    @id @default(cuid())
  type          String    // TransactionType enum values
  status        String    // TransactionStatus enum values
  fromChain     String    // chain name string e.g. "Ethereum"
  toChain       String?   // null for onramp and single-chain swap
  fromToken     String    // token symbol or fiat currency e.g. "ETH", "USD"
  toToken       String?   // null when not applicable
  fromAmount    String    // always string to preserve precision
  toAmount      String?   // string or null
  txHash        String?   // simulated tx hash
  walletAddress String    // 0x... Ethereum address
  metadata      String?   // JSON string for extra fields (e.g. fiatCurrency, route)
  workflowId    String?   // set if this tx is part of a workflow
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  workflow      WorkflowExecution? @relation(fields: [workflowId], references: [id])

  @@index([walletAddress])
  @@index([walletAddress, type])
  @@index([walletAddress, status])
  @@index([workflowId])
}

// ─────────────────────────────────────────
// WorkflowTemplate
// Saved workflow configurations the user can re-use
// ─────────────────────────────────────────
model WorkflowTemplate {
  id          String   @id @default(cuid())
  name        String
  description String   @default("")
  steps       String   // JSON: WorkflowStep[]
  walletAddress String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([walletAddress])
}

// ─────────────────────────────────────────
// WorkflowExecution
// Records a single run of a workflow (from WorkflowTemplate or ad-hoc)
// ─────────────────────────────────────────
model WorkflowExecution {
  id            String    @id @default(cuid())
  name          String
  status        String    // WorkflowStatus enum values
  steps         String    // JSON: WorkflowStep[] with runtime status per step
  walletAddress String
  failedAt      String?   // step ID of the failed step
  completedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  transactions  Transaction[]

  @@index([walletAddress])
  @@index([status])
}
```

---

## 2. Enum Values

These are not Prisma enums (SQLite doesn't support them natively) — they are enforced at the application layer via Zod and TypeScript.

### TransactionType
```typescript
type TransactionType = "onramp" | "swap" | "bridge" | "workflow"
```

### TransactionStatus
```typescript
type TransactionStatus = "pending" | "processing" | "completed" | "failed"
```

Status lifecycle:
```
Onramp:  pending → completed          (immediate, simulated)
Swap:    pending → completed          (immediate, simulated)
Bridge:  pending → processing → completed  (delayed ~10s simulation)
Workflow: pending → running → completed / failed
```

### WorkflowStatus
```typescript
type WorkflowStatus = "draft" | "running" | "completed" | "failed"
```

---

## 3. Field Details

### Transaction.metadata (JSON)

The `metadata` field is a JSON string for type-specific data that doesn't fit the core schema:

**Onramp metadata:**
```json
{
  "fiatCurrency": "USD",
  "exchangeRate": 1.0,
  "platformFee": 1.5,
  "networkFee": 1.0,
  "provider": "PayFlow Simulated"
}
```

**Swap metadata:**
```json
{
  "priceImpact": 0.05,
  "slippage": 0.5,
  "route": [
    { "protocol": "UNISWAP_V3", "portion": 80 },
    { "protocol": "CURVE", "portion": 20 }
  ],
  "estimatedGasUSD": "2.30"
}
```

**Bridge metadata:**
```json
{
  "bridgeProtocol": "PayFlow Bridge (Simulated)",
  "estimatedSeconds": 180,
  "feeUSD": "1.80"
}
```

### WorkflowExecution.steps (JSON)

Stores the full step array with runtime status:

```json
[
  {
    "id": "step_1",
    "type": "onramp",
    "label": "Buy USDC with USD",
    "params": { "fiatAmount": 100, "fiatCurrency": "USD", "cryptoSymbol": "USDC", "chainId": 1 },
    "dependsOn": [],
    "status": "completed",
    "result": { "transactionId": "clxyz123abc", "cryptoAmount": "98500000" },
    "error": null
  },
  {
    "id": "step_2",
    "type": "bridge",
    "label": "Bridge USDC to Base",
    "params": { "fromChain": 1, "toChain": 8453, "token": "0xA0b8...", "amount": "98500000" },
    "dependsOn": ["step_1"],
    "status": "failed",
    "result": null,
    "error": "Bridge simulation error: timeout"
  }
]
```

---

## 4. Prisma Client Singleton

Always import from `src/lib/db.ts` — never instantiate `new PrismaClient()` elsewhere.

```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

**Why singleton?** Next.js dev mode hot-reloads modules, which would create hundreds of PrismaClient instances without this pattern.

---

## 5. Common Query Patterns

### Get paginated transactions for a wallet

```typescript
const { transactions, total } = await (async () => {
  const where = {
    walletAddress,
    ...(type && { type }),
    ...(status && { status }),
  }
  const [transactions, total] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.transaction.count({ where }),
  ])
  return { transactions, total }
})()
```

### Create a transaction record

```typescript
const tx = await db.transaction.create({
  data: {
    type: "onramp",
    status: "completed",
    fromChain: "Ethereum",
    toChain: null,
    fromToken: "USD",
    toToken: "USDC",
    fromAmount: "100",
    toAmount: "98500000",
    txHash: `0xsimulated_${cuid()}`,
    walletAddress,
    metadata: JSON.stringify({ fiatCurrency: "USD", exchangeRate: 1.0 }),
  },
})
```

### Update bridge status progression

```typescript
// Called by simulated background job
await db.transaction.update({
  where: { id: transactionId },
  data: { status: "processing", updatedAt: new Date() },
})

// After delay
await db.transaction.update({
  where: { id: transactionId },
  data: { status: "completed", updatedAt: new Date() },
})
```

### Create workflow execution

```typescript
const workflow = await db.workflowExecution.create({
  data: {
    name: "Onramp to Base",
    status: "running",
    steps: JSON.stringify(steps),
    walletAddress,
  },
})
```

### Update workflow execution steps

```typescript
// After each step completes/fails, update the steps JSON
const current = await db.workflowExecution.findUniqueOrThrow({ where: { id } })
const steps = JSON.parse(current.steps) as WorkflowStep[]
const updated = steps.map(s =>
  s.id === stepId ? { ...s, status: "completed", result } : s
)
await db.workflowExecution.update({
  where: { id },
  data: { steps: JSON.stringify(updated) },
})
```

### Get workflow with all its transactions

```typescript
const workflow = await db.workflowExecution.findUnique({
  where: { id: workflowId },
  include: { transactions: true },
})
```

---

## 6. Migration Notes

### Development

```bash
# Push schema changes to dev.db (no migration files)
npx prisma db push

# Reset dev database completely
npx prisma db push --force-reset

# Open visual DB browser
npx prisma studio
```

### Production (PostgreSQL)

1. Change `prisma/schema.prisma`:
   ```diff
   datasource db {
   - provider = "sqlite"
   + provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Set `DATABASE_URL` to PostgreSQL connection string in Vercel env vars:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/payflow
   ```

3. Generate and run migrations:
   ```bash
   npx prisma migrate dev --name init
   npx prisma migrate deploy  # in CI/CD
   ```

### Adding a new field

1. Add field to `schema.prisma`
2. Run `npx prisma db push` (dev) or create a migration (prod)
3. Run `npx prisma generate` to update the client types
4. Update relevant Zod schemas if the field is part of an API input
5. Update the relevant TypeScript type in `src/types/index.ts`

---

## 7. Indexes

Indexes are defined on frequently queried fields:

| Table | Index | Reason |
|---|---|---|
| Transaction | `walletAddress` | Every query filters by wallet |
| Transaction | `(walletAddress, type)` | Filter transactions by type |
| Transaction | `(walletAddress, status)` | Filter transactions by status |
| Transaction | `workflowId` | Join workflow → transactions |
| WorkflowTemplate | `walletAddress` | Load user's saved templates |
| WorkflowExecution | `walletAddress` | Load user's workflow history |
| WorkflowExecution | `status` | Filter running workflows |
