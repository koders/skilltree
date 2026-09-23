# Staking Metrics (SR methodology)
- id: crypto.staking-metrics
- requires: crypto.eth-validators
- estimate: ~2.5 h

Why: SR's core numbers; being able to recompute them makes me better at building and explaining them.

## Rank 1
- [ ] [read] SR metric and methodology docs — ~1.5 h {#sr-metric-and-methodology-docs}
  - Resource: [@official@Reward Rate](https://docs.stakingrewards.com/staking-data/metrics/reward-rate), [@official@Real Reward Rate](https://docs.stakingrewards.com/staking-data/metrics/real-reward-rate), [@official@Ethereum SRB](https://docs.stakingrewards.com/staking-data/methodologies/ethereum-srb), [@official@Cosmos Hub SRB](https://docs.stakingrewards.com/staking-data/methodologies/cosmos-ecosystem-srb/cosmos-hub-srb)
  - Note: SRB is non-compounded and ignores slashing. The Cosmos Hub formula is the reference for every Cosmos SDK chain SR covers.
  - Done when: I recompute ATOM's reward rate by hand (annual provisions + annualized fees, minus community tax, divided by total staked) and land close to SR's published figure.
- [ ] [do] Real vs nominal reward rate for ETH, SOL, ATOM — ~1 h {#real-vs-nominal-reward-rate-for}
  - Do: apply SR's formula, (1 + reward rate) / (1 + inflation) − 1.
  - Done when: I can say which has the highest nominal rate, which has the highest real rate, and why they differ.

## Recall
- How is SR's reward rate calculated for a Cosmos SDK chain? {#q1}
- Why can a high nominal reward rate hide a low real reward rate? {#q2}
- What does SRB leave out, and why does that matter for comparisons? {#q3}

## Sources
- [SR docs: Cosmos Hub SRB](https://docs.stakingrewards.com/staking-data/methodologies/cosmos-ecosystem-srb/cosmos-hub-srb) — as of 2026-09-23
- [SR docs: Real Reward Rate](https://docs.stakingrewards.com/staking-data/metrics/real-reward-rate) — as of 2026-09-23
