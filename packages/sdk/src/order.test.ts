import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAmounts, buildMakerAmounts, normalizeDecimalInput } from "./order";

test("buy amount is the quote-token spend budget shown by the order form", () => {
  const result = buildMakerAmounts("buy", "10", "6.41", 18, 6);

  assert.equal(result.makingAmount, 10_000_000n);
  assert.equal(result.takingAmount, 1_560_062_402_496_099_844n);
  // Ceil division keeps the encoded effective price at or below the limit.
  assert.ok(result.makingAmount * 10n ** 18n <= result.takingAmount * 6_410_000n);
});

test("sell amount remains the base-token spend amount", () => {
  const result = buildMakerAmounts("sell", "1.7", "6.41", 18, 6);

  assert.equal(result.makingAmount, 1_700_000_000_000_000_000n);
  assert.equal(result.takingAmount, 10_897_000n);
});

test("decimal comma and decimal point produce identical order amounts", () => {
  assert.deepEqual(
    buildMakerAmounts("buy", "10,5", "6,41", 18, 6),
    buildMakerAmounts("buy", "10.5", "6.41", 18, 6),
  );
  assert.equal(buildMakerAmounts("buy", "10,5", "6,41", 18, 6).makingAmount, 10_500_000n);
  assert.equal(normalizeDecimalInput(" 10,5 "), "10.5");
});

test("order amount encoding imposes no arbitrary nominal minimum or maximum", () => {
  const minimalUnit = buildMakerAmounts("buy", "0.000001", "6.41", 18, 6);
  assert.equal(minimalUnit.makingAmount, 1n);
  assert.ok(minimalUnit.takingAmount > 0n);

  const highNotional = buildMakerAmounts("buy", "1000000000", "6.41", 18, 6);
  assert.equal(highNotional.makingAmount, 1_000_000_000_000_000n);
  assert.ok(highNotional.takingAmount > 0n);
});

test("ambiguous or malformed decimal input produces no signable amount", () => {
  assert.deepEqual(buildMakerAmounts("buy", "1,234.56", "6.41", 18, 6), {
    makingAmount: 0n,
    takingAmount: 0n,
  });
  assert.deepEqual(buildMakerAmounts("buy", "10", "6,4,1", 18, 6), {
    makingAmount: 0n,
    takingAmount: 0n,
  });
});

test("legacy base-denominated buildAmounts behavior remains compatible", () => {
  assert.deepEqual(buildAmounts("buy", "10", "6.41", 18, 6), {
    makingAmount: 64_100_000n,
    takingAmount: 10_000_000_000_000_000_000n,
  });
});
