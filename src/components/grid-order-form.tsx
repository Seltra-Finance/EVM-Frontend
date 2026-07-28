"use client";

import { AlertTriangle, CheckCircle2, Grid3x3, Loader2, OctagonX, PenLine, ShieldCheck, Wallet } from "lucide-react";
import type { GridLevel, GridPlan } from "@seltra/sdk";
import { formatToken } from "@/lib/format";
import { AvaxSwitch } from "@/components/avax-switch";
import { ExpiryControl } from "@/components/expiry-control";
import { displaySymbol } from "@/components/token-icon";
import { GRID_BASE_EXPIRY_PRESETS, GRID_EXPIRY_OPTIONS, useGridOrderMachine, type GridOrderMachine } from "@/hooks/use-grid-order-machine";

// Finite pre-signed grid: a ladder of ordinary one-shot limit orders. The UI
// keeps two promises visible at all times — one wallet signature per child,
// and no automatic replenishment.

export function GridOrderForm({ pairId, referencePrice }: { pairId: string; referencePrice?: number }) {
  const g = useGridOrderMachine({ pairId, referencePrice });
  const inFlow = g.state.tag !== "editing" && g.state.tag !== "rejected";
  return (
    <div className="grid-form" aria-busy={g.busy}>
      <div className="order-kind-tabs strategy-tabs" role="tablist" aria-label="Bot strategy">
        <button className="active" type="button" role="tab" aria-selected>Grid</button>
        <button type="button" role="tab" aria-selected={false} disabled title="Coming soon">DCA</button>
        <button type="button" role="tab" aria-selected={false} disabled title="Coming soon">Martingale</button>
      </div>
      {inFlow && g.plan ? <GridFlow g={g} plan={g.plan} /> : <GridConfigForm g={g} />}
    </div>
  );
}

