# Threat Model And Mitigations

| Threat | Attack Surface | Mitigation |
|---|---|---|
| Oracle spoofing | Price input for lock/final resolution | Chainlink Data Feed only, positive-price checks, answeredInRound validation, staleness caps, no admin-settable outcome |
| Callback injection | Settlement callbacks | `FunctionsClient` router-only fulfillment, CRE `onReport` restricted by forwarder and workflow metadata checks |
| Automation replay | `performUpkeep` with stale performData | Action and market state re-validated inside `performUpkeep`; no trusted caller assumption |
| Flash-loan manipulation | Late capital inflow before lock | `minBetLeadTime` blocks last-moment bets; lock/final prices derived from oracle snapshots, not AMM spot |
| Timestamp attack | Using stale timestamps for resolution | Lock/expiry gating, feed staleness enforcement, external timestamp max-delay checks |
| Early resolution | Resolve before expiry | `openResolutionWindow` and `resolveMarket` both require `block.timestamp >= expiryTimestamp` |
| Bet after lock | Post-lock betting | `placeBet` checks `block.timestamp + minBetLeadTime < lockTimestamp` and `phase == Trading` |
| Governance abuse | Privileged role misuse | Granular roles (`CREATOR`, `FACTORY`, `CONFIG`, `MARKET_MANAGER`, `TREASURER`), no privileged outcome override path |
| Treasury drain | Unauthorized payout/refund | Per-market escrow accounting, role-gated market calls only, fee withdrawals limited to accrued amount |
| Reentrancy | Claim/payout paths | `ReentrancyGuard` on treasury and market claim functions, external transfer after state update |
| Frontend spoofing | Phishing / wrong contract links | Contract addresses pinned in env/config, wallet chain checks, explicit REAL/DEMO mode labels |
| Risk API tampering | Off-chain risk signal corruption | API key auth, deterministic scoring, multi-source consensus, hashed evidence payload returned on-chain |
| CRE report forgery | Fake workflow report | Forwarder restriction + workflow ID/owner/name validation before report acceptance |
| Functions outage | Missing fulfillment | Grace period + fail-safe anomaly path to cancel uncertain markets |

## Residual Risks

- External APIs can degrade or rate-limit simultaneously; fail-safe mode cancels markets, reducing liveness.
- Large oracle outages still require protocol-level pause response.
- Governance key compromise remains a systemic risk; production deployment should use multisig + timelocks.
