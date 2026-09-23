# On-chain Yield Products
- id: crypto.onchain-yield
- requires: crypto.defi-mechanics, crypto.staking-metrics
- related: finance.market-structure
- estimate: ~3 h

Why: SR rates on-chain yield; I need to know where each yield actually comes from.

## Rank 1
- [ ] [read] Morpho vaults: how a curator picks markets, sets caps and earns fees — ~30 min {#morpho-vaults-how-a-curator-picks}
- [ ] [read] Pendle: the principal/yield token split, and implied yield as a market price — ~30 min {#pendle-the-principal-yield-token-split}
- [ ] [read] Ethena USDe: yield = perp funding + staked-ETH yield — ~30 min {#ethena-usde-yield-perp-funding-staked}
  - Do: work out what happens when funding turns negative.
- [ ] [read] Stablecoins and tokenized treasuries — ~45 min {#stablecoins-and-tokenized-treasuries}
  - Do: what backs USDC and USDT, and how tokenized T-bill funds pay yield. Then read SR's [@article@Real Yield in a Debasement Era](https://www.stakingrewards.com/journal/research/real-yield-in-a-debasement-era).
- [ ] [do] Five high-yield pools — ~45 min {#five-high-yield-pools}
  - Resource: [@tool@DefiLlama Yields](https://defillama.com/yields)
  - Do: pick five pools paying over 10% and write one line on where each yield actually comes from.
  - Done when: each of the five has a named yield source and a named main risk.

## Recall
- Where does Ethena's yield come from, and when does it turn negative? {#q1}
- What does a Morpho curator control? {#q2}
- What do Pendle's principal and yield tokens represent? {#q3}

## Sources
- [SR: Real Yield in a Debasement Era](https://www.stakingrewards.com/journal/research/real-yield-in-a-debasement-era) — as of 2026-09-23