function GridConfigForm({ g }: { g: GridOrderMachine }) {
  const levelsCount = Number(g.levels);
  return (
    <>
      <div className="grid-reference">
        <span>Reference price</span>
        <strong className="number">{g.referencePrice ? `${g.referencePrice} ${displaySymbol(g.quote.symbol)}` : "No live price"}</strong>
      </div>
      <div className="grid-field-row">
        <label className="field">
          <span className="field-label">Lower price</span>
          <div className="input-row"><input value={g.lowerPrice} onChange={(event) => g.setLowerPrice(event.target.value)} inputMode="decimal" placeholder="0.00" /><span>{displaySymbol(g.quote.symbol)}</span></div>
          <small className="field-hint">Below reference</small>
        </label>
        <label className="field">
          <span className="field-label">Upper price</span>
          <div className="input-row"><input value={g.upperPrice} onChange={(event) => g.setUpperPrice(event.target.value)} inputMode="decimal" placeholder="0.00" /><span>{displaySymbol(g.quote.symbol)}</span></div>
          <small className="field-hint">Above reference</small>
        </label>
      </div>
      <div className="grid-field-row">
        <label className="field">
          <span className="field-label">Levels <small>4–20</small></span>
          <div className="input-row"><input value={g.levels} onChange={(event) => g.setLevels(event.target.value)} inputMode="numeric" /></div>
        </label>
        <div className="field">
          <span className="field-label">Expiry</span>
          <ExpiryControl
            seconds={g.expirySeconds}
            onChange={g.setExpirySeconds}
            onValidChange={g.setExpiryValid}
            basePresets={GRID_BASE_EXPIRY_PRESETS}
            idPrefix="grid-expiry"
          />
        </div>
      </div>
      <label className="field">
        <span className="field-label">Base budget <small>{displaySymbol(g.base.symbol)}, split across sell levels</small></span>
        <div className="input-row">
          <input value={g.baseBudget} onChange={(event) => g.setBaseBudget(event.target.value)} inputMode="decimal" />
          <button type="button" onClick={g.setMaxBaseBudget} disabled={g.baseBalance === undefined}>MAX</button>
        </div>
        <small className="balance-line">Available <strong className="number">{g.baseBalance === undefined ? "-" : formatToken(g.baseBalance, g.base.decimals, 4)} {displaySymbol(g.base.symbol)}</strong></small>
      </label>
      {g.wavaxLeg === "base" ? <NativeAvaxToggle g={g} /> : null}
      <label className="field">
        <span className="field-label">Quote budget <small>{displaySymbol(g.quote.symbol)}, split across buy levels</small></span>
        <div className="input-row">
          <input value={g.quoteBudget} onChange={(event) => g.setQuoteBudget(event.target.value)} inputMode="decimal" />
          <button type="button" onClick={g.setMaxQuoteBudget} disabled={g.quoteBalance === undefined}>MAX</button>
        </div>
        <small className="balance-line">Available <strong className="number">{g.quoteBalance === undefined ? "-" : formatToken(g.quoteBalance, g.quote.decimals, 4)} {displaySymbol(g.quote.symbol)}</strong></small>
      </label>
      {g.wavaxLeg === "quote" ? <NativeAvaxToggle g={g} /> : null}
      <p className="grid-note"><Grid3x3 size={14} /> Finite grid: orders do not automatically replenish. Each of the {Number.isInteger(levelsCount) && levelsCount > 0 ? levelsCount : "N"} levels is an independent all-or-nothing limit order requiring its own wallet signature.</p>
      {g.formError ? <p className="form-error"><AlertTriangle size={14} /> {g.formError}</p> : null}
      {g.state.tag === "rejected" ? <p className="form-error"><AlertTriangle size={14} /> {g.state.reason}</p> : null}
      <div className="order-action-footer">
        <button
          className="button accent full"
          type="button"
          onClick={g.review}
          disabled={g.busy || (g.isConnected && !g.expiryValid)}
          title={g.isConnected && !g.expiryValid ? "Fix the expiry field before previewing" : undefined}
        >
          {!g.isConnected ? <Wallet size={16} /> : <Grid3x3 size={16} />}
          {!g.isConnected ? "Connect wallet" : g.wrongNetwork ? "Switch to Avalanche" : g.fillsPaused ? "Fills are paused" : "Preview grid"}
        </button>
        <p className="caption">Nothing is signed or sent at preview. You will see the exact ladder and signature count first.</p>
      </div>
    </>
  );
}

function NativeAvaxToggle({ g }: { g: GridOrderMachine }) {
  return (
    <div className="native-avax-toggle">
      <AvaxSwitch checked={g.useNativeAvax} onChange={g.setUseNativeAvax} />
      {g.useNativeAvax ? (
        <p className="caption native-avax-note">
          {g.nativeBalance !== undefined ? `${formatToken(g.nativeBalance, 18, 4)} AVAX available. ` : ""}
          AVAX routes through WAVAX — {g.wavaxDeficit > 0n
            ? `${formatToken(g.wavaxDeficit, 18, 6)} AVAX will be wrapped to WAVAX before the first signature.`
            : "your existing WAVAX balance already covers this budget, so no wrap is needed."}
        </p>
      ) : null}
    </div>
  );
}

