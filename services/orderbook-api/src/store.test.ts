import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { OrderRecord } from "@seltra/sdk";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import { compareSnapshots, PostgresOrderStore, SqliteOrderStore } from "./store";

const record: OrderRecord = {
  orderHash: `0x${"11".repeat(32)}`,
  chainId: 43_113,
  pair: "sWAVAX-sUSDC",
  side: "sell",
  price: "40.5",
  baseAmount: "1",
  status: "resting",
  softCancelled: false,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  order: {
    maker: `0x${"22".repeat(20)}`,
    receiver: `0x${"22".repeat(20)}`,
    makerAsset: `0x${"33".repeat(20)}`,
    takerAsset: `0x${"44".repeat(20)}`,
    makingAmount: "1000000000000000000",
    takingAmount: "40500000",
    salt: "1",
    epoch: "0",
    expiry: "1800000000",
    allowedSender: `0x${"00".repeat(20)}`,
    flags: 0,
  },
  permit: {
    permitted: { token: `0x${"33".repeat(20)}`, amount: "1000000000000000000" },
    nonce: "1",
    deadline: "1800000000",
  },
  signature: `0x${"55".repeat(65)}`,
};

test("SQLite persists the complete orderbook state and bounds quote history", async () => {
  const dbFile = join(mkdtempSync(join(tmpdir(), "seltra-store-")), "seltra.db");
  const options = { chainId: 43_113, quoteHistoryMax: 2 };
  const first = await SqliteOrderStore.open(dbFile, options);
  await first.upsert(structuredClone(record));
  await first.markEventApplied(`0x${"66".repeat(32)}`, 7);
  await first.setCheckpoint(57_057_712n);
  await first.appendQuote(record.pair, { t: 1, price: 40 });
  await first.appendQuote(record.pair, { t: 2, price: 41 });
  await first.appendQuote(record.pair, { t: 3, price: 42 });
  const before = first.snapshot();
  await first.close();

  const reopened = await SqliteOrderStore.open(dbFile, options);
  const after = reopened.snapshot();
  assert.deepEqual(compareSnapshots(before, after), []);
  assert.equal(after.orders.length, 1);
  assert.equal(after.events.length, 1);
  assert.equal(after.meta.chain_id, "43113");
  assert.equal(after.meta.checkpoint, "57057712");
  assert.deepEqual(after.quotes, [
    { pairId: record.pair, point: { t: 2, price: 41 } },
    { pairId: record.pair, point: { t: 3, price: 42 } },
  ]);
  await reopened.close();
});

test("a database cannot be reused across chain IDs", async () => {
  const dbFile = join(mkdtempSync(join(tmpdir(), "seltra-chain-")), "seltra.db");
  const store = await SqliteOrderStore.open(dbFile, { chainId: 43_113, quoteHistoryMax: 2 });
  await store.close();
  await assert.rejects(
    SqliteOrderStore.open(dbFile, { chainId: 43_114, quoteHistoryMax: 2 }),
    /database belongs to chain 43113/,
  );
});

test("snapshot verification identifies record changes", () => {
  const source = { orders: [structuredClone(record)], events: [], meta: { chain_id: "43113" }, quotes: [] };
  const target = structuredClone(source);
  target.orders[0].status = "filled";
  assert.deepEqual(compareSnapshots(source, target), [`order mismatch: ${record.orderHash}`]);
});

test("PostgreSQL imports and verifies a complete SQLite snapshot", async () => {
  const dbFile = join(mkdtempSync(join(tmpdir(), "seltra-migration-")), "seltra.db");
  const options = { chainId: 43_113, quoteHistoryMax: 2 };
  const source = await SqliteOrderStore.open(dbFile, options);
  await source.upsert(structuredClone(record));
  await source.markEventApplied(`0x${"77".repeat(32)}`, 9);
  await source.setCheckpoint(57_100_000n);
  await source.appendQuote(record.pair, { t: 10, price: 40.25 });

  const memory = newDb();
  memory.public.registerFunction({
    name: "to_regclass",
    args: [DataType.text],
    returns: DataType.text,
    implementation: (name: string) => name,
  });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool() as unknown as pg.Pool;
  const schema = readFileSync(fileURLToPath(new URL("../schema.postgres.sql", import.meta.url)), "utf8");
  await pool.query(schema);
  const target = await PostgresOrderStore.openPool(pool, options);
  await target.importSnapshot(source.snapshot());
  assert.deepEqual(compareSnapshots(source.snapshot(), target.snapshot()), []);
  await assert.rejects(target.importSnapshot(source.snapshot()), /not empty/);

  await target.appendQuote(record.pair, { t: 20, price: 40.5 });
  await target.appendQuote(record.pair, { t: 30, price: 40.75 });
  assert.deepEqual(target.getQuoteHistory(record.pair), [
    { t: 20, price: 40.5 },
    { t: 30, price: 40.75 },
  ]);
  await target.setCheckpoint(57_100_001n);
  assert.equal(target.getCheckpoint(), 57_100_001n);

  await source.close();
  await target.close();
});

