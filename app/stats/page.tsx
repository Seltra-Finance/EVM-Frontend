"use client";

import { Loader2, WifiOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { defaultPairId, resolveDisplayPairId, seltraConfig } from "@/config/seltra.config";
import { NumberText } from "@/components/number-text";
import { useStats } from "@/lib/market-data";

export default function StatsPage() {
  return (
    // useSearchParams needs a Suspense boundary in the app router.
    <Suspense fallback={null}>
      <StatsPageContent />
    </Suspense>
  );
}

function StatsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPair = searchParams.get("pair");
  // Resolve AVAX-alias display ids (e.g. "AVAX-USDC") to their canonical
  // pair, and silently fall back to "all markets" for anything unknown —
  // never error on a stale or hand-typed URL.
  const selectedPairId = requestedPair ? resolveDisplayPairId(requestedPair) : undefined;
  const { data: stats, isLoading, isError } = useStats(selectedPairId);
  const pair = seltraConfig.pairs.find((candidate) => candidate.id === selectedPairId);

  function setPair(nextPairId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pair", nextPairId);
    router.push(`/stats?${params.toString()}`, { scroll: false });
  }

  function clearPair() {
    router.push("/stats", { scroll: false });
  }

  return (
    <AppShell pairId={selectedPairId ?? defaultPairId} onPairChange={setPair}>
      <main className="page-stack">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Protocol</p>
            <h1>Stats</h1>
          </div>
          <div className="orders-tabs stats-scope" role="tablist" aria-label="Stats scope">
            <button type="button" role="tab" aria-selected={!selectedPairId} className={!selectedPairId ? "active" : ""} onClick={clearPair}>
              All markets
            </button>
            {seltraConfig.pairs.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                role="tab"
                aria-selected={selectedPairId === candidate.id}
                className={selectedPairId === candidate.id ? "active" : ""}
                onClick={() => setPair(candidate.id)}
              >
                {candidate.base}/{candidate.quote}
              </button>
            ))}
          </div>
        </section>
        {isLoading ? (
          <section className="panel orders-empty">
            <Loader2 className="spin" size={22} />
            <div><strong>Loading stats</strong><span>Fetching protocol totals from the Seltra orderbook.</span></div>
          </section>
        ) : null}
        {isError ? (
          <section className="panel orders-empty">
            <WifiOff size={22} />
            <div><strong>Stats unavailable</strong><span>Cannot reach the Seltra orderbook service. Retrying automatically.</span></div>
          </section>
        ) : null}
        {stats ? (
          <section className="panel detail-grid">
            <div>
              <span className="label">Total volume{pair ? ` · ${pair.id}` : ""}</span>
              {stats.quoteSymbol && stats.totalVolumeQuote !== null ? (
                <NumberText value={Number(stats.totalVolumeQuote)} suffix={` ${stats.quoteSymbol}`} />
              ) : stats.volumeByQuote.length > 0 ? (
                <div className="volume-by-quote">
                  {stats.volumeByQuote.map((entry) => (
                    <NumberText key={entry.quoteSymbol} value={Number(entry.amount)} suffix={` ${entry.quoteSymbol}`} />
                  ))}
                </div>
              ) : (
                <strong className="number">—</strong>
              )}
            </div>
            <div>
              <span className="label">Orders filled</span>
              <NumberText value={stats.ordersFilled} precision={0} />
            </div>
            <div>
              <span className="label">Resting orders</span>
              <NumberText value={stats.ordersResting} precision={0} />
            </div>
            <div>
              <span className="label">Average improvement</span>
              {stats.avgImprovementBps !== null ? <NumberText value={stats.avgImprovementBps / 100} suffix="%" signed tone="buy" /> : <strong className="number">—</strong>}
            </div>
            <div>
              <span className="label">P2P match rate</span>
              {stats.p2pMatchRateBps !== null ? <NumberText value={stats.p2pMatchRateBps / 100} suffix="%" /> : <strong className="number">—</strong>}
            </div>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
