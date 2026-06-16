# Glossary — PayFlow Crypto

**Version:** 1.0
**Last Updated:** 2026-06-16

> Reference for crypto and project-specific terminology used throughout this codebase and its documentation.

---

## A

### Address
A unique identifier for a wallet or smart contract on a blockchain. Ethereum addresses are 42-character hexadecimal strings starting with `0x`. Example: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`.

### ABI (Application Binary Interface)
The specification that defines how to interact with a smart contract — what functions it has, what arguments they accept, and what they return. Required by viem/wagmi to call contract functions. Example: ERC-20 ABI defines `balanceOf`, `transfer`, `approve`, etc.

### Aggregator
A service that queries multiple DEXes simultaneously and returns the best price. 1inch is an aggregator. Users get better rates than going to a single DEX directly.

---

## B

### Balance
The amount of a token held by a wallet address. Native balance (ETH, MATIC) is read with `useBalance()`. ERC-20 token balance is read with `useReadContract()` calling `balanceOf(address)`.

### BigInt
JavaScript's native type for arbitrarily large integers. Used in this project for all on-chain amount arithmetic to avoid floating-point precision errors. Never use `number` for crypto amounts.

### Block
A batch of transactions permanently recorded on the blockchain. Each new block adds to the chain. Block time varies by chain (Ethereum ~12s, Base ~2s, Polygon ~2s).

### Bridge
The process of moving tokens from one blockchain to another. Since blockchains cannot communicate directly, bridge protocols lock tokens on chain A and mint equivalent tokens on chain B. In PayFlow, bridge is simulated.

### BNB Chain
A blockchain created by Binance. Chain ID: 56. Native currency: BNB. Popular in Asia. Supported in PayFlow Phase 2.

---

## C

### CEX (Centralized Exchange)
A crypto exchange run by a company (Binance, Coinbase, Tokocrypto). Has a central authority, holds user funds, requires KYC. Opposite of DEX.

### Chain
Short for "blockchain." In this project, "chain" refers to a specific blockchain network. See `ChainId`.

### Chain ID
A unique integer that identifies a blockchain network. Used by wallets and RPC nodes to prevent cross-chain transaction replay. Examples: Ethereum = 1, Polygon = 137, Base = 8453, Arbitrum = 42161.

### Composable
The ability to combine multiple operations (onramp, swap, bridge) as building blocks into a single automated flow. This is the core concept of Halliday's Workflow Protocol and PayFlow's Workflow Builder.

### Confirmation
A transaction is "confirmed" once it has been included in a block AND that block has been built upon by N subsequent blocks. More confirmations = more certainty the tx is permanent. In PayFlow, 1 confirmation is sufficient.

### Curve Finance
A DEX specialized for swapping between tokens of similar value (stablecoins: USDC↔USDT↔DAI, or ETH↔stETH). Lower price impact than Uniswap for these pairs.

---

## D

### Decimals
The number of decimal places a token supports. ETH has 18 decimals, USDC has 6. `1 ETH = 1_000_000_000_000_000_000 wei`. `1 USDC = 1_000_000` (in smallest units). Always store amounts in smallest units as strings.

### DEX (Decentralized Exchange)
A crypto exchange that runs entirely via smart contracts with no central authority. Users trade directly from their wallets. No KYC, no custody of funds. Examples: Uniswap, Curve, Balancer.

### DeFi (Decentralized Finance)
Financial applications built on blockchains using smart contracts. Includes DEXes, lending protocols, yield farming, stablecoins. No banks or intermediaries.

---

## E

### ERC-20
The standard interface for fungible tokens on EVM-compatible blockchains. Defines: `totalSupply`, `balanceOf`, `transfer`, `approve`, `allowance`, `transferFrom`. USDC, USDT, WBTC are all ERC-20 tokens.

### ETH (Ether)
The native currency of the Ethereum blockchain. Used to pay gas fees. Also used as a value store and DeFi asset. 1 ETH = 10^18 wei.

### EVM (Ethereum Virtual Machine)
The computation environment that executes smart contracts on Ethereum and EVM-compatible chains (Polygon, Base, Arbitrum, Optimism, BNB Chain). EVM-compatible chains can use the same tooling (viem, wagmi, MetaMask, Solidity).

---

## F

### Fiat
Traditional government-issued currency. USD, EUR, IDR, SGD. Not on the blockchain. Converted to crypto via onramp providers.

### Finality
The point at which a transaction is irreversible. Varies by chain: Ethereum ~15 minutes (after 32 slots), Base/Arbitrum have "soft finality" in seconds but "hard finality" only after 7 days (challenge period). In PayFlow simulations, finality is immediate.

---

## G

### Gas
The computational fee paid to validators/miners for processing a transaction. Denominated in the chain's native currency (ETH on Ethereum, MATIC on Polygon). Gas price varies with network congestion.

### Gas Fee
`gasUsed × gasPrice`. The actual cost of a transaction in ETH/MATIC/BNB. In PayFlow, gas fees are estimated from 1inch quotes for swaps and from the bridge fee matrix for bridges.

### Gas Limit
The maximum amount of gas a user is willing to spend on a transaction. If the tx uses more gas than the limit, it fails but the gas is still consumed.

---

## H

### Halliday
The target company for this portfolio project. A blockchain company building a unified cross-chain payments ecosystem. Their flagship product (Halliday Payments) and Workflow Protocol are the direct inspiration for PayFlow.

### Hash / Tx Hash
A unique 32-byte identifier for a transaction, represented as a 66-character hex string (0x + 64 chars). Used to look up a transaction on a block explorer. In PayFlow simulations, we generate fake hashes prefixed with `0xsimulated_`.

---

## L

### Layer 1 (L1)
A base blockchain that processes and finalizes its own transactions. Ethereum, Solana, BNB Chain are L1s. They are the most secure but often the most expensive.

### Layer 2 (L2)
A blockchain built on top of an L1 to increase throughput and reduce costs. Transactions are processed on L2 and periodically settled to L1. Base, Arbitrum, Optimism are Ethereum L2s.

### Liquidity
The availability of assets in a DEX pool for trading. High liquidity = low price impact. Low liquidity = high price impact. Liquidity providers deposit tokens into pools and earn fees.

### Liquidity Pool
A smart contract holding reserves of two (or more) tokens that facilitates DEX trading. Users swap by depositing token A and withdrawing token B according to an automated pricing formula.

---

## M

### MetaMask
The most popular browser extension wallet for EVM-compatible chains. Manages private keys locally in the browser. Used as the primary test wallet in PayFlow development.

### Multicall
A technique to batch multiple on-chain read calls into a single RPC request. wagmi uses multicall automatically when fetching multiple balances, reducing RPC load.

---

## N

### Native Currency
The base token of a blockchain, used to pay gas fees. ETH on Ethereum, Base, Arbitrum, Optimism. MATIC on Polygon. BNB on BNB Chain. In viem, native currency address is represented as `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`.

### Nonce
A sequential counter for each wallet's transactions. Every new transaction from a wallet must have a nonce = previous nonce + 1. Prevents replay attacks and determines transaction ordering.

---

## O

### Onramp
The process of converting fiat currency (USD, IDR) into crypto. The entry point into the crypto ecosystem. Real providers: Moonpay, Ramp Network, Transak. In PayFlow, onramp is simulated.

### Optimistic Rollup
A type of L2 that assumes transactions are valid by default and only verifies them if challenged. Base and Arbitrum are optimistic rollups. Has a 7-day withdrawal challenge period back to Ethereum L1.

---

## P

### Price Impact
The percentage change in token price caused by a swap. Large swaps relative to pool size cause higher price impact. 1inch API returns this. In PayFlow, warn users if price impact > 1% (yellow) or > 3% (red).

### Private Key
A secret 32-byte number that proves ownership of a wallet address. Never stored in PayFlow — managed entirely by the user's wallet (MetaMask).

---

## R

### RainbowKit
A React library that provides a pre-built wallet connection UI supporting MetaMask, WalletConnect, Coinbase Wallet, and more. Used in PayFlow for the Connect Wallet button and modal.

### Reown (formerly WalletConnect)
The relay infrastructure that enables QR code wallet connection between a web app and a mobile wallet. Renamed from WalletConnect to Reown in late 2024. PayFlow uses their relay via `dashboard.reown.com` Project ID.

### RPC (Remote Procedure Call)
The protocol used to communicate with a blockchain node. RPC endpoints allow apps to read blockchain data and submit transactions. Alchemy provides reliable RPC endpoints used in PayFlow.

### RPC Node
A server that runs a full blockchain client and exposes an RPC interface. Alchemy runs RPC nodes for Ethereum, Polygon, Base, and Arbitrum that PayFlow uses.

---

## S

### Sidechain
A separate blockchain with its own validators that bridges to a mainchain (usually Ethereum). Polygon PoS is technically a sidechain, not an L2. Less secure than L2 rollups but often faster and cheaper.

### Slippage
The difference between the expected price of a swap and the actual executed price, caused by market movement between quote and execution. Users set a slippage tolerance (e.g., 0.5%) — if actual slippage exceeds this, the transaction reverts.

### Smart Contract
A program deployed on a blockchain that executes automatically when conditions are met. Immutable after deployment. Holds and transfers value without intermediaries. DEXes, tokens, and bridges are all smart contracts.

### Stablecoin
A token pegged to a stable asset (usually USD). USDC and USDT are pegged 1:1 to USD. DAI is algorithmically pegged. Used in onramp as the primary output and in bridge simulations.

---

## T

### TanStack Query (React Query)
The data-fetching library used in PayFlow for all server state management. Provides caching, background refetching, and loading/error states for API calls.

### Token
A digital asset on a blockchain. Can represent currency (USDC), governance rights (UNI), or anything else. ERC-20 is the standard for fungible tokens.

### Transaction
An on-chain action recorded permanently on a blockchain. In PayFlow, "transaction" also refers to records in the DB of simulated payment actions (onramp, swap, bridge, workflow execution).

### TVL (Total Value Locked)
The total value of crypto assets deposited in a DeFi protocol. Used as a measure of adoption. Mentioned in context of Arbitrum's TVL (~$10B+) in ARCHITECTURE.md.

---

## U

### Uniswap
The largest DEX on Ethereum and most L2 chains. Pioneered the automated market maker (AMM) model. V3 uses concentrated liquidity for better capital efficiency.

### USDC (USD Coin)
A stablecoin pegged 1:1 to USD, issued by Circle. The primary stablecoin in PayFlow. Different contract addresses on each chain.

---

## V

### viem
A TypeScript library for interacting with EVM blockchains. The modern replacement for ethers.js. Used by wagmi under the hood. In PayFlow, used directly for on-chain reads in API routes.

---

## W

### wagmi
A collection of React hooks for Ethereum built on top of viem and TanStack Query. Provides hooks like `useAccount`, `useBalance`, `useSendTransaction`. The core Web3 library in PayFlow's frontend.

### Wallet
Software that stores private keys and signs transactions. Never custodies funds — the blockchain holds the funds, the wallet just proves ownership. MetaMask and Trust Wallet are popular wallets.

### WalletConnect
See **Reown**.

### Wei
The smallest unit of ETH. 1 ETH = 10^18 wei. Named after Wei Dai, a cryptographer. Used internally in PayFlow for all ETH amount calculations.

### Workflow
In PayFlow: a composed sequence of payment actions (onramp, swap, bridge, transfer) that execute sequentially as a single automated flow. Inspired by Halliday's Workflow Protocol.

---

## Z

### ZK-Rollup (Zero-Knowledge Rollup)
A type of L2 that uses cryptographic proofs (ZK proofs) to verify transaction validity. More secure and faster finality than optimistic rollups, but more complex. zkSync Era and Polygon zkEVM are ZK-rollups. Not used in PayFlow Phase 1.

### Zod
A TypeScript-first schema validation library. Used in PayFlow to validate all API route inputs. Every API route must validate its input with a Zod schema before processing.
