# DEEPSEER Architecture

## System Topology

```mermaid
flowchart TD
    U[User Wallet] --> F[Next.js Frontend]
    F --> PM[PredictionMarket Contracts]
    PM --> TR[Treasury]
    PM --> SE[SettlementEngine]

    SE --> DF[Chainlink Data Feeds]
    SE --> CF[Chainlink Functions]
    CA[Chainlink Automation] --> SE

    PM -->|ResolutionWindowOpenedByEngine trigger| CRE[Chainlink CRE Workflow]
    CRE --> EX[External Price API]
    CRE --> AI[FastAPI Risk Service]
    CRE -->|writeReport| SE

    SE -->|resolveMarket| PM
    PM -->|claim| TR
```

## Responsibility Split

- `PredictionMarket`: round lifecycle, oracle lock/final read, deterministic outcome derivation, payout math.
- `Treasury`: escrow accounting per market, protocol fee capture, payout/refund transfers.
- `SettlementEngine`: Automation hooks, Functions request/fulfillment tracking, CRE report verification and merge logic.
- `PredictionMarketFactory`: controlled market deployment, treasury market authorization, settlement engine registration.
- `backend-ai`: deterministic reliability scoring over multi-source observations.
- `cre-workflows/deepseer-settlement`: event trigger + external fetch + AI call + signed on-chain report.
- `src/` frontend app: trading terminal UI, wallet actions, bet controls, market telemetry.

## Resolution Data Path

1. Automation detects expired locked market.
2. `SettlementEngine.performUpkeep` opens resolution window and sends Functions request.
3. CRE sees `ResolutionWindowOpenedByEngine` event.
4. CRE fetches external price and risk score, submits `onReport` payload.
5. Settlement engine merges Functions + CRE reports (or fail-safe if Functions times out).
6. `PredictionMarket.resolveMarket` reads Chainlink Data Feed and derives Bull/Bear from `finalPrice` vs `lockPrice`.
7. Users claim rewards/refunds from treasury escrow.

## Full User Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend
    participant Market as PredictionMarket
    participant Treasury
    participant Engine as SettlementEngine
    participant Auto as Chainlink Automation
    participant Func as Chainlink Functions
    participant CRE as CRE Workflow
    participant AI as Risk API
    participant API as External Price API

    User->>UI: Connect wallet
    User->>UI: Place Bull/Bear bet
    UI->>Market: placeBet(side, amount)
    Market->>Treasury: escrowStake(user, amount)

    Auto->>Engine: checkUpkeep/performUpkeep
    Engine->>Market: lockRound()

    Auto->>Engine: checkUpkeep/performUpkeep
    Engine->>Market: openResolutionWindow()
    Engine->>Func: _sendRequest(functionsSource,args)

    Market-->>CRE: ResolutionWindowOpenedByEngine(market)
    CRE->>API: Fetch external reference price
    CRE->>AI: POST /v1/risk-score
    AI-->>CRE: confidence_score, anomaly_flag, source_consensus
    CRE->>Engine: onReport(metadata, report)

    Func-->>Engine: fulfillRequest(requestId,response)
    Engine->>Market: resolveMarket(mergedRisk, externalPrice, externalTs)

    User->>UI: Claim payout
    UI->>Market: claim()
    Market->>Treasury: payout/refund
    Treasury-->>User: ERC20 transfer
```
