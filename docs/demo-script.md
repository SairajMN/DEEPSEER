# Demo Video Outline (3-5 Minutes)

1. Intro (20s)
- Explain DEEPSEER: on-chain prediction markets with Chainlink Data Feeds + Functions + Automation + CRE + AI risk scoring.

2. Architecture Walkthrough (50s)
- Show `docs/architecture.md` diagram.
- Highlight deterministic outcome logic in `PredictionMarket.resolveMarket`.

3. Contract Deployment (40s)
- Run deploy script, show deployed addresses.
- Show roles configured for factory, treasury, settlement engine.

4. Live User Flow (90s)
- Connect wallet in frontend.
- Place Bull and Bear bets.
- Show lock + resolution progression.
- Trigger/observe Automation action.

5. CRE + AI + Functions Resolution (60s)
- Show CRE simulation or live run logs.
- Show backend `/v1/risk-score` response and on-chain `onReport` acceptance.
- Confirm `MarketResolvedByEngine` event and final outcome.

6. Claim and Treasury Accounting (30s)
- Claim winner payout.
- Show fee accrual and escrow reductions.

7. Security Notes (20s)
- Reference threat checklist and fail-safe cancellation on anomalies.
