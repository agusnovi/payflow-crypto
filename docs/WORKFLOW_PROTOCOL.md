# Workflow Protocol — PayFlow Crypto

**Version:** 1.0
**Last Updated:** 2026-06-16

> This document describes the Workflow Builder feature — the most complex and architecturally significant part of PayFlow. It is directly inspired by Halliday's Workflow Protocol.

---

## 1. Concept

A **Workflow** is an ordered sequence of payment actions that execute automatically, one after another, as a single coordinated flow.

Without workflows, a user wanting to "buy USDC, swap to ETH, then bridge to Base" must:
1. Go to Onramp → complete the transaction → wait
2. Go to Swap → complete the transaction → wait
3. Go to Bridge → complete the transaction → wait

With a workflow, they define all three steps once and click **Run**. The system handles sequencing, error propagation, and status tracking.

This is the core value proposition of Halliday's Workflow Protocol, implemented here at a portfolio-demo scale.

---

## 2. Data Model

### WorkflowStep

```typescript
interface WorkflowStep {
  id: string                        // unique within the workflow e.g. "step_1"
  type: WorkflowStepType            // "onramp" | "swap" | "bridge" | "transfer"
  label: string                     // human-readable name e.g. "Buy USDC with USD"
  params: Record<string, unknown>   // step-specific parameters (validated per type)
  dependsOn: string[]               // IDs of steps that must complete before this one
  status: WorkflowStepStatus        // runtime state
  result: unknown | null            // output data from execution
  error: string | null              // error message if failed
}

type WorkflowStepType   = "onramp" | "swap" | "bridge" | "transfer"
type WorkflowStepStatus = "pending" | "running" | "completed" | "failed"
```

### WorkflowExecution

```typescript
interface WorkflowExecution {
  id: string
  name: string
  status: WorkflowStatus
  steps: WorkflowStep[]
  walletAddress: string
  failedAt: string | null     // step ID of the first failed step
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type WorkflowStatus = "draft" | "running" | "completed" | "failed"
```

---

## 3. Step Types & Parameters

### 3.1 Onramp Step

Convert fiat to crypto.

```typescript
interface OnrampStepParams {
  fiatAmount: number          // e.g. 100
  fiatCurrency: "USD" | "IDR"
  cryptoSymbol: "USDC" | "ETH" | "MATIC"
  chainId: 1 | 137 | 8453 | 42161
}
```

**Output (result):**
```json
{
  "transactionId": "clxyz123",
  "cryptoAmount": "98500000",
  "cryptoSymbol": "USDC",
  "chainId": 1
}
```

---

### 3.2 Swap Step

Exchange one token for another on the same chain.

```typescript
interface SwapStepParams {
  fromToken: string     // token contract address
  toToken: string
  amount: string        // in wei (smallest unit)
  chainId: 1 | 137 | 8453 | 42161
  slippage?: number     // default 0.5
}
```

**Output (result):**
```json
{
  "transactionId": "clxyz456",
  "toAmount": "324150000",
  "toToken": "0xA0b8...",
  "chainId": 1
}
```

---

### 3.3 Bridge Step

Move tokens from one chain to another.

```typescript
interface BridgeStepParams {
  fromChain: 1 | 137 | 8453 | 42161
  toChain: 1 | 137 | 8453 | 42161
  token: string         // token contract address on fromChain
  amount: string        // in wei
}
```

**Output (result):**
```json
{
  "transactionId": "clxyz789",
  "toAmount": "98200000",
  "toChain": 8453,
  "estimatedCompletionAt": "2026-06-16T10:05:00.000Z"
}
```

---

### 3.4 Transfer Step

Send tokens to another wallet address.

```typescript
interface TransferStepParams {
  token: string         // token address (use 0xEeee...EEeE for native)
  amount: string        // in wei
  toAddress: string     // recipient wallet address
  chainId: 1 | 137 | 8453 | 42161
}
```

**Output (result):**
```json
{
  "transactionId": "clxyz000",
  "txHash": "0xsimulated_000",
  "toAddress": "0xRecipient..."
}
```

---

## 4. Execution Engine

The workflow engine lives in `src/app/api/workflow/route.ts` and `src/hooks/useWorkflow.ts`.

### 4.1 Execution Algorithm

