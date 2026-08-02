import assert from "node:assert/strict";
import { test } from "node:test";
import { isUsdStable, isWavaxLike, usdRateForQuote, usdVolume } from "./usd";

test("stable and WAVAX-like symbol detection", () => {
  for (const s of ["USDC", "USDt", "USDT", "sUSDC", "DAI"]) assert.equal(isUsdStable(s), true);
  assert.equal(isUsdStable("WAVAX"), false);
  assert.equal(isWavaxLike("WAVAX"), true);
  assert.equal(isWavaxLike("sWAVAX"), true);
  assert.equal(isWavaxLike("WETH.e"), false);
});

test("per-unit USD rate: stables 1:1, WAVAX via avaxUsd, others unknown", () => {
  assert.equal(usdRateForQuote("USDC", undefined), 1);
  assert.equal(usdRateForQuote("USDt", 40), 1);
  assert.equal(usdRateForQuote("WAVAX", 40), 40);
  assert.equal(usdRateForQuote("WAVAX", undefined), undefined); // no AVAX price -> can't price
  assert.equal(usdRateForQuote("WAVAX", 0), undefined); // guard against a zero/absent quote
  assert.equal(usdRateForQuote("WETH.e", 40), undefined);
});

test("usdVolume sums a fully-priceable set into one figure", () => {
  const result = usdVolume(
    [
      { quoteSymbol: "USDC", amount: "1000" }, // $1000
      { quoteSymbol: "USDt", amount: "500" }, // $500
      { quoteSymbol: "WAVAX", amount: "10" }, // 10 * $40 = $400
    ],
    40,
  );
  assert.equal(result.usd, 1900);
  assert.deepEqual(result.unpriced, []);
  assert.equal(result.complete, true);
});

test("usdVolume prices what it can and leaves the rest native", () => {
  const result = usdVolume(
    [
      { quoteSymbol: "USDC", amount: "1000" },
      { quoteSymbol: "WETH.e", amount: "2" }, // no rate -> unpriced
    ],
    40,
  );
  assert.equal(result.usd, 1000);
  assert.deepEqual(result.unpriced, [{ quoteSymbol: "WETH.e", amount: "2" }]);
  assert.equal(result.complete, false);
});

test("usdVolume returns null usd when nothing can be priced", () => {
  const result = usdVolume([{ quoteSymbol: "WAVAX", amount: "10" }], undefined);
  assert.equal(result.usd, null);
  assert.equal(result.unpriced.length, 1);
  assert.equal(result.complete, false);
});

test("a zero-volume stable pair still prices to $0, not null", () => {
  const result = usdVolume([{ quoteSymbol: "USDC", amount: "0.0" }], undefined);
  assert.equal(result.usd, 0);
  assert.equal(result.complete, true);
});
