# DEEPSEER Contracts

Foundry project for protocol contracts.

## Files

- `src/PredictionMarketFactory.sol`
- `src/PredictionMarket.sol`
- `src/SettlementEngine.sol`
- `src/Treasury.sol`
- `src/interfaces/RiskOracleInterface.sol`

## Install Dependencies

```bash
forge install OpenZeppelin/openzeppelin-contracts
forge install smartcontractkit/chainlink-brownie-contracts
forge install foundry-rs/forge-std
```

## Test

```bash
forge test -vvv
```

## Deploy

```bash
forge script script/DeployDeepseer.s.sol:DeployDeepseer --rpc-url $RPC_URL --broadcast -vvvv
```

## Create a Market

1. Fill `PREDICTION_MARKET_FACTORY_ADDRESS`, `MARKET_QUESTION`, and `MARKET_PRICE_FEED` in `contracts/.env`.
2. Load env and run:

```bash
set -a
source .env
set +a

forge script script/CreateMarket.s.sol:CreateMarket --rpc-url "$RPC_URL" --broadcast -vvvv
```