```
FUNCTION executeWorkflow(workflow):
  1. Validate all steps (Zod schemas per step type)
  2. Validate dependency graph (no cycles, all dependsOn IDs exist)
  3. Create WorkflowExecution in DB (status: "running")
  4. Build execution order from dependency graph (topological sort)
  5. FOR EACH step in execution order:
     a. Check all dependsOn steps are "completed" — skip if not ready
     b. Update step status → "running" in DB
     c. CALL step handler (onrampHandler / swapHandler / bridgeHandler / transferHandler)
     d. IF success:
        - Update step status → "completed", save result
     e. IF failure:
        - Update step status → "failed", save error message
        - Update workflow status → "failed", set failedAt = step.id
        - STOP execution (do not run remaining steps)
  6. IF all steps completed:
     - Update workflow status → "completed", set completedAt
  7. RETURN { workflowId, status, steps }
```

### 4.2 Step Handlers

Each step type maps to a handler function:

```typescript
// src/app/api/workflow/handlers.ts

type StepHandler = (
  params: Record<string, unknown>,
  context: WorkflowContext
) => Promise<unknown>

const stepHandlers: Record<WorkflowStepType, StepHandler> = {
  onramp:   executeOnrampStep,
  swap:     executeSwapStep,
  bridge:   executeBridgeStep,
  transfer: executeTransferStep,
}

// Context carries data between steps
interface WorkflowContext {
  walletAddress: string
  workflowId: string
  stepResults: Record<string, unknown>  // results from previous steps
}
```

### 4.3 Result Passing Between Steps

The `context.stepResults` object allows steps to reference outputs from prior steps.

**Example:** Bridge step automatically uses the `cryptoAmount` output from the preceding Onramp step:

```typescript
async function executeBridgeStep(params, context) {
  // If amount not explicitly provided, use result from prior onramp step
  const amount = params.amount ??
    (context.stepResults["step_1"] as OnrampResult)?.cryptoAmount

  if (!amount) throw new Error("No amount available for bridge step")

  return simulateBridge({ ...params, amount })
}
```

---

## 5. State Machine

### Workflow Status

```
         ┌─────────┐
         │  draft  │  (saved template, not yet run)
         └────┬────┘
              │ execute()
              ▼
         ┌─────────┐
         │ running │  (steps are executing)
         └────┬────┘
        ┌─────┴─────┐
        ▼           ▼
  ┌──────────┐  ┌────────┐
  │completed │  │ failed │
  └──────────┘  └────────┘
```

### Step Status

```
  ┌─────────┐
  │ pending │  (not yet started)
  └────┬────┘
       │ engine reaches this step
       ▼
  ┌─────────┐
  │ running │  (handler is executing)
  └────┬────┘
  ┌────┴────┐
  ▼         ▼
┌───────────┐  ┌────────┐
│ completed │  │ failed │
└───────────┘  └────────┘
```

**Rule:** A step can only move forward — never backward. Once `completed`, it stays `completed`.

---

## 6. Dependency Graph

### Why dependencies?

Steps are sequential by default (step 2 runs after step 1). But `dependsOn` allows expressing explicit dependencies for future parallel execution support.

**In v1:** All steps execute sequentially in definition order. `dependsOn` is validated but parallel execution is not implemented.

**In v2 (future):** Steps with no shared dependencies can run in parallel.

### Validation Rules

Before execution starts, the engine validates:

1. **All referenced IDs exist:** Every ID in `dependsOn` must be a valid step ID in the workflow.
2. **No circular dependencies:** Detected via DFS cycle detection on the dependency graph.
3. **At least one root step:** There must be at least one step with `dependsOn: []`.

```typescript
function validateDependencyGraph(steps: WorkflowStep[]): void {
  const ids = new Set(steps.map(s => s.id))

  for (const step of steps) {
    for (const dep of step.dependsOn) {
      if (!ids.has(dep)) {
        throw new Error(`Step ${step.id} depends on unknown step: ${dep}`)
      }
    }
  }

  if (hasCycle(steps)) {
    throw new Error("Workflow has circular step dependencies")
  }
}
```

---

## 7. Frontend: useWorkflow Hook

```typescript
// src/hooks/useWorkflow.ts

interface UseWorkflowReturn {
  steps: WorkflowStep[]
  workflowStatus: WorkflowStatus | null
  isRunning: boolean
  error: string | null
  addStep: (type: WorkflowStepType) => void
  removeStep: (id: string) => void
  updateStep: (id: string, params: Record<string, unknown>) => void
  moveStep: (id: string, direction: "up" | "down") => void
  executeWorkflow: (name: string) => Promise<void>
  reset: () => void
}
```

