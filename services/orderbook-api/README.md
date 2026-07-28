# orderbook-api (legacy — Fuji demo backend)

> **Deprecated.** This is the legacy orderbook API that shipped inside the
> frontend repository for the Fuji demo stack. **The active mainnet backend
> lives in the `Seltra-Finance/Limit-Order` repository under `services/`** and
> is the one production (and local mainnet development, at
> `http://localhost:8082`) runs against. It already supports the four-pair
> `PAIRS` JSON registry, per-pair stats, and per-venue quote history.
>
> Do not add features here. This copy remains only until Fuji tooling that
> still references it (smoke tests, cancel drills) is migrated, after which it
> will be removed.
