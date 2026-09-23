# Consensus and Proof of Stake
- id: crypto.consensus
- requires: —
- estimate: ~5 h

Why: Everything in staking rests on consensus; the foundation for every chain SR covers.

## Rank 1
- [ ] [watch] Roughgarden — Foundations of Blockchains, selected topics — ~5 h {#roughgarden-foundations-of-blockchains}
  - Resource: [@video@videos](https://timroughgarden.org/videos.html), [@course@course page with readings](https://timroughgarden.github.io/fob21/)
  - Do: watch only these topics: the SMR problem (intro), Tendermint and partial synchrony, longest-chain consensus, proof-of-work sybil resistance, proof-of-stake sybil resistance, transaction fees and EIP-1559, economic security.
  - Skip: the Dolev-Strong and FLP proofs on the first pass; read the [@article@Lectures 2–7 overview PDF](https://timroughgarden.github.io/fob21/l/l2-7-overview.pdf) instead.
  - Done when: I can explain why "33%" keeps appearing in PoS whitepapers, and why PoS chains finalize while Bitcoin's finality is only probabilistic.

## Recall
- Why can BFT consensus tolerate fewer than one third faulty validators, but not more? {#q1}
- What's the difference between probabilistic and deterministic finality? {#q2}
- How does proof of stake provide sybil resistance? {#q3}

## Sources
- [Roughgarden: Foundations of Blockchains course page](https://timroughgarden.github.io/fob21/) — as of 2026-09-23
