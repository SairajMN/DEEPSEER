# Chainlink References

- Data Feeds: https://docs.chain.link/data-feeds
- Functions Overview: https://docs.chain.link/chainlink-functions
- Functions Consumer Example: `@chainlink/contracts/src/v0.8/functions/v1_0_0/example/FunctionsClientExample.sol`
- Automation Interfaces: `@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol`
- CRE Workflow Guide: https://docs.chain.link/cre
- CRE Prediction Market Template: https://github.com/smartcontractkit/cre-gcp-prediction-market-demo

## CRE Simulation

```bash
cd cre-workflows/deepseer-settlement
npm install
npm run check

cd ..
cp .env.example .env
cp secrets.yaml.example secrets.yaml
cre workflow simulate deepseer-settlement --target local-simulation
```

Use a real transaction/event index from `ResolutionWindowOpenedByEngine` when prompted by the simulator.

## Repository Chainlink File Map

- `contracts/src/PredictionMarket.sol`
- `contracts/src/SettlementEngine.sol`
- `contracts/script/DeployDeepseer.s.sol`
- `contracts/functions/risk-default.js`
- `contracts/.env.example`
- `cre-workflows/project.yaml`
- `cre-workflows/deepseer-settlement/main.ts`
- `cre-workflows/deepseer-settlement/externalData.ts`
- `cre-workflows/deepseer-settlement/risk.ts`
- `cre-workflows/deepseer-settlement/evm.ts`
- `cre-workflows/deepseer-settlement/workflow.yaml`
- `cre-workflows/deepseer-settlement/config.json`
- `cre-workflows/secrets.yaml.example`

## Strict Preflight For Submission

- Set real `RPC_URL` and `WORKFLOW_OWNER_ADDRESS` in `cre-workflows/.env`.
- Set a non-zero `settlementEngineAddress` in `cre-workflows/deepseer-settlement/config.json`.
- Create `cre-workflows/secrets.yaml` from example and provide `RISK_API_KEY`.
- Ensure `contracts/.env` has `FUNCTIONS_SOURCE` or `FUNCTIONS_SOURCE_FILE`.
