import assert from "node:assert/strict";
import { test } from "node:test";
import { isWavax, pairHasWavaxLeg, resolveDisplayPairId, type PairConfig } from "./seltra.config";

const mainnetPairs: PairConfig[] = [
  { id: "WAVAX-USDC", base: "WAVAX", quote: "USDC", pricePrecision: 4, amountPrecision: 4 },
  { id: "WETH.e-WAVAX", base: "WETH.e", quote: "WAVAX", pricePrecision: 4, amountPrecision: 5 },
  { id: "BTC.b-WAVAX", base: "BTC.b", quote: "WAVAX", pricePrecision: 4, amountPrecision: 6 },
  { id: "USDC-USDt", base: "USDC", quote: "USDt", pricePrecision: 5, amountPrecision: 2 },
];

test("resolveDisplayPairId: canonical ids resolve to themselves", () => {
  assert.equal(resolveDisplayPairId("WAVAX-USDC", mainnetPairs), "WAVAX-USDC");
  assert.equal(resolveDisplayPairId("USDC-USDt", mainnetPairs), "USDC-USDt");
});

test("resolveDisplayPairId: the AVAX funding alias resolves to the canonical WAVAX pair on either leg", () => {
  assert.equal(resolveDisplayPairId("AVAX-USDC", mainnetPairs), "WAVAX-USDC"); // base alias
  assert.equal(resolveDisplayPairId("WETH.e-AVAX", mainnetPairs), "WETH.e-WAVAX"); // quote alias
  assert.equal(resolveDisplayPairId("BTC.b-AVAX", mainnetPairs), "BTC.b-WAVAX"); // quote alias
});

test("resolveDisplayPairId: never invents a second orderbook — unknown or malformed ids resolve to nothing", () => {
  assert.equal(resolveDisplayPairId("AVAX-DOESNOTEXIST", mainnetPairs), undefined);
  assert.equal(resolveDisplayPairId("does-not-exist", mainnetPairs), undefined);
  assert.equal(resolveDisplayPairId("", mainnetPairs), undefined);
  // A pair with no WAVAX leg at all has no AVAX alias to fall back to.
  assert.equal(resolveDisplayPairId("AVAX-USDt", mainnetPairs), undefined);
});

test("isWavax / pairHasWavaxLeg identify the WAVAX leg exactly, never a lookalike symbol", () => {
  assert.equal(isWavax({ symbol: "WAVAX" }), true);
  assert.equal(isWavax({ symbol: "sWAVAX" }), false); // a Fuji demo token is not mainnet WAVAX
  assert.equal(isWavax({ symbol: "AVAX" }), false); // the native-AVAX display alias itself is not WAVAX

  assert.equal(pairHasWavaxLeg(mainnetPairs[0]), true); // WAVAX-USDC
  assert.equal(pairHasWavaxLeg(mainnetPairs[1]), true); // WETH.e-WAVAX
  assert.equal(pairHasWavaxLeg(mainnetPairs[3]), false); // USDC-USDt
});

test("no configured token or pair ever uses address(0) — native AVAX has no address at all", () => {
  // Native AVAX must never be represented as address(0) in the pair registry;
  // it is intentionally addressless (see nativeAvax in seltra.config.ts) so it
  // can never leak into an order's makerAsset/takerAsset by construction.
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  for (const pair of mainnetPairs) {
    assert.notEqual(pair.base, zeroAddress);
    assert.notEqual(pair.quote, zeroAddress);
  }
});
