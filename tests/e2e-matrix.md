# E2E Test Matrix

## Scenario 1: Standard Bull Resolution

1. Deploy contracts to Sepolia.
2. Create market (BTC/USD).
3. Wallet A places bull bet, Wallet B places bear bet.
4. Wait until lock timestamp.
5. Automation calls `lockRound()`.
6. Wait until expiry timestamp.
7. Automation calls `openResolutionWindow()` and `requestFunctionsRisk()`.
8. CRE trigger consumes `ResolutionWindowOpenedByEngine`.
9. CRE fetches external price + risk API and calls `onReport()`.
10. Settlement engine merges Functions + CRE reports and calls `resolveMarket()`.
11. Winner claims with `claim()` and treasury fee accounting is checked.

## Scenario 2: Risk Anomaly Cancellation

1. Force external source divergence in risk service (inject stale API response).
2. CRE report anomaly flag returns true.
3. Market transitions to `Cancelled`.
4. All participants claim full refunds.

## Scenario 3: Functions Timeout Safety

1. Disable Functions subscription funding.
2. Ensure CRE report arrives.
3. Wait past `functionsGracePeriod`.
4. Settlement engine finalizes with fail-safe anomaly path (market cancelled).