**Polling for status:** After calling `executeWorkflow`, the hook polls `GET /api/workflow/:id/status` every 2 seconds until `status` is `"completed"` or `"failed"`.

```typescript
// Inside useWorkflow.ts — polling logic
useEffect(() => {
  if (!workflowId || !isRunning) return

  const interval = setInterval(async () => {
    const res = await fetch(`/api/workflow/${workflowId}/status`)
    const { data } = await res.json()
    setSteps(data.steps)
    setWorkflowStatus(data.status)
    if (data.status === "completed" || data.status === "failed") {
      setIsRunning(false)
      clearInterval(interval)
    }
  }, 2000)

  return () => clearInterval(interval)
}, [workflowId, isRunning])
```

---

## 8. Error Handling

### Step-level errors

Each step handler wraps its logic in try/catch:

```typescript
async function executeOnrampStep(params, context) {
  try {
    const validated = OnrampStepParamsSchema.parse(params)
    const result = await simulateOnramp(validated, context.walletAddress)
    return result
  } catch (error) {
    // Re-throw with context — engine catches and marks step as failed
    throw new Error(`Onramp failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
```

### Known Limitations (v1)

| Limitation | Description | Future Fix |
|---|---|---|
| No rollback | Completed steps are not reversed if a later step fails | Implement compensating transactions per step type |
| No retry | Failed steps cannot be retried without restarting the workflow | Add `retryStep(stepId)` API |
| Sequential only | All steps run one-by-one even if parallel is possible | Implement topological parallel execution |
| No timeout | Steps have no maximum execution time | Add per-step timeout with AbortController |

---

## 9. Preset Templates

Three preset workflows are pre-built for demo purposes. They live in `src/lib/workflowTemplates.ts`:

### Template 1: "Onramp to Base"
```json
{
  "name": "Onramp to Base",
  "description": "Buy USDC with USD on Ethereum, then bridge it to Base",
  "steps": [
    {
      "id": "step_1",
      "type": "onramp",
      "label": "Buy USDC with USD",
      "params": { "fiatAmount": 100, "fiatCurrency": "USD", "cryptoSymbol": "USDC", "chainId": 1 },
      "dependsOn": []
    },
    {
      "id": "step_2",
      "type": "bridge",
      "label": "Bridge USDC to Base",
      "params": { "fromChain": 1, "toChain": 8453, "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
      "dependsOn": ["step_1"]
    }
  ]
}
```

### Template 2: "Cross-chain Swap"
```json
{
  "name": "Cross-chain Swap",
  "description": "Buy ETH, swap to USDC, bridge to Polygon",
  "steps": [
    {
      "id": "step_1",
      "type": "onramp",
      "label": "Buy ETH with USD",
      "params": { "fiatAmount": 200, "fiatCurrency": "USD", "cryptoSymbol": "ETH", "chainId": 1 },
      "dependsOn": []
    },
    {
      "id": "step_2",
      "type": "swap",
      "label": "Swap ETH to USDC",
      "params": {
        "fromToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "toToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "chainId": 1
      },
      "dependsOn": ["step_1"]
    },
    {
      "id": "step_3",
      "type": "bridge",
      "label": "Bridge USDC to Polygon",
      "params": { "fromChain": 1, "toChain": 137, "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
      "dependsOn": ["step_2"]
    }
  ]
}
```

### Template 3: "Full Payment Flow"
```json
{
  "name": "Full Payment Flow",
  "description": "Onramp → Swap → Bridge → Transfer to recipient",
  "steps": [
    {
      "id": "step_1",
      "type": "onramp",
      "label": "Buy USDC",
      "params": { "fiatAmount": 50, "fiatCurrency": "USD", "cryptoSymbol": "USDC", "chainId": 1 },
      "dependsOn": []
    },
    {
      "id": "step_2",
      "type": "bridge",
      "label": "Bridge to Base",
      "params": { "fromChain": 1, "toChain": 8453, "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
      "dependsOn": ["step_1"]
    },
    {
      "id": "step_3",
      "type": "transfer",
      "label": "Send to recipient",
      "params": {
        "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "toAddress": "0xRecipientAddress",
        "chainId": 8453
      },
      "dependsOn": ["step_2"]
    }
  ]
}
```
