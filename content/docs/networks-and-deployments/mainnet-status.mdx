---
title: "Mainnet Status"
description: "Seltra is deployed on Avalanche mainnet. An independent audit has not completed."
section: "Networks & Deployments"
order: 27
---

Seltra **is deployed on Avalanche C-Chain mainnet** (chain ID `43114`). Source is verified on Sourcify (`exact_match`) for the Router, Settlement, and all three DEX adapters.

<Callout type="warning">

Deployment and source verification are not a substitute for an independent audit. **The independent third-party audit has not completed** — treat mainnet as live but not yet fully reviewed, and size any exposure accordingly.

</Callout>

### What has happened

* Router, Settlement, and the LFJ / Blackhole / Pharaoh adapters are deployed and source-verified.
* An internal automated security review (Almanax) completed with **zero active findings**.
* Governance is live: a 48-hour `TimelockController` owns Settlement, the Router, and the adapters. Pending-owner cleanup is complete — the Timelock is the final owner.
* Four pairs are allowlisted: `WAVAX/USDC`, `WETH.e/WAVAX`, `BTC.b/WAVAX`, `USDC/USDt`.

### DEX adapters

| ID | Venue              | Status                                                    |
| -: | ------------------ | ---------------------------------------------------------- |
|  1 | LFJ Liquidity Book | Live. Not routed for `BTC.b/WAVAX` — see the note below.   |
|  2 | Blackhole          | Live, including `BTC.b/WAVAX`.                              |
|  3 | Pharaoh Exchange   | Live, including `BTC.b/WAVAX`.                              |

<Callout type="info">

`BTC.b/WAVAX` intentionally has no LFJ liquidity route at launch. The orderbook API's quote service polls every configured venue per pair and simply omits a venue when its on-chain quote reverts (no pool, no liquidity) — the frontend's venue legend reflects this automatically and never shows LFJ for `BTC.b/WAVAX`.

</Callout>

### Remaining before "audited"

* **Independent smart-contract audit and remediation** — not complete.
* Distributed Safe signer selection for anything beyond the current governance bootstrap.
* Production RPC, keeper, indexer, monitoring, and incident-response operations at steady state.
* Controlled rollout limits and pause-drill validation under real traffic.

<Callout type="danger">

Do not treat Sourcify verification, the Almanax scan, or fork test coverage as a substitute for an independent audit. This page is the single source of truth for mainnet status — do not infer deployment state from contract code, adapter IDs, or any other page.

</Callout>
