"use client";

import { TokenIcon } from "@/components/token-icon";

/**
 * Pill-style switch for the native-AVAX funding convenience. A styled control
 * (not the browser's default checkbox) so it reads as a deliberate funding
 * mode, while staying a real checkbox underneath for keyboard and screen
 * reader users.
 */
export function AvaxSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`avax-switch ${disabled ? "disabled" : ""}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="avax-switch-track" aria-hidden>
        <span className="avax-switch-thumb" />
      </span>
      <span className="avax-switch-text">
        <TokenIcon symbol="AVAX" size={15} /> Use native AVAX
      </span>
    </label>
  );
}
