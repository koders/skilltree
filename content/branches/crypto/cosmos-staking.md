# Cosmos Hub and the Cosmos SDK
- id: crypto.cosmos-staking
- requires: crypto.consensus, crypto.staking-metrics
- estimate: ~3 h
- facts_as_of: 2026-09-23

Why: SR's Cosmos Hub formula covers every Cosmos SDK chain it tracks, so learning one chain properly unlocks dozens.

## Rank 1
- [ ] [read] Cosmos Hub staking mechanics — ~30 min {#cosmos-hub-staking-mechanics}
  - Note: CometBFT (the Tendermint from crypto.consensus) gives instant finality; up to 180 active validators; delegated stake; 21-day unbonding.
- [ ] [read] [time-sensitive] ATOM inflation — ~30 min {#atom-inflation}
  - Note: inflation floats between 7% and 10% around a 66% bonded target. Proposal 848 cut the max to 10%; Proposal 868 (lower minimum) was rejected.
  - Verify: the current inflation band and bonded target in the mint params (the build item below pulls them).
  - Done when: I can explain why ATOM's staking yield runs at roughly double its inflation rate (reward ≈ inflation ÷ staking ratio, minus community tax), and check it against SR's live [@tool@ATOM page](https://www.stakingrewards.com/asset/cosmos).
- [ ] [build] Pull Cosmos Hub parameters from chain — ~1 h {#pull-cosmos-hub-parameters-from-chain}
  - Resource: public REST endpoints listed in the [@opensource@chain registry](https://github.com/cosmos/chain-registry)
  - Do: fetch `/cosmos/mint/v1beta1/params`, `/cosmos/mint/v1beta1/inflation`, `/cosmos/staking/v1beta1/pool`, `/cosmos/distribution/v1beta1/params`, `/cosmos/slashing/v1beta1/params`, then plug them into the SRB formula.
  - Done when: my hand-computed ATOM reward rate lands close to SR's, and I can state the double-sign and downtime slash fractions.
  - If stuck: start from SR's Cosmos Hub SRB doc and compute with SR's own inputs first.
- [ ] [read] Extra yield and liquid staking on Cosmos — ~30 min {#extra-yield-and-liquid-staking-on}
  - Note: Interchain Security consumer chains such as Neutron and Stride pay part of their fees to Hub validators. SR's ATOMSRB deliberately excludes these rewards.
  - Do: work out why a benchmark might leave them out. Then read up on the Liquid Staking Module (LSM), its governance caps, and stATOM from Stride.
- [ ] [read] [time-sensitive] Governance watch: "Tokenomics idea n°1" — ~20 min {#governance-watch-tokenomics-idea-n-1}
  - Resource: [@official@Cosmos Hub forum draft (Nov 2025)](https://forum.cosmos.network/t/tokenomics-idea-n-1/16354)
  - Note: proposes lock-based staking and a 2–6% inflation band.
  - Verify: whether it or a successor reached an on-chain vote.
  - Done when: I can say what a 2–6% band would do to SR's ATOM reward rate at today's staking ratio.
- [ ] [watch] One Cosmos Hub staking / Interchain Security explainer — ~20 min {#one-cosmos-hub-staking-interchain}
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=Cosmos+Hub+Interchain+Security+staking+explained)

## Recall
- Why is ATOM's staking yield roughly inflation divided by the staking ratio? {#q1}
- What is Interchain Security, and who gets paid? {#q2}
- How long is Cosmos Hub unbonding, and what does that mean for liquidity? {#q3}

## Sources
- [SR: Cosmos Hub asset page](https://www.stakingrewards.com/asset/cosmos) — as of 2026-09-23
- [Cosmos Hub forum: Tokenomics idea n°1](https://forum.cosmos.network/t/tokenomics-idea-n-1/16354) — as of 2026-09-23
