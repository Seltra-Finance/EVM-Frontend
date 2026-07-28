import { GridPlanError, normalizeDecimalInput, parseDecimal } from "@seltra/sdk";

// Pure validation, kept out of the React components so it's unit-testable
// without a rendering harness. Both the Market slippage input and the Limit
// price shortcuts share the "a limit has no slippage" distinction: only
// Market ever calls into the slippage validator.

const SECONDS_PER_DAY = 86_400;
/** 5% or more is unusually high for a marketable-limit bound; the caller warns without blocking. */
export const HIGH_SLIPPAGE_BPS = 500;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Percent string ("0.35") -> integer bps (35), exact — no float multiplication.
 * Rejects empty, non-numeric, zero, negative, >100-decimal-place, and >=100% input.
 */
export function validateCustomSlippagePercent(raw: string): ValidationResult<number> {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "Enter a slippage percentage" };
  let bps: number;
  try {
    bps = Number(parseDecimal(trimmed, 2, "Slippage"));
  } catch (cause) {
    return { ok: false, error: cause instanceof GridPlanError ? cause.userMessage : "Enter a valid percentage" };
  }
  if (bps <= 0) return { ok: false, error: "Slippage must be above 0%" };
  if (bps >= 10_000) return { ok: false, error: "Slippage must be below 100%" };
  return { ok: true, value: bps };
}

function maxDaysLabel(maxSeconds: number): string {
  const days = maxSeconds / SECONDS_PER_DAY;
  return Number.isInteger(days) ? `${days} day${days === 1 ? "" : "s"}` : `${days.toFixed(2)} days`;
}

/**
 * Days string ("1.5") -> integer seconds, rounded (order expiries are whole
 * seconds on-chain). Rejects empty, non-numeric, zero, negative, and
 * over-the-configured-maximum input — never silently clamped.
 */
export function validateCustomExpiryDays(raw: string, maxSeconds: number): ValidationResult<number> {
  const trimmed = normalizeDecimalInput(raw);
  if (trimmed === "") return { ok: false, error: "Enter a number of days" };
  if (!/^\d+(?:\.\d*)?$/.test(trimmed)) return { ok: false, error: "Enter a valid number of days" };
  const days = Number(trimmed);
  if (!Number.isFinite(days) || days <= 0) return { ok: false, error: "Expiry must be in the future" };
  const seconds = Math.round(days * SECONDS_PER_DAY);
  if (seconds > maxSeconds) return { ok: false, error: `${maxDaysLabel(maxSeconds)} maximum.` };
  return { ok: true, value: seconds };
}
