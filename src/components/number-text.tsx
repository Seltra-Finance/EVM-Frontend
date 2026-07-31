import { formatNumber } from "@/lib/format";

export function NumberText({
  value,
  prefix,
  suffix,
  signed,
  tone,
  precision = 2,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  signed?: boolean;
  tone?: "buy" | "sell" | "warn";
  precision?: number;
}) {
  const sign = signed && value > 0 ? "+" : "";
  return (
    <span className={`number ${tone ?? ""}`}>
      {sign}
      {prefix}
      {formatNumber(value, precision)}
      {suffix}
    </span>
  );
}

