# Conventions — PayFlow Crypto

**Version:** 1.0
**Last Updated:** 2026-06-16

> These rules are non-negotiable. Every file in this codebase must follow them. When in doubt, look at an existing file for reference.

---

## 1. Folder Structure Rules

### Where to put new files

| File type | Location | Example |
|---|---|---|
| Page component | `src/app/<route>/page.tsx` | `src/app/swap/page.tsx` |
| API route | `src/app/api/<resource>/route.ts` | `src/app/api/swap/route.ts` |
| React component | `src/components/<feature>/ComponentName.tsx` | `src/components/swap/SwapForm.tsx` |
| Reusable UI primitive | `src/components/ui/ComponentName.tsx` | `src/components/ui/Button.tsx` |
| Shared cross-feature component | `src/components/shared/ComponentName.tsx` | `src/components/shared/TokenSelector.tsx` |
| React hook | `src/hooks/useHookName.ts` | `src/hooks/useSwapQuote.ts` |
| Library / utility | `src/lib/moduleName.ts` | `src/lib/oneinch.ts` |
| TypeScript types | `src/types/index.ts` | (single file, not per feature) |

### Rules
- **One component per file.** No barrel files exporting multiple components.
- **No nested feature folders deeper than one level.** `src/components/swap/SwapForm.tsx` ✅ — `src/components/swap/forms/SwapForm.tsx` ❌
- **API routes use Next.js file conventions** — each folder gets a `route.ts`, not individual handler files.
- **Never create a `utils/` folder inside a feature** — all utilities go in `src/lib/utils.ts`.

---

## 2. Naming Conventions

### Files
| Type | Convention | Example |
|---|---|---|
| React component file | `PascalCase.tsx` | `SwapForm.tsx` |
| Hook file | `camelCase.ts` starting with `use` | `useSwapQuote.ts` |
| Library/util file | `camelCase.ts` | `oneinch.ts`, `utils.ts` |
| API route file | always `route.ts` | `route.ts` |
| Type file | `camelCase.ts` or `index.ts` | `index.ts` |

### Variables & Functions
```typescript
// ✅ Correct
const walletAddress = "0x..."
const tokenBalance = BigInt(0)
function formatAmount(amount: string, decimals: number): string { }
const useSwapQuote = () => { }

// ❌ Wrong
const WalletAddress = "0x..."
const token_balance = BigInt(0)
function FormatAmount() { }
```

### React Components
```typescript
// ✅ PascalCase, named export (not default for components)
export function SwapForm({ ... }: SwapFormProps) { }

// ❌ Wrong
export default function swapForm() { }
export const swap_form = () => { }
```

### TypeScript Interfaces & Types
```typescript
// ✅ Interfaces for object shapes (PascalCase)
interface SwapQuote { ... }
interface OnrampRequest { ... }

// ✅ Type aliases for unions, primitives, computed types
type ChainId = 1 | 137 | 8453 | 42161
type TransactionStatus = "pending" | "processing" | "completed" | "failed"

// ❌ Don't prefix with I or T
interface ISwapQuote { }
type TChainId = number
```

### Constants
```typescript
// ✅ SCREAMING_SNAKE_CASE for module-level constants
const SUPPORTED_CHAIN_IDS = [1, 137, 8453, 42161] as const
const MAX_SLIPPAGE = 5
const DEFAULT_SLIPPAGE = 0.5

// ✅ PascalCase for object constants (they read like values)
const SUPPORTED_CHAINS: Record<ChainId, Chain> = { ... }
```

---

## 3. TypeScript Rules

### Never use `any`
```typescript
// ❌ Wrong
function parseMetadata(data: any) { }
const result: any = await fetch(...)

// ✅ Correct — use unknown and narrow
function parseMetadata(data: unknown): Metadata {
  const parsed = MetadataSchema.safeParse(data)
  if (!parsed.success) throw new Error("Invalid metadata")
  return parsed.data
}
```

### Always type function parameters and return values
```typescript
// ❌ Missing return type
function formatAmount(amount: string, decimals: number) {
  return Number(amount) / 10 ** decimals
}

// ✅ Explicit return type
function formatAmount(amount: string, decimals: number): string {
  return (Number(amount) / 10 ** decimals).toFixed(6)
}
```

### Use `satisfies` for config objects
```typescript
// ✅ Catches type errors without widening the type
const bridgeFees = {
  "1-8453": { feeUSD: 1.80, estimatedSeconds: 180 },
  "1-137":  { feeUSD: 2.50, estimatedSeconds: 600 },
} satisfies Record<string, { feeUSD: number; estimatedSeconds: number }>
```

