# Seltra

Wallet-native limit orders on Avalanche. Orders are signed messages
(Permit2 `PermitWitnessTransferFrom` with an order witness) that live in the
maker's wallet — no deposits, no custody, no gas to place or cancel-by-expiry.
Fills route through the best DEX quote across venues or match trader-to-trader
(P2P), and the maker always receives their limit price or better, with 70% of
any surplus.

**Status: testnet (Avalanche Fuji).** Contracts are unaudited — do not use
with real funds.

## Monorepo layout

| Path | What it is |
|------|------------|
| `app/`, `src/` | Next.js 14 frontend (wagmi v2 + viem, Reown AppKit, lightweight-charts) |
| `packages/sdk` | `@seltra/sdk` — order building/hashing, Permit2 typed-data assembly, wire codecs, order validation, REST + reconnecting WS client |
| `services/orderbook-api` | **Deprecated** legacy Fuji demo backend — the active mainnet orderbook API lives in `Seltra-Finance/Limit-Order` under `services/` (see `services/orderbook-api/README.md`) |
| `deploy/` | Caddyfile, systemd units, production env templates |

## Development

Requires Node 22+ (the API uses `node:sqlite`).

```bash
npm ci
cp .env.local.example .env.local          # frontend config (Fuji defaults)
npm run api                               # orderbook API + indexer on :8080
npm run dev                               # frontend on :3000
```

Useful checks:

```bash
npm run typecheck
npm run lint
npx tsx services/orderbook-api/scripts/smoke.ts        # API + WS protocol suite
npx tsx packages/sdk/scripts/verify-fixtures.ts        # signing byte-compat vs contracts
```

## Security model (short version)

- Makers grant ERC-20 approvals **only to Permit2** (canonical
  `0x…22D473030F116dDEE9F6B43aC78BA3`), never to Seltra contracts.
- Funds move only when a signed order is filled at its limit price or better;
  the signature binds the exact order terms via an EIP-712 witness.
- Cancellation is on-chain and unilateral: per-order nonce invalidation or
  epoch bump (cancel-all). Orders also expire.
- A guardian can pause fills instantly; unpausing goes through a timelock.
  Cancels keep working while paused.

The order-signing scheme is verified byte-identical against the deployed
contracts' pinned test fixtures (see `packages/sdk/scripts/verify-fixtures.ts`).

## License

No license granted yet — all rights reserved.
