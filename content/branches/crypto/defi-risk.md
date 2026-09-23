# DeFi Risk
- id: crypto.defi-risk
- requires: crypto.onchain-yield, crypto.liquid-staking
- estimate: ~3.5 h

Why: SR's DeFi risk ratings depend on spotting how yield products fail.

## Rank 1
- [ ] [read] Stream Finance, November 2025 — ~1 h {#stream-finance-november-2025}
  - Resource: [@article@Decrypt](https://decrypt.co/347285/stream-finance-stablecoin-plunges-77-protocol-fund-manager-loses-93-million)
  - Note: an external fund manager lost about $93M, xUSD fell 77% in a day, and roughly $285M of debt across Euler, Silo, Morpho and Gearbox was exposed. Elixir's deUSD had lent Stream 68M USDC, about 65% of its backing.
  - Done when: I can draw the chain from user deposit → curator vault → Stream, and name the risk each curator underpriced.
- [ ] [do] rekt.news leaderboard triage — ~45 min {#rekt-news-leaderboard-triage}
  - Resource: [@tool@rekt.news leaderboard](https://rekt.news/leaderboard/)
  - Do: sort the top 10 losses into smart-contract bug, key compromise, oracle manipulation or operational failure.
- [ ] [build] Dune: fork a lending dashboard, then write one query myself (e.g. daily Aave liquidations) — ~1 h {#dune-fork-a-lending-dashboard-then}
  - Resource: [@tool@Dune](https://dune.com)
  - If stuck: fork a single query rather than a dashboard, and change only its date filter first.
- [ ] [do] Audit my own lending positions: liquidation threshold, oracle, curator or market, smart-contract exposure — ~30 min {#audit-my-own-lending-positions}
- [ ] [output] One-page DeFi risk checklist I'd apply before depositing anywhere — ~30 min {#one-page-defi-risk-checklist-id}

## Recall
- What chain of exposures let Stream Finance's loss spread to other protocols? {#q1}
- What are the main categories of DeFi losses? {#q2}
- What do you check before depositing into a vault? {#q3}

## Sources
- [Decrypt: Stream Finance](https://decrypt.co/347285/stream-finance-stablecoin-plunges-77-protocol-fund-manager-loses-93-million) — as of 2026-09-23