function GridFlow({ g, plan }: { g: GridOrderMachine; plan: GridPlan }) {
  const { state } = g;
  const buys = plan.levels.filter((level) => level.side === "buy");
  const sells = plan.levels.filter((level) => level.side === "sell");
  const signaturesRequired = plan.levels.length;
  const expiryLabel = GRID_EXPIRY_OPTIONS.find((option) => option.seconds === plan.config.expirySeconds)?.label ?? `${plan.config.expirySeconds}s`;

  return (
    <>
      <GridLadder plan={plan} baseSymbol={displaySymbol(g.base.symbol)} quoteSymbol={displaySymbol(g.quote.symbol)} baseDecimals={g.base.decimals} quoteDecimals={g.quote.decimals} />
      <div className="summary-box">
        <div><span>Ladder</span><strong className="number">{buys.length} buys · {sells.length} sells{plan.neutralPrice ? " · 1 neutral" : ""}</strong></div>
        <div><span>Quote budget (buys)</span><strong className="number">{formatToken(plan.requiredQuote, g.quote.decimals, 4)} {displaySymbol(g.quote.symbol)}</strong></div>
        <div><span>Base budget (sells)</span><strong className="number">{formatToken(plan.requiredBase, g.base.decimals, 4)} {displaySymbol(g.base.symbol)}</strong></div>
        <div><span>Expiry</span><strong className="number">{expiryLabel}</strong></div>
        <div><span>Wallet signatures</span><strong className="number">{signaturesRequired} — one per order</strong></div>
      </div>
      <p className="grid-note"><Grid3x3 size={14} /> Finite grid: orders do not automatically replenish. Filled levels stay filled.</p>
      {g.wavaxLeg === "base" ? (
        <p className="grid-note">Buy levels receive WAVAX, the wrapped-AVAX ERC-20 — not native AVAX automatically.</p>
      ) : g.wavaxLeg === "quote" ? (
        <p className="grid-note">Sell levels receive WAVAX, the wrapped-AVAX ERC-20 — not native AVAX automatically.</p>
      ) : null}

      {state.tag === "reviewing" ? (
        <div className="order-action-footer">
          <button className="button accent full" type="button" onClick={g.beginApprovals}><PenLine size={16} /> Continue — {signaturesRequired} signatures required</button>
          <button className="button outline full" type="button" onClick={g.backToEdit}>Back to settings</button>
        </div>
      ) : null}

      {state.tag === "needs-wrap" ? (
        <>
          <p className="approval-note"><ShieldCheck size={15} /> {formatToken(g.wavaxDeficit, 18, 6)} AVAX will be wrapped to WAVAX before approvals and signing.</p>
          <div className="order-action-footer">
            <button className="button accent full" type="button" onClick={g.wrap}>Wrap AVAX</button>
            <button className="button outline full" type="button" onClick={g.stop}><OctagonX size={15} /> Stop — nothing submitted</button>
          </div>
        </>
      ) : null}

      {state.tag === "wrapping" ? (
        <div className="order-action-footer">
          <button className="button accent full" type="button" disabled>
            <Loader2 className="spin" size={16} /> Wrapping AVAX…
          </button>
        </div>
      ) : null}

      {state.tag === "needs-base-approval" || state.tag === "needs-quote-approval" ? (
        <>
          <p className="approval-note"><ShieldCheck size={15} /> One-time Permit2 approval for {state.tag === "needs-base-approval" ? displaySymbol(g.base.symbol) : displaySymbol(g.quote.symbol)}. Seltra never receives a standing approval.</p>
          <div className="order-action-footer">
            <button className="button accent full" type="button" onClick={g.approve}>Approve {state.tag === "needs-base-approval" ? displaySymbol(g.base.symbol) : displaySymbol(g.quote.symbol)}</button>
            <button className="button outline full" type="button" onClick={g.stop}><OctagonX size={15} /> Stop — nothing submitted</button>
          </div>
        </>
      ) : null}

      {state.tag === "approving-base" || state.tag === "approving-quote" ? (
        <div className="order-action-footer">
          <button className="button accent full" type="button" disabled>
            <Loader2 className="spin" size={16} /> Approving {state.tag === "approving-base" ? displaySymbol(g.base.symbol) : displaySymbol(g.quote.symbol)}…
          </button>
        </div>
      ) : null}

      {state.tag === "ready-to-sign" ? (
        <div className="order-action-footer">
          <button className="button accent full" type="button" onClick={g.signAndSubmit}><PenLine size={16} /> Sign {signaturesRequired} orders</button>
          <button className="button outline full" type="button" onClick={g.stop}><OctagonX size={15} /> Stop — nothing submitted</button>
          <p className="caption">Your wallet will ask for {signaturesRequired} signatures, one per order, shown as “Signing x of {signaturesRequired}”. Rejecting any signature discards the whole batch.</p>
        </div>
      ) : null}

      {state.tag === "signing" ? (
        <div className="grid-progress" role="status">
          <Loader2 className="spin" size={18} />
          <div><strong>Signing {state.current} of {state.total}</strong><span>Confirm each order in your wallet. Nothing is submitted until all {state.total} are signed.</span></div>
          <button className="button outline" type="button" onClick={g.stop}><OctagonX size={14} /> Stop</button>
        </div>
      ) : null}

      {state.tag === "submitting" ? (
        <div className="grid-progress" role="status">
          <Loader2 className="spin" size={18} />
          <div><strong>Submitting {state.current} of {state.total}</strong><span>Sending signed orders to the Seltra orderbook.</span></div>
        </div>
      ) : null}

      {state.tag === "complete" ? (
        <>
          <p className="form-success"><CheckCircle2 size={14} /> Grid placed: {state.manifest.orderHashes.length} orders resting. They appear grouped in your orders view.</p>
          <div className="order-action-footer">
            <a className="button outline full" href="/orders">View orders</a>
            <button className="button accent full" type="button" onClick={g.reset}>New grid</button>
          </div>
        </>
      ) : null}

      {state.tag === "partial-failure" ? (
        <>
          <p className="form-error"><AlertTriangle size={14} /> Partial grid: {state.manifest.orderHashes.length} accepted, {state.manifest.failedLevels.length} failed. This grid is not complete.</p>
          <ul className="grid-failures">
            {state.manifest.failedLevels.map((failure) => (
              <li key={failure.index}><span>Level {failure.index + 1}</span> {failure.reason}</li>
            ))}
          </ul>
          <div className="order-action-footer">
            <button className="button accent full" type="button" onClick={g.retryFailed}>Retry failed submissions</button>
            <p className="caption">Retry reuses the already-signed orders held in memory. Reloading the page discards them; failed levels would then need a new grid.</p>
          </div>
        </>
      ) : null}
    </>
  );
}

