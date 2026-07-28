"use client";

import { useState } from "react";
import { seltraConfig } from "@/config/seltra.config";
import { validateCustomExpiryDays } from "@/lib/order-validation";

// One expiry control shared by Limit and Grid orders. Presets plus a Custom
// (days) input, capped at seltraConfig.maxExpirySeconds — the mainnet launch
// policy is 7 days (604800s), derived here rather than duplicated. Invalid or
// over-limit custom values are never silently clamped: they show an inline
// error and the caller is told the value isn't valid so it can block signing.

const ALL_PRESETS = [
  { seconds: 3_600, label: "1h" },
  { seconds: 86_400, label: "1d" },
  { seconds: 604_800, label: "7d" },
  { seconds: 2_592_000, label: "30d" },
] as const;

const SECONDS_PER_DAY = 86_400;
const CUSTOM = "custom";

export function presetsWithinMax(
  maxSeconds: number,
  basePresets: readonly { seconds: number; label: string }[] = ALL_PRESETS,
): { seconds: number; label: string }[] {
  return basePresets.filter((preset) => preset.seconds <= maxSeconds);
}

export function ExpiryControl({
  seconds,
  onChange,
  onValidChange,
  maxSeconds = seltraConfig.maxExpirySeconds,
  basePresets,
  idPrefix = "expiry",
}: {
  seconds: number;
  onChange: (seconds: number) => void;
  /** Fires whenever custom-input validity changes; callers should block review/signing while false. */
  onValidChange?: (valid: boolean) => void;
  maxSeconds?: number;
  /** Override the preset ladder (e.g. Grid drops the 1h preset). Defaults to 1h/1d/7d/30d. */
  basePresets?: readonly { seconds: number; label: string }[];
  idPrefix?: string;
}) {
  const presets = presetsWithinMax(maxSeconds, basePresets);
  const matchesPreset = presets.some((preset) => preset.seconds === seconds);
  const [mode, setMode] = useState<"preset" | typeof CUSTOM>(matchesPreset ? "preset" : CUSTOM);
  const [customDays, setCustomDays] = useState(() => (matchesPreset ? "" : String(seconds / SECONDS_PER_DAY)));
  const [customError, setCustomError] = useState<string | null>(null);

  function selectPreset(value: string) {
    if (value === CUSTOM) {
      setMode(CUSTOM);
      onValidChange?.(customError === null && customDays.trim() !== "");
      return;
    }
    setMode("preset");
    setCustomError(null);
    onValidChange?.(true);
    onChange(Number(value));
  }

  function updateCustomDays(raw: string) {
    setCustomDays(raw);
    const result = validateCustomExpiryDays(raw, maxSeconds);
    if (!result.ok) {
      setCustomError(result.error);
      onValidChange?.(false);
      return;
    }
    setCustomError(null);
    onValidChange?.(true);
    onChange(result.value);
  }

  const expiryDate = new Date(Date.now() + seconds * 1000);
  const showCustomInput = mode === CUSTOM;

  return (
    <div className="expiry-control">
      <select
        id={`${idPrefix}-select`}
        className="dropdown-trigger expiry-select"
        aria-label="Expiry"
        value={mode === CUSTOM ? CUSTOM : String(seconds)}
        onChange={(event) => selectPreset(event.target.value)}
      >
        {presets.map((preset) => (
          <option key={preset.seconds} value={preset.seconds}>{preset.label}</option>
        ))}
        <option value={CUSTOM}>Custom</option>
      </select>
      {showCustomInput ? (
        <div className="expiry-custom">
          <div className="input-row">
            <input
              id={`${idPrefix}-custom-days`}
              value={customDays}
              onChange={(event) => updateCustomDays(event.target.value)}
              inputMode="decimal"
              aria-label="Custom expiry in days"
              aria-invalid={customError !== null}
              placeholder={`Up to ${(maxSeconds / SECONDS_PER_DAY).toFixed(2).replace(/\.?0+$/, "")} days`}
            />
            <span>days</span>
          </div>
          {customError ? (
            <p className="form-error field-error" role="alert">{customError}</p>
          ) : (
            <p className="field-hint">Expires {expiryDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
          )}
        </div>
      ) : (
        <p className="field-hint">Expires {expiryDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
      )}
    </div>
  );
}
