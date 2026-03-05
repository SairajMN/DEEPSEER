# Deployment Guide

## 1. Contracts

```bash
cd contracts
forge install
cp .env.example .env
source .env
forge script script/DeployDeepseer.s.sol:DeployDeepseer --rpc-url $RPC_URL --broadcast -vvvv
```

Create an initial market:

```bash
forge script script/CreateMarket.s.sol:CreateMarket --rpc-url $RPC_URL --broadcast -vvvv
```

## 2. Backend AI

```bash
cd backend-ai
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 3. CRE Workflow

```bash
npm run sync:cre

cd cre-workflows/deepseer-settlement
npm install
npm run check

cd ..
cp .env.example .env
cp secrets.yaml.example secrets.yaml
cre workflow simulate deepseer-settlement --target local-simulation
```

Before simulation, set:

- `cre-workflows/.env`: `RPC_URL`, `WORKFLOW_OWNER_ADDRESS`
- `cre-workflows/secrets.yaml`: `RISK_API_KEY`
- `cre-workflows/deepseer-settlement/config.json`: `settlementEngineAddress`

## 4. Frontend

```bash
cd <repository-root>
npm install
npm run build
npm run start
```

## 5. Post-Deploy Validation

1. Create market through factory.
2. Place both-side bets.
3. Verify lock event and resolution window event.
4. Verify Functions request ID emitted.
5. Verify CRE report submission and final market resolution.
6. Verify winner claim and treasury fee accounting.
