"use client";

import { useAvaxUsdPrice, useStats } from "@/lib/market-data";
import { usdVolume, type QuoteVolume } from "@/lib/usd";

/**
 * Landing-page stats band. Hidden entirely when the API is unreachable or the
 * protocol has no activity yet — never zeros, never placeholders (design spec §4.4).
 */
export function LiveStrip() {
  const { data: stats } = useStats();
  const avaxUsd = useAvaxUsdPrice();

  if (!stats) return null;

  // Volume is reported per quote token; collapse to one USD figure the same way
  // the Stats page does — dollar stables 1:1, WAVAX-quoted volume via the live
  // WAVAX/USD quote. The all-markets totalVolumeQuote is null whenever the pairs
  // quote in different tokens, which is exactly when the old "$" + Number(null)
  // path printed "$0".
  const quoteVolumes: QuoteVolume[] =
    stats.quoteSymbol && stats.totalVolumeQuote !== null
      ? [{ quoteSymbol: stats.quoteSymbol, amount: stats.totalVolumeQuote }]
      : stats.volumeByQuote;
  const volume = usdVolume(quoteVolumes, avaxUsd);

  const hasActivity =
    stats.ordersFilled > 0 || stats.ordersResting > 0 || (volume.usd ?? 0) > 0 || quoteVolumes.length > 0;
  if (!hasActivity) return null;

  return (
    <section className="landing-stats" aria-label="Protocol statistics">
      {volume.usd !== null ? <Stat label="Total volume" value={formatUsd(volume.usd)} /> : null}
      <Stat label="Orders filled" value={stats.ordersFilled.toLocaleString()} />
      <Stat label="Resting orders" value={stats.ordersResting.toLocaleString()} />
      {stats.avgImprovementBps !== null ? (
        <Stat label="Avg. improvement" value={`+${(stats.avgImprovementBps / 100).toFixed(2)}%`} tone="buy" />
      ) : null}
      {stats.p2pMatchRateBps !== null ? (
        <Stat label="P2P match rate" value={`${(stats.p2pMatchRateBps / 100).toFixed(1)}%`} />
      ) : null}
    </section>
  );
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value >= 1000 ? 0 : 2 })}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "buy" }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={`number ${tone ?? ""}`}>{value}</strong>
    </div>
  );
}
