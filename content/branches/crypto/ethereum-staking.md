# Ethereum Staking Today
- id: crypto.ethereum-staking
- requires: crypto.eth-validators, crypto.staking-metrics
- estimate: ~3 h
- facts_as_of: 2026-09-23

Why: Current Ethereum changes (Pectra, Glamsterdam, MEV) move SR's ETH figures and Stakin's revenue.

## Rank 1
- [ ] [read] Pectra-era staking changes — ~45 min {#pectra-era-staking-changes}
  - Do: skim the motivation sections of EIP-7251 (consolidations up to 2,048 ETH per validator) and EIP-7002 (execution-layer-triggered exits).
- [ ] [read] [time-sensitive] Figment — Glamsterdam: what it means for institutional stakers — ~30 min {#figment-glamsterdam-what-it-means-for}
  - Resource: [@article@Figment article](https://www.figment.io/insights/glamsterdam-what-ethereums-next-upgrade-means-for-institutional-stakers/)
  - Note: focuses on EIP-7732 (enshrined PBS) and EIP-8061.
  - Verify: as of mid-August 2026 no mainnet date was set (ethereum.org planned Q4 2026). Check whether it has shipped.
  - Done when: I can explain how ePBS changes the role of MEV-boost relays, and what that means for a staking provider's revenue.
- [ ] [watch] Finematics — Decoding MEV: Past, Present, Future — ~20 min {#finematics-decoding-mev-past-present}
  - Resource: [@search@YouTube search](https://www.youtube.com/results?search_query=Finematics+Decoding+MEV+Past+Present+Future)
- [ ] [do] Check live Ethereum staking data — ~1 h {#check-live-ethereum-staking-data}
  - Resource: [@tool@beaconcha.in](https://beaconcha.in), [@tool@rated.network](https://www.rated.network)
  - Do: look at the entry and exit queues on beaconcha.in, then check operator effectiveness on rated.network for three operators SR lists as providers.

## Recall
- What did EIP-7251 change for large stakers? {#q1}
- How does ePBS change the role of MEV-boost relays? {#q2}
- What do the entry and exit queues tell you about staking demand? {#q3}

## Sources
- [Figment: Glamsterdam for institutional stakers](https://www.figment.io/insights/glamsterdam-what-ethereums-next-upgrade-means-for-institutional-stakers/) — as of 2026-09-23
