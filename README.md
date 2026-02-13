# DeepSeer Frontend + Backend

Production-oriented AI-assisted prediction market stack using Next.js App Router, TypeScript, Tailwind, Ethers, WebSocket live updates, and contract-backed data flows.

## Stack
- Next.js 15 App Router
- TypeScript strict mode
- TailwindCSS + Framer Motion
- Zustand state management
- Ethers.js contract integration
- `lightweight-charts` candlestick charts
- D3 liquidity depth chart
- Express + WS backend for live event fan-out and risk model API

## App Routes

Primary tabs and sub-tabs implemented:

- `markets`
  - `/markets`
  - `/markets/resolving`
  - `/markets/resolved`
  - `/markets/high-volatility`
  - `/markets/high-confidence`
- `trade`
  - `/trade`
  - `/trade/limit-orders`
  - `/trade/liquidity`
  - `/trade/order-history`
- `portfolio`
  - `/portfolio`
  - `/portfolio/pnl`
  - `/portfolio/exposure`
  - `/portfolio/metrics`
- `analytics`
  - `/analytics`
  - `/analytics/liquidity-depth`
  - `/analytics/volatility`
  - `/analytics/fees`
  - `/analytics/oracle-performance`
- `ai-risk`
  - `/ai-risk`
  - `/ai-risk/source-agreement`
  - `/ai-risk/temporal-consistency`
  - `/ai-risk/anomaly-flags`
  - `/ai-risk/provenance`
- `governance`
  - `/governance`
  - `/governance/voting-power`
  - `/governance/locked-tokens`
  - `/governance/history`
- `create-market`
  - `/create-market`
  - `/create-market/scalar`
  - `/create-market/categorical`
  - `/create-market/conditional`
- `learn`
  - `/learn`
  - `/learn/amm`
  - `/learn/settlement`
  - `/learn/ai-risk`
  - `/learn/charts`

## Live Data Sources

No synthetic frontend values are used. Data is read from:
- PredictionMarket / AMM / SettlementEngine / Governance contracts
- Backend AI risk API (`/api/risk*`)
- Backend analytics API (`/api/analytics*`)
- Backend WebSocket stream

WebSocket event types:
- `TradeExecuted`
- `LiquidityAdded`
- `LiquidityRemoved`
- `MarketResolved`
- `OracleUpdated`
- `AIConfidenceUpdated`

## Environment Variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_WS_RPC_URL=
NEXT_PUBLIC_CHAIN_ID=

NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=
NEXT_PUBLIC_AMM_ADDRESS=
NEXT_PUBLIC_SETTLEMENT_ENGINE_ADDRESS=
NEXT_PUBLIC_GOVERNANCE_ADDRESS=
NEXT_PUBLIC_TOKEN_ADDRESS=

NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_WS_API_URL=ws://127.0.0.1:4000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

## Development

Install:

```bash
npm install
```

Run backend:

```bash
npm run backend
```

Run frontend:

```bash
npm run dev
```

Open:
- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:4000/health`

## Build

```bash
npm run lint
npm run build
```

If Next.js reports lockfile SWC patch warnings, refresh dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```
