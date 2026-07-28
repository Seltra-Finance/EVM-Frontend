---
title: "Welcome to Seltra"
description: "Seltra is a hybrid limit-order protocol for Avalanche. Makers sign orders off-chain through Permit2, while permissionless keepers settle them on-chain…"
section: "Docs"
order: 1
---

Seltra is a hybrid limit-order protocol for Avalanche. Makers sign orders off-chain through Permit2, while permissionless keepers settle them on-chain through either aggregated DEX liquidity or a direct peer-to-peer match.

<Callout type="info">

**Current status:** Seltra is deployed on Avalanche C-Chain mainnet (chain ID `43114`) as well as on Avalanche Fuji for testing. An internal security review (Almanax) found zero active findings, but **an independent third-party audit has not completed** — see [Mainnet Status](/docs/networks-and-deployments/mainnet-status) before relying on the protocol with real funds.

</Callout>

### Why Seltra

<CardGrid>
  <Card icon="✍️" title="One maker signature">
    Orders use Permit2 witness signatures. Makers do not submit an on-chain order transaction.
  </Card>
  <Card icon="🔀" title="Two execution paths">
    Settle against approved AMM adapters or match two crossing makers directly.
  </Card>
  <Card icon="🛡️" title="Maker-protective settlement">
    The maker always receives at least the signed minimum. Positive execution surplus is shared transparently.
  </Card>
  <Card icon="🧩" title="Composable contracts">
    Integrate orders, keepers, indexers, and venue adapters through a compact on-chain interface.
  </Card>
</CardGrid>

### How an order moves

```mermaid
sequenceDiagram
    participant Maker
    participant API as Orderbook API
    participant Keeper
    participant Settlement
    participant Permit2
    participant Liquidity as DEX or P2P Maker

    Maker->>Maker: Build order and Permit2 witness
    Maker->>API: Submit signed order
    API-->>Keeper: Resting order
    Keeper->>Settlement: Simulate fill
    Settlement->>Permit2: Verify signature and consume nonce
    Permit2->>Settlement: Transfer maker asset
    Settlement->>Liquidity: Execute DEX route or P2P match
    Settlement->>Maker: Signed minimum + maker improvement
    Settlement->>Keeper: Keeper reward
```

### Start here

* **New to the protocol?** Read [Concepts](/docs/concepts).
* **Building an integration?** Start with [Build with Seltra](/docs/build-with-seltra).
* **Reviewing Solidity?** Open the [Contract Reference](/docs/contract-reference).
* **Connecting to mainnet or Fuji?** Use [Networks & Deployments](/docs/networks-and-deployments).
* **Trading in the app?** Read the [App Trading Guide](/docs/concepts/app-trading-guide).
* **Evaluating risk?** Read [Security](/docs/security).

The public source repository is available at [Seltra-Finance/Limit-Order](https://github.com/Seltra-Finance/Limit-Order).
