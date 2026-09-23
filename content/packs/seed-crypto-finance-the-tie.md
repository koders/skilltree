---
id: seed-crypto-finance-the-tie
title: Skill tree seed — Crypto & Finance for The Tie
owner: Rihards
created: 2026-09-23
facts_as_of: 2026-09-23
review_rounds: 4
branches: [swe, finance, crypto]
quests: [quest-crypto-finance-the-tie]
---

# Skill tree seed: Crypto & Finance for The Tie

This file seeds three branches of my skill tree and one quest through them. The content came from a learning plan that went through three review rounds. It's now reorganised as skills (nodes) with prerequisites, instead of linear courses.

## Conventions

Content rules live in `skill-authoring-guide.md`; this is the short version.

- **Branch** (`#`): a parent topic, e.g. Finance & Markets.
- **Skill** (`##`): a node in the tree. Metadata lines:
  - `id`: `branch.skill-name`
  - `requires`: blocking prerequisite ids; may cross branches; `—` if none
  - `related`: optional soft links
  - `status`: only for starting skills, e.g. `learned (self-reported)`
  - `estimate`: total hours
- **Why:** after the metadata, what the skill is for in my world.
- **Rank** (`###`): a depth level within a skill. A rank may add its own `requires`.
- **Recall** (`### Recall`): 3+ questions. They're the placement test (answer them all before starting → learned, tested out), the spaced-review cards after learning, and the rust check.
- **Item** (`- [ ]`): `- [ ] [type] Title — ~time`. Types: `watch`, `read`, `do`, `build`, `output`, `habit`.
- **Item sub-bullets:**
  - `Resource:` typed links, roadmap.sh-style `[@type@Title](url)`; types are listed in the guide
  - `Do:` / `Skip:` instructions
  - `Done when:` observable self-check, at least one per rank
  - `If stuck:` required on `build` items
  - `Note:` context
  - `Verify:` for time-sensitive facts
- `[time-sensitive]` after the type: the item states a current fact, as of `facts_as_of`, that goes stale after the freshness window.
- `@search@` links are YouTube searches still to be resolved into exact videos.
- `[output]` items are written deliverables, the loot of a skill.

Why this plan exists: every skill maps to a part of The Tie's business, so what I learn applies directly at work.

| Business line | What it does | Skills that feed it |
| --- | --- | --- |
| The Tie Terminal | Market intelligence for hedge funds, asset managers, banks | finance.market-structure, finance.institutions, finance.market-intelligence |
| Staking Rewards | Ratings for institutional staking, on-chain yield, DeFi risk | crypto.staking-metrics, all staking skills, crypto.onchain-yield, crypto.defi-risk |
| Stakin / Infrastructure Solutions | Non-custodial staking on 40+ networks; bridging, oracles, RPC under consideration | crypto.consensus, crypto.institutional-staking, crypto.infrastructure |
| The Tie Capital | Broker-dealer: capital raises, M&A, TGEs, token-to-equity conversions | finance.capital-formation |

---

## Review log

**Round 1 (2026-09-23)**: the first draft listed resources but not what to do with them.
- Every item got an exact scope, a time estimate and a "Done when" check; written outputs added.
- Current facts verified and dated.
- Added SR's own methodology, failure case studies, and hands-on builds.

**Round 2 (2026-09-23)**: answers were keep the 10–12 week pace, Terminal access yes, add a third deep chain.
- Cosmos Hub added as the third deep chain.
- Terminal woven through the plan.
- Schedule set to 12 weeks.

**Round 3 (2026-09-23)**: reframed for skilltree.
- The six linear courses became three branches of skills with prerequisites. Software Engineering is seeded with skills I already have.
- The 12-week plan became a quest through the tree.
- The weekly habit became maintenance.
- MIT session 17 moved into finance.market-structure.
- Terminal work split into two ranks: Rank 1 needs staking metrics, Rank 2 needs market structure.

**Round 4 (2026-09-23)**: aligned with the new `skill-authoring-guide.md`, borrowing from Human Skill Tree and roadmap.sh.
- Every skill got a Why line and a Recall section (placement test, spaced review, rust check).
- Resources are now typed, roadmap.sh-style.
- Build items got If stuck lines.
- Missing Done when checks were added to finance.institutions, finance.capital-formation, crypto.institutional-staking, crypto.onchain-data and crypto.onchain-yield.
- Known gap: 14 `@search@` links still need resolving into exact videos.

