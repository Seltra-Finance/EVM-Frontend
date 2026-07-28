"use client";

import { useState } from "react";
import { seltraConfig } from "@/config/seltra.config";
import { validateCustomExpiryDays } from "@/lib/order-validation";

// One expiry control shared by Limit and Grid orders: preset buttons plus a
// Custom (days) input, capped at seltraConfig.maxExpirySeconds — the mainnet
// launch policy is 7 days (604800s), derived here rather than duplicated.
// Invalid or over-limit custom values are never silently clamped: they show
// an inline error and the caller is told the value isn't valid so it can
// block signing. Presets are plain styled buttons, not a native <select>, so
// the control matches the rest of the terminal instead of the OS menu.

const ALL_PRESETS = [
  { seconds: 3_600, label: "1h" },
  { seconds: 86_400, label: "1d" },
  { seconds: 604_800, label: "7d" },
  { seconds: 2_592_000, label: "30d" },
] as const;

const SECONDS_PER_DAY = 86_400;

export function presetsWithinMax(
  maxSeconds: number,
  basePresets: readonly { seconds: number; label: string }[] = ALL_PRESETS,
): { seconds: number; label: string }[] {
  return basePresets.filter((preset) => preset.seconds <= maxSeconds);
}

/** Compact human label for any expiry, including custom values: "1h", "2d", "2.5d". */
export function expiryLabelFor(seconds: number): string {
  if (seconds < SECONDS_PER_DAY) {
    const hours = seconds / 3_600;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  }
  const days = seconds / SECONDS_PER_DAY;
  return `${Number.isInteger(days) ? days : days.toFixed(1)}d`;
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
  const [customMode, setCustomMode] = useState(!matchesPreset);
  const [customDays, setCustomDays] = useState(() => (matchesPreset ? "" : String(seconds / SECONDS_PER_DAY)));
  const [customError, setCustomError] = useState<string | null>(null);

  function pickPreset(presetSeconds: number) {
    setCustomMode(false);
    setCustomError(null);
    onValidChange?.(true);
    onChange(presetSeconds);
  }

  function openCustom() {
    setCustomMode(true);
    onValidChange?.(customError === null && customDays.trim() !== "");
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

  return (
    <div className="expiry-control">
      <div className="quick-price expiry-presets" role="group" aria-label="Expiry">
        {presets.map((preset) => (
          <button
            key={preset.seconds}
            type="button"
            className={!customMode && seconds === preset.seconds ? "active" : ""}
            aria-pressed={!customMode && seconds === preset.seconds}
            onClick={() => pickPreset(preset.seconds)}
          >
            {preset.label}
          </button>
        ))}
        <button type="button" className={customMode ? "active" : ""} aria-pressed={customMode} onClick={openCustom}>
          Custom
        </button>
      </div>
      {customMode ? (
        <div className="expiry-custom">
          <div className="input-row">
            <input
              id={`${idPrefix}-custom-days`}
              value={customDays}
              onChange={(event) => updateCustomDays(event.target.value)}
              inputMode="decimal"
              aria-label="Custom expiry in days"
              aria-invalid={customError !== null}
              placeholder={`Max ${(maxSeconds / SECONDS_PER_DAY).toFixed(2).replace(/\.?0+$/, "")}`}
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
