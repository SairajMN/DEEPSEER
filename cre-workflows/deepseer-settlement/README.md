# DEEPSEER CRE Workflow

This workflow listens for `ResolutionWindowOpenedByEngine` emitted by `SettlementEngine`, pulls independent external market data, requests deterministic risk scoring from the AI microservice, then writes a signed CRE report back on-chain.

## Commands

```bash
cd cre-workflows/deepseer-settlement
npm install
npm run check

cd ..
cp .env.example .env
cp secrets.yaml.example secrets.yaml
cre workflow simulate deepseer-settlement --target local-simulation
```

## Required Env

- `RPC_URL`
- `WORKFLOW_OWNER_ADDRESS`

## Required Secrets

- `RISK_API_KEY`

## Report Payload

The workflow submits the ABI payload below through `evmClient.writeReport()`:

```solidity
(address market, int256 externalPrice, uint64 externalPriceTimestamp, uint16 confidenceScore, bool anomalyFlag, uint16 sourceConsensus, bytes32 evidenceHash)
```

This payload is decoded by `SettlementEngine.onReport(...)` and merged with Chainlink Functions response before the final `resolveMarket(...)` call.
