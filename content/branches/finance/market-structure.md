# Market Structure and Derivatives
- id: finance.market-structure
- requires: finance.money-settlement
- related: crypto.liquid-staking, crypto.onchain-yield
- estimate: ~4.5 h

Why: Terminal clients trade derivatives daily; perps, basis and liquidations drive most crypto price action.

## Rank 1 — Mechanics
- [ ] [watch] MIT 15.S12 session 17 (Secondary Markets and Crypto-Exchanges) — ~1 h {#mit-15-s12-session-17-secondary}
  - Resource: [@course@MIT OCW course page](https://ocw.mit.edu/courses/15-s12-blockchain-and-money-fall-2018/)
- [ ] [do] Perpetual futures, tracked live for a week — ~1 h total {#perpetual-futures-tracked-live-for-a}
  - Resource: [@tool@CoinGlass](https://www.coinglass.com)
  - Do: learn funding rate, open interest, liquidation and auto-deleveraging (ADL). Watch BTC and ETH funding and open interest daily for one week.
  - Done when: I can predict which way funding moves when longs pile in, and explain what ADL does to a profitable trader.
- [ ] [read] Basis trade: long spot or ETF, short CME futures — ~45 min {#basis-trade-long-spot-or-etf}
  - Note: connects to Ethena's yield in crypto.onchain-yield.
- [ ] [watch] One crypto options primer: calls, puts, implied volatility, skew — ~1 h {#one-crypto-options-primer-calls-puts}
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=crypto+options+implied+volatility+skew+explained)

## Rank 2 — Stress
- [ ] [read] Case study: the Oct 10, 2025 crash — ~45 min {#case-study-the-oct-10-2025}
  - Resource: [@article@Galaxy's minute-by-minute analysis](https://www.galaxy.com/insights/research/cryptos-flash-crash-liquidation-binance-adl-auto-deleveraging)
  - Note: about $19B of leveraged positions liquidated across 1.6M accounts after a tariff headline.
  - Done when: I can walk through headline → liquidations → ADL → stablecoin and LST depegs on one venue, and say which parts SR data would have flagged.

## Recall
- What is a perp funding rate, and who pays whom when it's positive? {#q1}
- How does the basis trade earn a return, and what makes it go wrong? {#q2}
- What is auto-deleveraging, and when does an exchange trigger it? {#q3}

## Sources
- [MIT OCW 15.S12](https://ocw.mit.edu/courses/15-s12-blockchain-and-money-fall-2018/) — as of 2026-09-23
- [Galaxy: Crypto's most violent flash crash yet](https://www.galaxy.com/insights/research/cryptos-flash-crash-liquidation-binance-adl-auto-deleveraging) — as of 2026-09-23
- [CoinGecko: October 10 crash explained](https://www.coingecko.com/learn/october-10-crypto-crash-explained) — as of 2026-09-23

## Review log
- **Round 5 (2026-09-23)**: attached seed source that backs facts in this skill (CoinGecko); the import only matched sources by URL.