test("stats() scopes every metric to a pair and never mixes quote tokens", async () => {
  const dbFile = join(mkdtempSync(join(tmpdir(), "seltra-stats-")), "seltra.db");
  const store = await SqliteOrderStore.open(dbFile, { chainId: 43_113, quoteHistoryMax: 2 });

  const filledSell: OrderRecord = {
    ...structuredClone(record),
    orderHash: `0x${"aa".repeat(32)}`,
    status: "filled",
    fill: {
      path: "dex",
      txHash: `0x${"bb".repeat(32)}`,
      blockNumber: 1,
      timestamp: 1_700_000_100,
      makerImprovement: "500000",
      keeperReward: "100000",
    },
  };
  const filledBuy: OrderRecord = {
    ...structuredClone(record),
    orderHash: `0x${"cc".repeat(32)}`,
    side: "buy",
    status: "filled",
    order: { ...record.order, makingAmount: "40500000", takingAmount: "1000000000000000000" },
    fill: {
      path: "p2p",
      txHash: `0x${"dd".repeat(32)}`,
      blockNumber: 2,
      timestamp: 1_700_000_200,
      makerImprovement: "1000000000000000",
      keeperReward: "0",
    },
  };
  const resting: OrderRecord = { ...structuredClone(record), orderHash: `0x${"ee".repeat(32)}`, status: "resting" };
  // A fill under a pair id the running config no longer resolves (e.g. a
  // retired pair). It must still count toward ordersFilled, but its volume
  // must never be attributed to any quote token.
  const unresolvablePairFill: OrderRecord = {
    ...structuredClone(record),
    orderHash: `0x${"ff".repeat(32)}`,
    pair: "RETIRED-PAIR",
    status: "filled",
    fill: { path: "dex", txHash: `0x${"11".repeat(32)}`, blockNumber: 3, timestamp: 1_700_000_300, makerImprovement: "0", keeperReward: "0" },
  };

  await store.upsert(filledSell);
  await store.upsert(filledBuy);
  await store.upsert(resting);
  await store.upsert(unresolvablePairFill);

  const scoped = store.stats(record.pair);
  assert.equal(scoped.quoteSymbol, "sUSDC");
  assert.equal(scoped.totalVolumeQuote, "81"); // 40.5 (sell taking) + 40.5 (buy making) sUSDC
  assert.equal(scoped.ordersFilled, 2);
  assert.equal(scoped.ordersResting, 1);
  assert.deepEqual(scoped.volumeByQuote, []); // scoped calls carry the answer in totalVolumeQuote, not a breakdown
  assert.equal(scoped.avgImprovementBps !== null, true);
  assert.equal(scoped.p2pMatchRateBps, 5_000); // 1 of 2 fills was P2P

  const unscoped = store.stats();
  assert.equal(unscoped.quoteSymbol, "sUSDC"); // only one configured pair, so still unambiguous
  assert.equal(unscoped.totalVolumeQuote, "81"); // the retired pair's fill contributes nothing
  assert.equal(unscoped.ordersFilled, 3); // but it is still counted as a fill
  assert.deepEqual(unscoped.volumeByQuote, [{ quoteSymbol: "sUSDC", amount: "81" }]);

  const unknownPair = store.stats("does-not-exist");
  assert.equal(unknownPair.ordersFilled, 0);
  assert.equal(unknownPair.ordersResting, 0);
  assert.equal(unknownPair.totalVolumeQuote, null);
  assert.equal(unknownPair.quoteSymbol, null); // pairById can't resolve an id the config doesn't know

  await store.close();
});