function GridLadder({ plan, baseSymbol, quoteSymbol, baseDecimals, quoteDecimals }: {
  plan: GridPlan;
  baseSymbol: string;
  quoteSymbol: string;
  baseDecimals: number;
  quoteDecimals: number;
}) {
  // Orderbook orientation: highest price on top, buys at the bottom.
  const descending = [...plan.levels].sort((a, b) => Number(b.price) - Number(a.price));
  const neutralAfter = plan.neutralPrice ? descending.findIndex((level) => Number(level.price) < Number(plan.neutralPrice)) : -1;
  const rows: (GridLevel | { neutral: string })[] = [...descending];
  if (plan.neutralPrice) rows.splice(neutralAfter === -1 ? rows.length : neutralAfter, 0, { neutral: plan.neutralPrice });
  return (
    <div className="grid-ladder" role="table" aria-label="Grid levels">
      <div className="grid-ladder-row header" role="row">
        <span>Price</span><span>Side</span><span>Pay</span><span>Min receive</span>
      </div>
      {rows.map((row) =>
        "neutral" in row ? (
          <div key="neutral" className="grid-ladder-row neutral" role="row">
            <span className="number">{row.neutral}</span><span>reference</span><span>no order at the neutral level</span><span />
          </div>
        ) : (
          <div key={row.index} className={`grid-ladder-row ${row.side}`} role="row">
            <span className="number">{row.price}</span>
            <span className={`side-cell ${row.side}`}>{row.side.toUpperCase()}</span>
            <span className="number">
              {row.side === "buy" ? `${formatToken(row.makingAmount, quoteDecimals, 4)} ${quoteSymbol}` : `${formatToken(row.makingAmount, baseDecimals, 4)} ${baseSymbol}`}
            </span>
            <span className="number">
              {row.side === "buy" ? `${formatToken(row.takingAmount, baseDecimals, 4)} ${baseSymbol}` : `${formatToken(row.takingAmount, quoteDecimals, 4)} ${quoteSymbol}`}
            </span>
          </div>
        ),
      )}
    </div>
  );
}
