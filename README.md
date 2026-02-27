# DEEPSEER

Production-grade decentralized AI-assisted prediction market system.

## What Is Included

- Existing Next.js app layout under `src/` with upgraded DEEPSEER trade terminal UI at `src/app/trade/page.tsx`.
- Legacy protocol contracts under `contracts/deepseer/` (kept intact).
- New production contract suite under `contracts/src/`:
  - `PredictionMarketFactory.sol`
  - `PredictionMarket.sol`
  - `SettlementEngine.sol`
  - `Treasury.sol`
  - `interfaces/RiskOracleInterface.sol`
- CRE workflow under `cre-workflows/deepseer-settlement/`.
- Deterministic FastAPI risk microservice under `backend-ai/`.
- Security, architecture, deployment, and demo runbooks under `docs/`.

REAL mode is the default system path. Demo mode is explicitly labeled in the trade UI.

## Repository Structure

```text
/src                Existing frontend app (App Router pages/components)
/backend            Existing API + websocket bridge
/contracts/deepseer Legacy contracts (preserved)
/contracts/src      Production contract suite (new)
/contracts/script   Production deployment script (new)
/backend-ai         FastAPI deterministic risk service (new)
/cre-workflows      Chainlink CRE workflow project (new)
/deploy             Address templates and deployment runbook (new)
/docs               Architecture/security/demo/public checklist (new)
/tests              E2E scenario matrix (new)
/scripts            Bootstrap/deploy/sim helpers (new + existing)
```

## Chainlink Stack

- Data Feeds: lock/final price snapshots in market resolution logic.
- Automation: lock-round/open-resolution upkeep logic in `SettlementEngine`.
- Functions: independent risk request tracking and merge gate.
- CRE: event trigger -> external fetch -> AI risk score -> signed on-chain report.

References: `docs/chainlink-references.md`

## Frontend Terminal

`src/app/trade/page.tsx` now includes:

- Round-based top timeline with active neon indicator
- Left vertical bull/bear strength axis
- Realtime chart panel
- Wallet area
- Bet panel with quick amounts + custom input
- Balance, P/L, total winnings, total staked, win rate cards
- Bets history table

Theme: blue/violet neon, dark-only, glassmorphism-style panels.

## Backend AI Service

`backend-ai` exposes deterministic risk scoring:

- `POST /v1/risk-score`
- Output fields:
  - `confidence_score`
  - `anomaly_flag`
  - `source_consensus`
  - `evidence_hash`

## Quick Run

1. Install JavaScript dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill required RPC + contract values:

```powershell
Copy-Item .env.example .env
```

3. Run frontend (Next.js):

```bash
npm run dev
```

4. Run backend API/WebSocket bridge (default port `4000`, change if needed):

```bash
npm run backend
```

5. Run AI risk service:

```bash
python -m pip install -r backend-ai/requirements.txt
python -m uvicorn backend-ai.app.main:app --host 127.0.0.1 --port 8011
```

## Deployment And Simulation

- Deployment guide: `docs/deployment-guide.md`
- CRE simulation: `docs/chainlink-references.md`
- Full architecture and sequence: `docs/architecture.md`
- Threat model: `docs/security-checklist.md`
- Demo outline (3-5 min): `docs/demo-script.md`

## Important Notes

- No mock oracle settlement path is used in REAL mode.
- No admin outcome override path exists in the production contract suite.
- Functions outage path fails safe by forcing anomaly/cancellation behavior.
