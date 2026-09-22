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

# Branch: Software Engineering

- id: swe
- note: seeded with skills I already have (self-reported). No items yet; later quests can add ranks to deepen them.

## React
- id: swe.react
- requires: —
- status: learned (self-reported)

## Next.js
- id: swe.nextjs
- requires: swe.react
- status: learned (self-reported)

## GraphQL
- id: swe.graphql
- requires: —
- status: learned (self-reported)

## Web3 frontend (ethers, viem)
- id: swe.web3-frontend
- requires: swe.react
- status: learned (self-reported)

## Agentic development with Claude Code
- id: swe.claude-code
- requires: —
- status: learned (self-reported)

---

# Branch: Finance & Markets

- id: finance

## Money, Ledgers and Settlement
- id: finance.money-settlement
- requires: —
- estimate: ~4 h

Why: The finance framing crypto competes with; Terminal clients think in clearing, settlement and ledgers.

### Rank 1
- [ ] [watch] MIT 15.S12 Blockchain and Money (Gary Gensler), sessions 1, 2, 11, 21 — ~4 h
  - Resource: [@course@MIT OCW course page](https://ocw.mit.edu/courses/15-s12-blockchain-and-money-fall-2018/)
  - Do: 1 (Introduction), 2 (Money, Ledgers and Bitcoin), 11 (Blockchain Economics), 21 (Post-Trade Clearing, Settlement and Processing). 1.25x speed.
  - Note: recorded in 2018. Treat named projects as history; focus on the finance framing.
  - Done when: I can explain what clearing and settlement are, and why tokenization pitches target them.

### Recall
- What's the difference between clearing and settlement?
- What problem did Bitcoin solve that earlier digital money attempts didn't?
- Who maintains the ledgers in today's financial system, and what does that cost?

## Market Structure and Derivatives
- id: finance.market-structure
- requires: finance.money-settlement
- related: crypto.liquid-staking, crypto.onchain-yield
- estimate: ~4.5 h

Why: Terminal clients trade derivatives daily; perps, basis and liquidations drive most crypto price action.

### Rank 1 — Mechanics
- [ ] [watch] MIT 15.S12 session 17 (Secondary Markets and Crypto-Exchanges) — ~1 h
  - Resource: [@course@MIT OCW course page](https://ocw.mit.edu/courses/15-s12-blockchain-and-money-fall-2018/)
- [ ] [do] Perpetual futures, tracked live for a week — ~1 h total
  - Resource: [@tool@CoinGlass](https://www.coinglass.com)
  - Do: learn funding rate, open interest, liquidation and auto-deleveraging (ADL). Watch BTC and ETH funding and open interest daily for one week.
  - Done when: I can predict which way funding moves when longs pile in, and explain what ADL does to a profitable trader.
- [ ] [read] Basis trade: long spot or ETF, short CME futures — ~45 min
  - Note: connects to Ethena's yield in crypto.onchain-yield.
- [ ] [watch] One crypto options primer: calls, puts, implied volatility, skew — ~1 h
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=crypto+options+implied+volatility+skew+explained)

### Rank 2 — Stress
- [ ] [read] Case study: the Oct 10, 2025 crash — ~45 min
  - Resource: [@article@Galaxy's minute-by-minute analysis](https://www.galaxy.com/insights/research/cryptos-flash-crash-liquidation-binance-adl-auto-deleveraging)
  - Note: about $19B of leveraged positions liquidated across 1.6M accounts after a tariff headline.
  - Done when: I can walk through headline → liquidations → ADL → stablecoin and LST depegs on one venue, and say which parts SR data would have flagged.

### Recall
- What is a perp funding rate, and who pays whom when it's positive?
- How does the basis trade earn a return, and what makes it go wrong?
- What is auto-deleveraging, and when does an exchange trigger it?

## How Institutions Operate
- id: finance.institutions
- requires: finance.market-structure
- estimate: ~3.5 h + optional book (~6 h)

Why: How The Tie's customers (funds, market makers, ETF issuers, treasury companies) actually operate.

### Rank 1
- [ ] [watch] Patrick Boyle on market making and HFT — ~1 h
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=Patrick+Boyle+market+makers+high+frequency+trading)
  - Note: ex-hedge-fund manager; a useful crypto skeptic.
  - Done when: I can explain how a market maker earns the spread and what inventory risk is.
- [ ] [read] [time-sensitive] ETFs and digital asset treasury companies — ~30 min
  - Do: learn mNAV (market cap ÷ crypto holdings). Strategy's mNAV premium fell to about 1.03x in October 2025 ([@article@RockawayX](https://rockawayx.com/insights/crypto-market-update-october-2025)).
  - Verify: where it is today, and why that matters for the treasury-company trade.
  - Done when: I can explain why an mNAV below 1 pressures a treasury company, and what it can do about it.
- [ ] [read] Subscribe to Money Stuff (free) and read two weeks of issues — ~1 h
  - Resource: [@feed@Money Stuff](https://www.bloomberg.com/account/newsletters/money-stuff)
- [ ] [watch] Macro context: one Forward Guidance and one Bell Curve episode — ~1 h at 1.5x
  - Resource: [@search@Forward Guidance](https://www.youtube.com/results?search_query=Forward+Guidance+Blockworks), [@search@Bell Curve](https://www.youtube.com/results?search_query=Bell+Curve+Blockworks+podcast)
- [ ] [read] Optional book, pick one: Flash Boys (market structure), The Cryptopians (Ethereum's early years), Number Go Up (the skeptic's view) — ~6 h

### Recall
- How does a market maker make money, and what is inventory risk?
- What is mNAV, and what happens to a treasury company when it falls below 1?
- How do spot ETF flows affect the underlying market?

## Tokenomics and Capital Formation
- id: finance.capital-formation
- requires: finance.market-structure
- estimate: ~2 h

Why: Unlocks, fundraising and token-to-equity deals are The Tie Capital's world and a major Terminal dataset.

### Rank 1
- [ ] [do] Map one token's next 12 months of unlocks — ~30 min
  - Resource: [@tool@Tokenomist](https://tokenomist.ai)
  - Note: circulating supply vs FDV, vesting, fundraising rounds.
  - Done when: I can name the largest unlock in the next 12 months relative to circulating supply, and who receives it.
- [ ] [watch] Deal side (maps to The Tie Capital): two Empire episodes on token-to-equity, M&A or TGEs — ~1 h at 1.5x
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=Empire+podcast+Blockworks+token+equity+M%26A)
  - Done when: I can explain what a token-to-equity conversion is and why a protocol would do one.
- [ ] [do] Terminal fundraising database: the most active investors in staking-infrastructure and liquid-staking companies over the last 12 months — ~20 min

### Recall
- What's the difference between circulating market cap and FDV, and why do unlocks matter?
- What is a TGE, and what typically happens to supply around it?
- Why would a protocol convert tokens to equity?

## Market Intelligence with The Tie Terminal
- id: finance.market-intelligence
- requires: —
- estimate: ~4 h

Why: The Terminal is The Tie's core product; using it like a client makes me better at building for SR and the Terminal.

### Rank 1 — Feeds and alerts
- requires: crypto.staking-metrics
- [ ] [do] Build a custom news feed for staking and governance on ETH, SOL, ATOM — ~20 min
  - Do: in the source filter, include regulators and court cases alongside crypto-native publications.
- [ ] [do] Set one alert on a staking metric (e.g. active validators) for a chain I follow — ~10 min
- [ ] [do] Compare the Terminal's staking datasets with SR's asset page for one chain — ~30 min
  - Done when: I know which Terminal staking fields match SR's definitions and which differ. Ask the Terminal team where the source isn't obvious.

### Rank 2 — Research workflow
- requires: finance.market-structure
- [ ] [do] Screener: filter by sector and market cap, shortlist mid-caps with an unlock in the next 30 days, pick one — ~20 min
- [ ] [do] Chart it with news and unlock overlays, and follow it for one week — ~45 min total
- [ ] [build] Dashboard: start from a curated one with the CME vs crypto-native basis and perp funding chart, add a news widget for the token, and build one custom widget (SQL, Python or AI Widget Studio) — ~1 h
  - Done when: I can read the basis chart and say whether the market was paying up for leverage that week.
  - If stuck: clone a curated dashboard as-is and change one widget; ask the Terminal team for the basis dataset name.
- [ ] [do] AI Narrative Engine: how the "staking ETF" or "restaking" narrative moved over the last quarter — ~15 min
- [ ] [output] Five bullets on what moved my token, plus one paragraph: "What would a hedge fund want from SR data inside the Terminal?" — ~30 min

### Recall
- Which Terminal features would you combine to answer "why did this token move today?"
- What does the CME vs crypto-native basis tell you about demand for leverage?
- Which Terminal staking fields differ from SR's definitions?

## Crypto Regulation (EU and US)
- id: finance.regulation
- requires: finance.money-settlement
- estimate: ~2.5 h

Why: Regulation decides what institutions and staking providers can do; MiCA also governs my own holdings in Latvia.

### Rank 1
- [ ] [read] [time-sensitive] EU / MiCA — ~1 h
  - Note: the transition period ended EU-wide on July 1, 2026; Latvia's own window closed June 30, 2025. Staking, lending and stablecoin interest may be addressed in a future "MiCA 2".
  - Do: check which Baltic firms are on Latvijas Banka's CASP register.
  - Verify: whether a "MiCA 2" proposal has been published, and whether staking or lending rules changed.
- [ ] [read] [time-sensitive] US — ~1 h
  - Resource: [@article@Latham & Watkins US Crypto Policy Tracker](https://www.lw.com/en/us-crypto-policy-tracker/legislative-developments)
  - Note: the GENIUS Act (stablecoins) became law in July 2025. The CLARITY Act (market structure) failed a Senate cloture vote 49–50 on Sept 15, 2026 and is considered unlikely before 2027.
  - Verify: whether CLARITY has been revived.
  - Done when: I can explain the SEC/CFTC split CLARITY would create, and why stablecoin yield and DeFi developer liability were sticking points.
- [ ] [do] Terminal regulation feed — ~30 min
  - Do: build a news feed limited to regulators, central banks and court-case sources, and set alerts for new SEC filings on staking ETFs.

### Recall
- What changed for crypto service providers in the EU on July 1, 2026?
- How would the CLARITY Act split oversight between the SEC and CFTC?
- What does the GENIUS Act regulate, and what does it leave out?

---

# Branch: Crypto & Web3

- id: crypto

## Consensus and Proof of Stake
- id: crypto.consensus
- requires: —
- estimate: ~5 h

Why: Everything in staking rests on consensus; the foundation for every chain SR covers.

### Rank 1
- [ ] [watch] Roughgarden — Foundations of Blockchains, selected topics — ~5 h
  - Resource: [@video@videos](https://timroughgarden.org/videos.html), [@course@course page with readings](https://timroughgarden.github.io/fob21/)
  - Do: watch only these topics: the SMR problem (intro), Tendermint and partial synchrony, longest-chain consensus, proof-of-work sybil resistance, proof-of-stake sybil resistance, transaction fees and EIP-1559, economic security.
  - Skip: the Dolev-Strong and FLP proofs on the first pass; read the [@article@Lectures 2–7 overview PDF](https://timroughgarden.github.io/fob21/l/l2-7-overview.pdf) instead.
  - Done when: I can explain why "33%" keeps appearing in PoS whitepapers, and why PoS chains finalize while Bitcoin's finality is only probabilistic.

### Recall
- Why can BFT consensus tolerate fewer than one third faulty validators, but not more?
- What's the difference between probabilistic and deterministic finality?
- How does proof of stake provide sybil resistance?

## Ethereum Validator Economics
- id: crypto.eth-validators
- requires: crypto.consensus
- estimate: ~3.5 h

Why: Ethereum is SR's anchor asset; validator economics explains where ETH staking yield comes from.

### Rank 1
- [ ] [read] ethereum.org proof-of-stake docs — ~30 min
  - Resource: [@official@ethereum.org PoS](https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/)
- [ ] [read] Upgrading Ethereum (Ben Edgington), incentive-layer chapters — ~2 h
  - Resource: [@book@eth2book.info](https://eth2book.info)
  - Do: read staking, issuance, rewards, penalties, inactivity leak, slashing.
  - Done when: I can name the three validator duties (attesting, proposing, sync committee) and roughly what share of rewards each pays.
- [ ] [output] One-page note: "How a validator earns and loses money on Ethereum" — ~1 h

### Recall
- What are the three validator duties, and which earns the most?
- What gets a validator slashed, as opposed to merely penalized?
- What is the inactivity leak for?

## Staking Metrics (SR methodology)
- id: crypto.staking-metrics
- requires: crypto.eth-validators
- estimate: ~2.5 h

Why: SR's core numbers; being able to recompute them makes me better at building and explaining them.

### Rank 1
- [ ] [read] SR metric and methodology docs — ~1.5 h
  - Resource: [@official@Reward Rate](https://docs.stakingrewards.com/staking-data/metrics/reward-rate), [@official@Real Reward Rate](https://docs.stakingrewards.com/staking-data/metrics/real-reward-rate), [@official@Ethereum SRB](https://docs.stakingrewards.com/staking-data/methodologies/ethereum-srb), [@official@Cosmos Hub SRB](https://docs.stakingrewards.com/staking-data/methodologies/cosmos-ecosystem-srb/cosmos-hub-srb)
  - Note: SRB is non-compounded and ignores slashing. The Cosmos Hub formula is the reference for every Cosmos SDK chain SR covers.
  - Done when: I recompute ATOM's reward rate by hand (annual provisions + annualized fees, minus community tax, divided by total staked) and land close to SR's published figure.
- [ ] [do] Real vs nominal reward rate for ETH, SOL, ATOM — ~1 h
  - Do: apply SR's formula, (1 + reward rate) / (1 + inflation) − 1.
  - Done when: I can say which has the highest nominal rate, which has the highest real rate, and why they differ.

### Recall
- How is SR's reward rate calculated for a Cosmos SDK chain?
- Why can a high nominal reward rate hide a low real reward rate?
- What does SRB leave out, and why does that matter for comparisons?

## Ethereum Staking Today
- id: crypto.ethereum-staking
- requires: crypto.eth-validators, crypto.staking-metrics
- estimate: ~3 h

Why: Current Ethereum changes (Pectra, Glamsterdam, MEV) move SR's ETH figures and Stakin's revenue.

### Rank 1
- [ ] [read] Pectra-era staking changes — ~45 min
  - Do: skim the motivation sections of EIP-7251 (consolidations up to 2,048 ETH per validator) and EIP-7002 (execution-layer-triggered exits).
- [ ] [read] [time-sensitive] Figment — Glamsterdam: what it means for institutional stakers — ~30 min
  - Resource: [@article@Figment article](https://www.figment.io/insights/glamsterdam-what-ethereums-next-upgrade-means-for-institutional-stakers/)
  - Note: focuses on EIP-7732 (enshrined PBS) and EIP-8061.
  - Verify: as of mid-August 2026 no mainnet date was set (ethereum.org planned Q4 2026). Check whether it has shipped.
  - Done when: I can explain how ePBS changes the role of MEV-boost relays, and what that means for a staking provider's revenue.
- [ ] [watch] Finematics — Decoding MEV: Past, Present, Future — ~20 min
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=Finematics+Decoding+MEV+Past+Present+Future)
- [ ] [do] Check live Ethereum staking data — ~1 h
  - Resource: [@tool@beaconcha.in](https://beaconcha.in), [@tool@rated.network](https://www.rated.network)
  - Do: look at the entry and exit queues on beaconcha.in, then check operator effectiveness on rated.network for three operators SR lists as providers.

### Recall
- What did EIP-7251 change for large stakers?
- How does ePBS change the role of MEV-boost relays?
- What do the entry and exit queues tell you about staking demand?

## Solana and Delegated Proof of Stake
- id: crypto.solana-staking
- requires: crypto.staking-metrics
- estimate: ~4 h

Why: Solana is a major staking asset on SR, and its inflation and consensus are actively changing.

### Rank 1
- [ ] [read] [time-sensitive] Kiln — Alpenglow: what it means for stakers and validators — ~45 min
  - Resource: [@article@Kiln article](https://www.kiln.fi/post/solanas-alpenglow-upgrade-what-it-means-for-stakers-and-validators)
  - Note: governance (SIMD-0326) passed in September 2025.
  - Verify: mainnet was targeted for Q3–Q4 2026 alongside Agave 4.1. Check whether it's live.
- [ ] [read] [time-sensitive] The SOL inflation debate — ~1 h
  - Resource: [@official@SIMD-0550 forum post](https://forum.solana.com/t/simd-0550-proposal-to-double-disinflation/4874)
  - Note: SIMD-0228 failed in 2025. SIMD-0550 would double disinflation, taking nominal staking yield from 5.84% to 4.34% in year one, per its authors.
  - Verify: whether SIMD-0550 went to a vote.
  - Done when: I can say how SR's SOL reward rate would move if it passes, and why low-stake validators are hurt most.
- [ ] [read] Blockworks Research — SOL value accrual — ~45 min
  - Resource: [@article@article](https://app.blockworksresearch.com/unlocked/sol-value-accrual)
  - Do: focus on SIMD-0123 (in-protocol priority-fee sharing with stakers) and why stakers' share of revenue fell.
- [ ] [watch] 1–2 Lightspeed episodes on Alpenglow or SOL issuance — ~1 h
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=Lightspeed+podcast+Alpenglow+SOL+inflation)
- [ ] [do] [time-sensitive] Avalanche Helicon check — ~15 min
  - Note: Helicon went live on mainnet Sept 22, 2026 with auto-renewed staking and shorter minimum durations.
  - Do: check whether SR's AVAX page reflects it.
  - Verify: the current AVAX minimum staking duration and auto-renew behaviour after Helicon.

### Recall
- What would SIMD-0550 do to SOL's nominal staking yield?
- Where does a SOL staker's yield come from besides inflation?
- What does Alpenglow replace, and why do validators care?

## Cosmos Hub and the Cosmos SDK
- id: crypto.cosmos-staking
- requires: crypto.consensus, crypto.staking-metrics
- estimate: ~3 h

Why: SR's Cosmos Hub formula covers every Cosmos SDK chain it tracks, so learning one chain properly unlocks dozens.

### Rank 1
- [ ] [read] Cosmos Hub staking mechanics — ~30 min
  - Note: CometBFT (the Tendermint from crypto.consensus) gives instant finality; up to 180 active validators; delegated stake; 21-day unbonding.
- [ ] [read] [time-sensitive] ATOM inflation — ~30 min
  - Note: inflation floats between 7% and 10% around a 66% bonded target. Proposal 848 cut the max to 10%; Proposal 868 (lower minimum) was rejected.
  - Verify: the current inflation band and bonded target in the mint params (the build item below pulls them).
  - Done when: I can explain why ATOM's staking yield runs at roughly double its inflation rate (reward ≈ inflation ÷ staking ratio, minus community tax), and check it against SR's live [@tool@ATOM page](https://www.stakingrewards.com/asset/cosmos).
- [ ] [build] Pull Cosmos Hub parameters from chain — ~1 h
  - Resource: public REST endpoints listed in the [@opensource@chain registry](https://github.com/cosmos/chain-registry)
  - Do: fetch `/cosmos/mint/v1beta1/params`, `/cosmos/mint/v1beta1/inflation`, `/cosmos/staking/v1beta1/pool`, `/cosmos/distribution/v1beta1/params`, `/cosmos/slashing/v1beta1/params`, then plug them into the SRB formula.
  - Done when: my hand-computed ATOM reward rate lands close to SR's, and I can state the double-sign and downtime slash fractions.
  - If stuck: start from SR's Cosmos Hub SRB doc and compute with SR's own inputs first.
- [ ] [read] Extra yield and liquid staking on Cosmos — ~30 min
  - Note: Interchain Security consumer chains such as Neutron and Stride pay part of their fees to Hub validators. SR's ATOMSRB deliberately excludes these rewards.
  - Do: work out why a benchmark might leave them out. Then read up on the Liquid Staking Module (LSM), its governance caps, and stATOM from Stride.
- [ ] [read] [time-sensitive] Governance watch: "Tokenomics idea n°1" — ~20 min
  - Resource: [@official@Cosmos Hub forum draft (Nov 2025)](https://forum.cosmos.network/t/tokenomics-idea-n-1/16354)
  - Note: proposes lock-based staking and a 2–6% inflation band.
  - Verify: whether it or a successor reached an on-chain vote.
  - Done when: I can say what a 2–6% band would do to SR's ATOM reward rate at today's staking ratio.
- [ ] [watch] One Cosmos Hub staking / Interchain Security explainer — ~20 min
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=Cosmos+Hub+Interchain+Security+staking+explained)

### Recall
- Why is ATOM's staking yield roughly inflation divided by the staking ratio?
- What is Interchain Security, and who gets paid?
- How long is Cosmos Hub unbonding, and what does that mean for liquidity?

## Liquid Staking and Restaking
- id: crypto.liquid-staking
- requires: crypto.ethereum-staking
- related: finance.market-structure
- estimate: ~2 h

Why: LSTs and restaking are a large share of SR's asset and provider data, and a main source of depeg risk.

### Rank 1
- [ ] [read] Liquid staking tokens: Lido (stETH vs wstETH), Jito (JitoSOL) — ~1 h
  - Do: for each, understand how the token accrues value, the redemption path, and how a depeg happens.
  - Case study: on Oct 10, 2025, Binance's wBETH and BNSOL fell about 80% from peg on Binance within minutes. Read [@article@Galaxy's timeline](https://www.galaxy.com/insights/research/cryptos-flash-crash-liquidation-binance-adl-auto-deleveraging).
  - Done when: I can explain why an LST can crash on one venue while its redemption value is unchanged.
- [ ] [read] Restaking: EigenLayer, Symbiotic, liquid restaking tokens (LRTs) — ~45 min
  - Do: focus on the extra slashing conditions an AVS adds.
- [ ] [watch] Optional: SR's Staking Insider podcast back catalog (inactive, but the founder interviews hold up)
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=Staking+Insider+Staking+Rewards+podcast)

### Recall
- How does wstETH accrue value differently from stETH?
- Why can an LST crash on one exchange while its redemption value is unchanged?
- What extra risk does restaking add on top of staking?

## Institutional Staking Operations
- id: crypto.institutional-staking
- requires: crypto.liquid-staking
- estimate: ~1 h

Why: Stakin, now part of The Tie, sells institutional staking; this is how that business works.

### Rank 1
- [ ] [read] How institutional staking works (Stakin's business) — ~1 h
  - Do: custodial vs non-custodial, key management, distributed validators (Obol, SSV), SLAs, slashing coverage, reward reporting. Compare [@official@Stakin](https://stakin.com/) with one competitor's institutional page (Figment or Kiln).
  - Done when: I can explain who holds the keys and who bears which risk in custodial vs non-custodial staking, and name two ways a provider reduces slashing risk.

### Recall
- In custodial vs non-custodial staking, who holds the keys and who bears which risk?
- What does a distributed validator protect against?
- What should a staking SLA cover?

## On-chain Data Engineering (staking)
- id: crypto.onchain-data
- requires: swe.web3-frontend, crypto.ethereum-staking, crypto.solana-staking, crypto.cosmos-staking
- estimate: ~3 h

Why: Turns staking knowledge into code I can check against SR's data; plays to my viem skills.

### Rank 1
- [ ] [build] wstETH APR tracker (with Claude Code) — ~1 h
  - Do: read `stEthPerToken()` on the wstETH contract once per day for 30 days (viem + archive RPC), annualize the 7-day change, compare with Lido's published APR and SR's figure.
  - Done when: my 7-day APR is close to Lido's published figure and I can explain any gap.
  - If stuck: sample two exchange-rate points 7 days apart from a block explorer and compute the rate by hand first.
- [ ] [build] Solana validator check — ~45 min
  - Do: pull a validator's commission and epoch credits (`getVoteAccounts`), compare with SR's validator page.
  - If stuck: read the same validator on a Solana explorer first, then reproduce one field via RPC.
- [ ] [output] One-page "Where staking yield comes from" covering ETH, SOL and ATOM with my recomputed numbers — ~1 h

### Recall
- How do you derive an APR from a wstETH exchange-rate series?
- Which Solana RPC call gives validator commission and credits?
- Why might your computed APR differ from SR's or Lido's?

## DeFi Mechanics
- id: crypto.defi-mechanics
- requires: crypto.consensus
- estimate: ~2 h (+1 h optional)

Why: The base mechanics under every on-chain yield product SR rates.

### Rank 1
- [ ] [watch] Finematics DeFi mechanics series, in this order — ~2 h
  - Resource: [@search@How Uniswap works](https://www.youtube.com/results?search_query=Finematics+How+Does+Uniswap+Work), [@search@Uniswap v3 architecture](https://www.youtube.com/results?search_query=Finematics+Uniswap+v3+explained), [@search@Impermanent loss](https://www.youtube.com/results?search_query=Finematics+impermanent+loss), [@search@Aave lending](https://www.youtube.com/results?search_query=Finematics+Aave+lending+explained), [@search@Flash loans](https://www.youtube.com/results?search_query=Finematics+flash+loans+explained)
  - Done when: I can explain what triggers a liquidation on Aave and why the oracle choice matters.
- [ ] [read] Optional depth: readings for Roughgarden's lectures 22–24 (oracles, lending, AMMs) — ~1 h
  - Resource: [@course@course page](https://timroughgarden.github.io/fob21/)

### Recall
- How does a constant-product AMM set its price?
- What triggers a liquidation on Aave?
- What is impermanent loss, and when does it become permanent?

## On-chain Yield Products
- id: crypto.onchain-yield
- requires: crypto.defi-mechanics, crypto.staking-metrics
- related: finance.market-structure
- estimate: ~3 h

Why: SR rates on-chain yield; I need to know where each yield actually comes from.

### Rank 1
- [ ] [read] Morpho vaults: how a curator picks markets, sets caps and earns fees — ~30 min
- [ ] [read] Pendle: the principal/yield token split, and implied yield as a market price — ~30 min
- [ ] [read] Ethena USDe: yield = perp funding + staked-ETH yield — ~30 min
  - Do: work out what happens when funding turns negative.
- [ ] [read] Stablecoins and tokenized treasuries — ~45 min
  - Do: what backs USDC and USDT, and how tokenized T-bill funds pay yield. Then read SR's [@article@Real Yield in a Debasement Era](https://www.stakingrewards.com/journal/research/real-yield-in-a-debasement-era).
- [ ] [do] Five high-yield pools — ~45 min
  - Resource: [@tool@DefiLlama Yields](https://defillama.com/yields)
  - Do: pick five pools paying over 10% and write one line on where each yield actually comes from.
  - Done when: each of the five has a named yield source and a named main risk.

### Recall
- Where does Ethena's yield come from, and when does it turn negative?
- What does a Morpho curator control?
- What do Pendle's principal and yield tokens represent?

## DeFi Risk
- id: crypto.defi-risk
- requires: crypto.onchain-yield, crypto.liquid-staking
- estimate: ~3.5 h

Why: SR's DeFi risk ratings depend on spotting how yield products fail.

### Rank 1
- [ ] [read] Stream Finance, November 2025 — ~1 h
  - Resource: [@article@Decrypt](https://decrypt.co/347285/stream-finance-stablecoin-plunges-77-protocol-fund-manager-loses-93-million)
  - Note: an external fund manager lost about $93M, xUSD fell 77% in a day, and roughly $285M of debt across Euler, Silo, Morpho and Gearbox was exposed. Elixir's deUSD had lent Stream 68M USDC, about 65% of its backing.
  - Done when: I can draw the chain from user deposit → curator vault → Stream, and name the risk each curator underpriced.
- [ ] [do] rekt.news leaderboard triage — ~45 min
  - Resource: [@tool@rekt.news leaderboard](https://rekt.news/leaderboard/)
  - Do: sort the top 10 losses into smart-contract bug, key compromise, oracle manipulation or operational failure.
- [ ] [build] Dune: fork a lending dashboard, then write one query myself (e.g. daily Aave liquidations) — ~1 h
  - Resource: [@tool@Dune](https://dune.com)
  - If stuck: fork a single query rather than a dashboard, and change only its date filter first.
- [ ] [do] Audit my own lending positions: liquidation threshold, oracle, curator or market, smart-contract exposure — ~30 min
- [ ] [output] One-page DeFi risk checklist I'd apply before depositing anywhere — ~30 min

### Recall
- What chain of exposures let Stream Finance's loss spread to other protocols?
- What are the main categories of DeFi losses?
- What do you check before depositing into a vault?

## Chains and Infrastructure
- id: crypto.infrastructure
- requires: crypto.consensus
- estimate: ~3 h + monthly habits

Why: The Tie may expand into bridging, oracles and RPC; this is the wider stack.

### Rank 1
- [ ] [do] L2Beat: read the Stages framework, then note the stage and biggest risk of three rollups — ~1 h
  - Resource: [@tool@L2Beat](https://l2beat.com)
- [ ] [read] Bridges and oracles — ~2 h
  - Note: The Tie's CEO named bridging, oracles and RPC as possible future infrastructure services ([@article@The Block](https://www.theblock.co/post/384338/crypto-data-platform-the-tie-acquires-stakin-in-cash-and-equity-deal)).
  - Do: start with the bridge and oracle readings for Roughgarden's lectures 21–22 on the [@course@course page](https://timroughgarden.github.io/fob21/).
  - Done when: I can explain the difference between a validating bridge and a multisig bridge, and why most big bridge hacks hit the latter.
- [ ] [habit] Technical depth, one episode a month: [@podcast@Epicenter](https://epicenter.tv) or [@podcast@a16z crypto](https://a16zcrypto.com)
- [ ] [habit] Annual big-picture reports as they come out: [@article@Messari](https://messari.io) Theses, [@article@Galaxy Research](https://www.galaxy.com), a16z State of Crypto

### Recall
- What's the difference between a validating bridge and a multisig bridge?
- What do L2Beat's stages measure?
- Why does oracle design matter for lending protocols?

---

# Quest: Crypto & Finance for The Tie

- id: quest-crypto-finance-the-tie
- pace: 12 weeks, ~4–5 h/week, then follow-on and maintenance
- goal: go from "engineer who stakes and lends" to someone who understands the protocols, staking economics, DeFi risk, markets and regulation behind The Tie's products.

| Weeks | Stage | Skills (in order) |
| --- | --- | --- |
| 1–3 | Foundations | crypto.consensus → finance.money-settlement → crypto.eth-validators |
| 4–7 | Staking | crypto.staking-metrics → crypto.ethereum-staking → crypto.solana-staking → crypto.cosmos-staking → crypto.liquid-staking → crypto.institutional-staking → finance.market-intelligence (Rank 1) → crypto.onchain-data |
| 8–9 | DeFi | crypto.defi-mechanics → crypto.onchain-yield → crypto.defi-risk |
| 10–12 | Markets | finance.market-structure (Ranks 1–2) → finance.institutions → finance.capital-formation → finance.market-intelligence (Rank 2) |
| 13+ | Follow-on | finance.regulation → crypto.infrastructure |

## Maintenance (weekly, from week 13, ~2 h/week)

Keeps learned skills from going rusty.

- [ ] [habit] Unchained's weekly news episode — ~45 min at 1.5x
- [ ] [habit] One Bankless or Empire episode on a topic I haven't covered yet — ~1 h
- [ ] [habit] Terminal, 10 min twice a week: staking feed (finance.market-intelligence) and regulation feed (finance.regulation)
- [ ] [habit] Skim the [@feed@SR Journal](https://www.stakingrewards.com/journal) and [@feed@The Tie Insights](https://www.thetie.io/insights) — ~15 min
- [ ] [habit] Pick the biggest reward-rate move on SR that week and explain its cause in two sentences (issuance change, fee spike, staking-ratio shift, or data issue)
- [ ] [habit] Write a one-page "how staking works on chain X", compare it with SR's asset page, and note the gaps (also feeds SEO/AEO work)

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
