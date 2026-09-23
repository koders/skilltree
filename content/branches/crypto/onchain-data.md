# On-chain Data Engineering (staking)
- id: crypto.onchain-data
- requires: swe.web3-frontend, crypto.ethereum-staking, crypto.solana-staking, crypto.cosmos-staking
- estimate: ~3 h

Why: Turns staking knowledge into code I can check against SR's data; plays to my viem skills.

## Rank 1
- [ ] [build] wstETH APR tracker (with Claude Code) — ~1 h {#wsteth-apr-tracker-with-claude-code}
  - Do: read `stEthPerToken()` on the wstETH contract once per day for 30 days (viem + archive RPC), annualize the 7-day change, compare with Lido's published APR and SR's figure.
  - Done when: my 7-day APR is close to Lido's published figure and I can explain any gap.
  - If stuck: sample two exchange-rate points 7 days apart from a block explorer and compute the rate by hand first.
- [ ] [build] Solana validator check — ~45 min {#solana-validator-check}
  - Do: pull a validator's commission and epoch credits (`getVoteAccounts`), compare with SR's validator page.
  - If stuck: read the same validator on a Solana explorer first, then reproduce one field via RPC.
- [ ] [output] One-page "Where staking yield comes from" covering ETH, SOL and ATOM with my recomputed numbers — ~1 h {#one-page-where-staking-yield-comes}

## Recall
- How do you derive an APR from a wstETH exchange-rate series? {#q1}
- Which Solana RPC call gives validator commission and credits? {#q2}
- Why might your computed APR differ from SR's or Lido's? {#q3}