**Open for round 5**
- Is ~4–5 h/week for 12 weeks realistic, or should some finance.institutions items become optional?
- Should pre-existing skills (React, Next.js…) get self-assessed ranks, and should SEO/AEO become its own branch?
- Any area to go deeper on (e.g. Bitcoin staking/BTCfi, tokenized real-world assets)?

---

## Sources (for facts stated above, as of 2026-09-23)

- [The Tie homepage — business lines](https://www.thetie.io/)
- [The Tie: acquisition of Stakin](https://www.thetie.io/insights/the-tie-acquires-stakin-1-5b-aud-to-launch-infrastructure-solutions-division)
- [The Block: The Tie acquires Stakin, infrastructure plans](https://www.theblock.co/post/384338/crypto-data-platform-the-tie-acquires-stakin-in-cash-and-equity-deal)
- [The Tie Terminal product page](https://www.thetie.io/solutions/terminal)
- [Roughgarden: Foundations of Blockchains course page](https://timroughgarden.github.io/fob21/)
- [MIT OCW 15.S12](https://ocw.mit.edu/courses/15-s12-blockchain-and-money-fall-2018/)
- [SR docs: Cosmos Hub SRB](https://docs.stakingrewards.com/staking-data/methodologies/cosmos-ecosystem-srb/cosmos-hub-srb)
- [SR docs: Real Reward Rate](https://docs.stakingrewards.com/staking-data/metrics/real-reward-rate)
- [SR: Real Yield in a Debasement Era](https://www.stakingrewards.com/journal/research/real-yield-in-a-debasement-era)
- [SR: Cosmos Hub asset page](https://www.stakingrewards.com/asset/cosmos)
- [Figment: Glamsterdam for institutional stakers](https://www.figment.io/insights/glamsterdam-what-ethereums-next-upgrade-means-for-institutional-stakers/)
- [TokenToolHub: Glamsterdam timing](https://tokentoolhub.com/ethereum-glamsterdam-upgrade-2026/)
- [Kiln: Alpenglow](https://www.kiln.fi/post/solanas-alpenglow-upgrade-what-it-means-for-stakers-and-validators)
- [Solana forum: SIMD-0550](https://forum.solana.com/t/simd-0550-proposal-to-double-disinflation/4874)
- [Blockworks Research: SOL value accrual](https://app.blockworksresearch.com/unlocked/sol-value-accrual)
- [Avalanche Builder Hub: Helicon notice](https://build.avax.network/integrations/thetie)
- [CoinStats: Cosmos Hub, Proposals 848/868](https://coinstats.app/ai/a/fundamental-analysis-cosmos)
- [Cube Exchange: ATOM inflation band](https://www.cube.exchange/what-is/atom)
- [CryptoToolbox: ATOM validators and unbonding](https://cryptotoolbox.io/atom-staking)
- [Cosmos Hub forum: Tokenomics idea n°1](https://forum.cosmos.network/t/tokenomics-idea-n-1/16354)
- [Galaxy: Crypto's most violent flash crash yet](https://www.galaxy.com/insights/research/cryptos-flash-crash-liquidation-binance-adl-auto-deleveraging)
- [CoinGecko: October 10 crash explained](https://www.coingecko.com/learn/october-10-crypto-crash-explained)
- [Decrypt: Stream Finance](https://decrypt.co/347285/stream-finance-stablecoin-plunges-77-protocol-fund-manager-loses-93-million)
- [RockawayX: October 2025 update](https://rockawayx.com/insights/crypto-market-update-october-2025)
- [Elliptic: end of MiCA's transitional period](https://www.elliptic.co/blog/the-end-of-micas-transitional-period)
- [Elvinger Hoss: MiCA transitional period ended](https://elvingerhoss.lu/insights/publications/mica-transitional-period-has-come-end-what-comes-next-casps)
- [Triple-A: CLARITY Act status](https://www.triple-a.io/blog/clarity-act)
- [Latham & Watkins: US Crypto Policy Tracker](https://www.lw.com/en/us-crypto-policy-tracker/legislative-developments)
