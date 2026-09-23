# Market Intelligence with The Tie Terminal
- id: finance.market-intelligence
- requires: —
- estimate: ~4 h

Why: The Terminal is The Tie's core product; using it like a client makes me better at building for SR and the Terminal.

## Rank 1 — Feeds and alerts
- requires: crypto.staking-metrics
- [ ] [do] Build a custom news feed for staking and governance on ETH, SOL, ATOM — ~20 min {#build-a-custom-news-feed-for}
  - Do: in the source filter, include regulators and court cases alongside crypto-native publications.
- [ ] [do] Set one alert on a staking metric (e.g. active validators) for a chain I follow — ~10 min {#set-one-alert-on-a-staking}
- [ ] [do] Compare the Terminal's staking datasets with SR's asset page for one chain — ~30 min {#compare-the-terminals-staking-datasets}
  - Done when: I know which Terminal staking fields match SR's definitions and which differ. Ask the Terminal team where the source isn't obvious.

## Rank 2 — Research workflow
- requires: finance.market-structure
- [ ] [do] Screener: filter by sector and market cap, shortlist mid-caps with an unlock in the next 30 days, pick one — ~20 min {#screener-filter-by-sector-and-market}
- [ ] [do] Chart it with news and unlock overlays, and follow it for one week — ~45 min total {#chart-it-with-news-and-unlock}
- [ ] [build] Dashboard: start from a curated one with the CME vs crypto-native basis and perp funding chart, add a news widget for the token, and build one custom widget (SQL, Python or AI Widget Studio) — ~1 h {#dashboard-start-from-a-curated-one}
  - Done when: I can read the basis chart and say whether the market was paying up for leverage that week.
  - If stuck: clone a curated dashboard as-is and change one widget; ask the Terminal team for the basis dataset name.
- [ ] [do] AI Narrative Engine: how the "staking ETF" or "restaking" narrative moved over the last quarter — ~15 min {#ai-narrative-engine-how-the-staking}
- [ ] [output] Five bullets on what moved my token, plus one paragraph: "What would a hedge fund want from SR data inside the Terminal?" — ~30 min {#five-bullets-on-what-moved-my}

## Recall
- Which Terminal features would you combine to answer "why did this token move today?" {#q1}
- What does the CME vs crypto-native basis tell you about demand for leverage? {#q2}
- Which Terminal staking fields differ from SR's definitions? {#q3}

## Sources
- [The Tie Terminal product page](https://www.thetie.io/solutions/terminal) — as of 2026-09-23
- [The Tie homepage — business lines](https://www.thetie.io/) — as of 2026-09-23

## Review log
- **Round 5 (2026-09-23)**: attached seed sources that back facts in this skill (The Tie Terminal product page, The Tie homepage — business lines); the import only matched sources by URL.
