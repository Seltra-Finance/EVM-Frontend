import assert from "node:assert/strict";
import { test } from "node:test";
import { HIGH_SLIPPAGE_BPS, validateCustomExpiryDays, validateCustomSlippagePercent } from "./order-validation";

test("custom slippage: valid percentages convert to exact bps", () => {
  assert.deepEqual(validateCustomSlippagePercent("0.35"), { ok: true, value: 35 });
  assert.deepEqual(validateCustomSlippagePercent("1"), { ok: true, value: 100 });
  assert.deepEqual(validateCustomSlippagePercent("0.01"), { ok: true, value: 1 });
  assert.deepEqual(validateCustomSlippagePercent("0,35"), { ok: true, value: 35 });
  assert.deepEqual(validateCustomSlippagePercent("99.99"), { ok: true, value: 9_999 });
});

test("custom slippage: rejects empty, non-numeric, zero, negative, >=100%, and over-precise input", () => {
  assert.equal(validateCustomSlippagePercent("").ok, false);
  assert.equal(validateCustomSlippagePercent("   ").ok, false);
  assert.equal(validateCustomSlippagePercent("abc").ok, false);
  assert.equal(validateCustomSlippagePercent("0").ok, false);
  assert.equal(validateCustomSlippagePercent("-1").ok, false);
  assert.equal(validateCustomSlippagePercent("100").ok, false);
  assert.equal(validateCustomSlippagePercent("150").ok, false);
  assert.equal(validateCustomSlippagePercent("0.125").ok, false); // 3 decimal places: not a whole bps
  assert.equal(validateCustomSlippagePercent("1e5").ok, false);
});

test("custom slippage: an unusually high but valid value is reported exactly, never clamped down to a 'safe' default", () => {
  const result = validateCustomSlippagePercent("45.5");
  assert.deepEqual(result, { ok: true, value: 4_550 }); // far above HIGH_SLIPPAGE_BPS, but still < 100% — accepted as-is
});

test("HIGH_SLIPPAGE_BPS marks 5% and above as unusually high", () => {
  assert.equal(HIGH_SLIPPAGE_BPS, 500);
  const belowResult = validateCustomSlippagePercent("4.99");
  const atResult = validateCustomSlippagePercent("5");
  assert.ok(belowResult.ok && belowResult.value < HIGH_SLIPPAGE_BPS);
  assert.ok(atResult.ok && atResult.value >= HIGH_SLIPPAGE_BPS);
});

test("custom expiry: valid day counts round to whole seconds", () => {
  assert.deepEqual(validateCustomExpiryDays("1", 604_800), { ok: true, value: 86_400 });
  assert.deepEqual(validateCustomExpiryDays("0.5", 604_800), { ok: true, value: 43_200 });
  assert.deepEqual(validateCustomExpiryDays("7", 604_800), { ok: true, value: 604_800 });
  assert.deepEqual(validateCustomExpiryDays("0,5", 604_800), { ok: true, value: 43_200 });
});

test("custom expiry: seven-day mainnet maximum is enforced, not silently clamped", () => {
  const overLimit = validateCustomExpiryDays("8", 604_800);
  assert.equal(overLimit.ok, false);
  if (!overLimit.ok) assert.match(overLimit.error, /7 days maximum\.$/);

  const atLimit = validateCustomExpiryDays("7", 604_800);
  assert.deepEqual(atLimit, { ok: true, value: 604_800 });

  // A different configured maximum produces a matching message, not a hardcoded "7".
  const thirtyDayMax = validateCustomExpiryDays("31", 2_592_000);
  assert.equal(thirtyDayMax.ok, false);
  if (!thirtyDayMax.ok) assert.match(thirtyDayMax.error, /30 days maximum\.$/);
});

test("custom expiry: rejects empty, non-numeric, zero, and negative input", () => {
  assert.equal(validateCustomExpiryDays("", 604_800).ok, false);
  assert.equal(validateCustomExpiryDays("abc", 604_800).ok, false);
  assert.equal(validateCustomExpiryDays("0", 604_800).ok, false);
  assert.equal(validateCustomExpiryDays("-3", 604_800).ok, false);
});