### Prefer `interface` over `type` for object shapes
```typescript
// ✅ interface for objects (extensible, better error messages)
interface SwapQuote {
  fromToken: Token
  toToken: Token
  fromAmount: string
  toAmount: string
}

// ✅ type for unions and primitives
type WorkflowStatus = "draft" | "running" | "completed" | "failed"
```

### Import types explicitly
```typescript
// ✅ Use `import type` for type-only imports
import type { SwapQuote, ChainId } from "@/types"
import { SUPPORTED_CHAINS } from "@/lib/chains"
```

---

## 4. Component Pattern

### Standard component structure
```typescript
// src/components/swap/SwapForm.tsx

import type { Token, ChainId } from "@/types"

// 1. Props interface (always co-located with the component)
interface SwapFormProps {
  chainId: ChainId
  walletAddress?: string
  onSuccess?: (txId: string) => void
}

// 2. Named export (not default)
export function SwapForm({ chainId, walletAddress, onSuccess }: SwapFormProps) {
  // 3. Hooks at the top
  const { data: quote, isLoading, error } = useSwapQuote(...)

  // 4. Derived state
  const isDisabled = !walletAddress || isLoading

  // 5. Handlers
  function handleSubmit() { ... }

  // 6. Early returns for loading/error states
  if (error) return <ErrorMessage message={error.message} />

  // 7. Main render
  return (
    <div>
      ...
    </div>
  )
}
```

### Rules
- **No logic in JSX.** Extract computed values into variables before the return.
- **No inline styles.** Use Tailwind classes only.
- **No direct Prisma/DB calls in components.** Use API routes.
- **No direct external API calls in components.** Proxy through `/api/*`.
- **Props must be typed.** Never use `props: object` or untyped props.

---

## 5. API Route Pattern

Every API route must follow this exact structure:

```typescript
// src/app/api/swap/route.ts

import { NextResponse } from "next/server"
import { z } from "zod"

// 1. Zod schema at the top
const QuerySchema = z.object({
  fromToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/),
  chainId: z.coerce.number(),
  walletAddress: z.string(),
})

// 2. HTTP method handler
export async function GET(request: Request) {
  try {
    // 3. Parse & validate input
    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    // 4. Business logic
    const quote = await getSwapQuote(parsed.data)

    // 5. Success response
    return NextResponse.json({ success: true, data: quote })

  } catch (error) {
    // 6. Error logging + safe error response
    console.error("[/api/swap/quote]", error)
    return NextResponse.json(
      { success: false, error: "Swap quote unavailable. Please try again." },
      { status: 500 }
    )
  }
}
```

### Rules
- **Always validate with Zod** — never use `request.json()` raw.
- **Always return `{ success, data?, error? }`** — no custom shapes.
- **Always log errors with route context** — `console.error("[/api/route]", error)`.
- **Never expose internal error details** in the response body (stack traces, DB errors).
- **Use `NextResponse.json()`** not `Response.json()` for proper Next.js typing.

---

## 6. Monetary Amount Rules

Crypto amounts are extremely sensitive to floating-point errors. Follow these rules strictly.

```typescript
// ✅ Store and transmit amounts as strings (bigint-safe)
const amount: string = "98500000"   // 98.5 USDC (6 decimals)

// ✅ Use BigInt for arithmetic
const amountBig = BigInt(amount)
const fee = amountBig * BigInt(15) / BigInt(1000)  // 1.5% fee

// ✅ Convert to human-readable only at display time
import { formatAmount } from "@/lib/utils"
const display = formatAmount("98500000", 6)  // → "98.50"

// ❌ Never use floating-point for crypto math
const amount = 98.5  // precision loss risk
const fee = amount * 0.015  // 1.4849999... not 1.485
```

```typescript
// src/lib/utils.ts — reference implementation
export function formatAmount(amount: string, decimals: number): string {
  const big = BigInt(amount)
  const divisor = BigInt(10 ** decimals)
  const whole = big / divisor
  const remainder = big % divisor
  const remainderStr = remainder.toString().padStart(decimals, "0").slice(0, 6)
  return `${whole}.${remainderStr}`.replace(/\.?0+$/, "")
}
```

---

## 7. Hook Rules

```typescript
// ✅ Hooks must not contain JSX — only logic
export function useSwapQuote(params: SwapParams) {
  return useQuery({
    queryKey: ["swap-quote", params],
    queryFn: () => fetchSwapQuote(params),
    enabled: Boolean(params.fromToken && params.toToken && params.amount),
    staleTime: 15_000,  // 15 seconds
    refetchInterval: 15_000,
  })
}

// ❌ No JSX in hooks
export function useSwapQuote(params: SwapParams) {
  if (!params.fromToken) return <div>Select a token</div>  // WRONG
}
```

---

## 8. Import Order

All files must maintain this import order (auto-enforced by ESLint):

```typescript
// 1. React
import { useState, useEffect } from "react"

// 2. Next.js
import { NextResponse } from "next/server"
import Link from "next/link"

// 3. Third-party libraries
import { useAccount } from "wagmi"
import { z } from "zod"

// 4. Internal — absolute paths (@/)
import type { SwapQuote, ChainId } from "@/types"
import { SUPPORTED_CHAINS } from "@/lib/chains"
import { db } from "@/lib/db"

// 5. Components (from closest to furthest)
import { SwapForm } from "@/components/swap/SwapForm"
import { Button } from "@/components/ui/Button"

// 6. Styles (if any)
import "./styles.css"
```

---

## 9. Error Message Format

```typescript
// API error messages — user-facing, no technical jargon
{ error: "Swap quote unavailable. Please try again." }   // ✅
{ error: "1inch API 503 Service Unavailable" }           // ❌

// Console logs — developer-facing, include full context
console.error("[/api/swap/quote] 1inch API error:", error, { params })  // ✅
console.error("error")  // ❌
```

---

## 10. cn() Utility for Tailwind Classes

Always use the `cn()` utility when conditionally applying Tailwind classes:

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
<div className={cn(
  "rounded-lg border p-4",
  isError && "border-red-300 bg-red-50",
  isSuccess && "border-green-300 bg-green-50"
)} />
```

---

## 11. Code Co-location vs Extraction

The goal is to avoid both under-splitting (duplication) and over-splitting (premature abstraction). Use this decision tree before creating a new file or moving code.

### Keep co-located in the same file

- **Small sub-components (< ~40 lines)** that are only used by the parent component in that file.
  ```typescript
  // ✅ StatCard and TokenRow live in page.tsx — they are never imported elsewhere
  function StatCard({ label, value }: StatCardProps) { ... }
  function TokenRow({ token, balance }: TokenRowProps) { ... }
  ```
- **Props interfaces for internal sub-components** — co-locate with the component they describe.
- **Feature-specific constants** used only within one file (`CRYPTO_CHAINS`, `FIAT_MIN`, `STATUS_STYLES`, local ABI fragments).
- **One-off form handlers** (`handleConfirm`, `handleReset`) that call a single API endpoint from a single component.
- **Internal helper functions** used in fewer than 2 files.

### Extract to `src/lib/utils.ts`

- **Pure formatting functions** that appear in 2+ different files.
  ```typescript
  // ✅ formatFiat is used by OnrampForm AND TransactionTable — lives in utils.ts
  export function formatFiat(amount: number, currency: string): string { ... }
  ```
- **Pure utility functions** with no component state, no JSX, and no side effects.

### Extract to `src/hooks/`

- Data fetching logic consumed by **2+ different components**.
- State machine / reducer logic **> ~30 lines** that contains no JSX.

### Do NOT split for "bundle optimization"

Next.js App Router automatically code-splits per route. Moving a small sub-component to its own file has **zero effect** on bundle size unless combined with `React.lazy()` / `dynamic()`.

```typescript
// ❌ This does NOT reduce bundle size — it only adds indirection
// src/components/dashboard/StatCard.tsx  (unnecessary file)

// ✅ Only reach for dynamic() when importing a heavy third-party library
const HeavyChart = dynamic(() => import("./HeavyChart"), { ssr: false })
```

### Rule of thumb

> Extract only when there is real duplication (2+ places) or when the code is large enough to obscure the primary logic of the file. When in doubt, keep it co-located.

### No duplication — check before you write

Before implementing any function, API client setup, or component, **search the codebase first**:

| Looking for | Check here first |
|---|---|
| Data fetching / API client | `src/lib/` |
| Formatting / pure utility | `src/lib/utils.ts` |
| Stateful logic used in multiple components | `src/hooks/` |
| UI element used in multiple features | `src/components/shared/` or `src/components/ui/` |
| TypeScript type or interface | `src/types/index.ts` |

If it already exists → **import it, do not re-implement.**

If it belongs in a shared location but doesn't exist yet → **create it there**, not inline inside the feature file.

```typescript
// ❌ Wrong — duplicating logic that already lives in src/lib/prices.ts
// Inside src/app/api/prices/route.ts:
const COINGECKO_IDS = { ETH: "ethereum", ... }  // already defined in lib/prices.ts
const cache = new Map()                           // already handled in lib/prices.ts
const res = await fetch("https://api.coingecko.com/...")  // already wrapped in lib/prices.ts

// ✅ Correct — import and reuse
import { getTokenPrices } from "@/lib/prices"
const prices = await getTokenPrices(tokens)
```
