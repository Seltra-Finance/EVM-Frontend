"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, PenLine, ShieldCheck, Wallet } from "lucide-react";
import { useState } from "react";
import { formatToken } from "@/lib/format";
import { HIGH_SLIPPAGE_BPS, validateCustomSlippagePercent } from "@/lib/order-validation";
import type { OrderEntryMachine } from "@/hooks/use-order-entry-machine";
import { ExpiryControl, presetsWithinMax } from "@/components/expiry-control";
import { GridOrderForm } from "@/components/grid-order-form";
import { InfoTip } from "@/components/info-tip";
import { seltraConfig } from "@/config/seltra.config";

const EXPIRY_OPTIONS = presetsWithinMax(seltraConfig.maxExpirySeconds);

function expiryLabel(seconds: number): string {
  return EXPIRY_OPTIONS.find((option) => option.seconds === seconds)?.label ?? `${seconds}s`;
}

const SLIPPAGE_PRESET_BPS = [10, 50, 100];

export function OrderForm({ machine: m, midPrice }: { machine: OrderEntryMachine; midPrice?: number }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Grid is a batch flow with its own machine; the tab is local so the
  // single-order machine stays untouched while it is open.
  const [gridOpen, setGridOpen] = useState(false);
  const { pair, base, quote, makerAsset, takerAsset, state } = m;
  const setQuickPrice = (factor: number) => {
    if (midPrice) m.setPrice((midPrice * factor).toFixed(pair.pricePrecision));
  };
  const pickKind = (kind: "limit" | "market") => {
    setGridOpen(false);
    m.setKind(kind);
  };

  if (gridOpen) {
    return (
      <section className="panel order-form flow-grid" aria-busy={false}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Order entry</p>
            <h2>
              Grid bot{" "}
              <InfoTip>
                A grid places a ladder of limit orders across your price range: buys below the current price, sells
                above it. When the market crosses a level, that order fills once at its price or better. Filled levels
                stay filled — nothing is re-placed automatically. Every level is a normal gasless Seltra limit order,
                signed individually in your wallet, and you can cancel any of them at any time.
              </InfoTip>
            </h2>
          </div>
        </div>
        <div className="order-kind-tabs" role="tablist" aria-label="Order type">
          <button type="button" role="tab" aria-selected={false} onClick={() => pickKind("limit")}>Limit</button>
          <button type="button" role="tab" aria-selected={false} onClick={() => pickKind("market")}>Market</button>
          <button className="active" type="button" role="tab" aria-selected>Bot</button>
        </div>
        <GridOrderForm pairId={pair.id} referencePrice={m.referencePrice ?? midPrice} />
      </section>
    );
  }

  return (
    <section className={`panel order-form flow-${state.tag} ${m.isConnected && !m.wrongNetwork ? `side-${m.side}` : ""}`} aria-busy={m.busy}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Order entry</p>
          <h2>Limit order</h2>
        </div>
      </div>
      <div className="order-kind-tabs" role="tablist" aria-label="Order type">
        <button className={m.kind === "limit" ? "active" : ""} type="button" role="tab" aria-selected={m.kind === "limit"} onClick={() => pickKind("limit")}>Limit</button>
        <button className={m.kind === "market" ? "active" : ""} type="button" role="tab" aria-selected={m.kind === "market"} onClick={() => pickKind("market")}>Market</button>
        <button type="button" role="tab" aria-selected={false} onClick={() => setGridOpen(true)}>Bot</button>
      </div>
      <div className="side-tabs">
        <button className={m.side === "buy" ? "active buy-tab" : ""} type="button" onClick={() => m.setSide("buy")}>
          Buy
        </button>
        <button className={m.side === "sell" ? "active sell-tab" : ""} type="button" onClick={() => m.setSide("sell")}>
          Sell
        </button>
      </div>
      <label className="field">
        <span className="field-label">Amount <small>{makerAsset.symbol}</small></span>
        <div className="input-row">
          <input value={m.amount} onChange={(event) => m.setAmount(event.target.value)} inputMode="decimal" />
          <button type="button" onClick={m.setMaxAmount}>
            MAX
          </button>
        </div>
        <small className="balance-line">Available <strong className="number">{m.balance === undefined ? "-" : formatToken(m.balance, makerAsset.decimals, 4)} {makerAsset.symbol}</strong></small>
        {m.nativeAvaxApplicable ? <NativeAvaxToggle m={m} /> : null}
      </label>
      <div className="percent-buttons" aria-label="Amount presets">
        {[25n, 50n, 75n, 100n].map((percent) => <button key={percent.toString()} type="button" onClick={() => m.setAmountPercent(percent)} disabled={!m.balance && !(m.useNativeAvax && m.nativeBalance)}>{percent.toString()}%</button>)}
      </div>
      {m.kind === "limit" ? (
        <>
          <label className="field">
            <span className="field-label">Limit price <small>{quote.symbol} per {base.symbol}</small></span>
            <div className="input-row">
              <input value={m.price} onChange={(event) => m.setPrice(event.target.value)} inputMode="decimal" />
              <span>{quote.symbol}</span>
            </div>
          </label>
          <div className="quick-price" aria-label="Limit price shortcuts">
            <span>Price shortcuts</span>
            <button type="button" disabled={!midPrice} title={midPrice ? undefined : "No executable quote or resting orders to derive a price from yet"} onClick={() => setQuickPrice(1)}>Mid</button>
            <button type="button" disabled={!midPrice} onClick={() => setQuickPrice(0.99)}>-1%</button>
            <button type="button" disabled={!midPrice} onClick={() => setQuickPrice(1.01)}>+1%</button>
          </div>
          <p className="caption">Sets the limit price relative to the current reference price. Your order only fills at this price or better — a limit order has no slippage.</p>
          <div className="advanced-settings">
            <button type="button" className="advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}><span>Advanced settings</span><ChevronDown size={15} /></button>
            {advancedOpen ? (
              <label className="field advanced-field">
                <span className="field-label">
                  Expiry <small>Maximum {expiryLabel(seltraConfig.maxExpirySeconds)}</small>
                </span>
                <ExpiryControl seconds={m.expirySeconds} onChange={m.setExpirySeconds} onValidChange={m.setExpiryValid} idPrefix="limit-expiry" />
              </label>
            ) : null}
          </div>
        </>
      ) : (
        <MarketSlippagePanel m={m} />
      )}
      <div className="summary-box">
        <div>
          <span>You pay at most</span>
          <strong className="number">
            {formatToken(m.makingAmount, makerAsset.decimals, 4)} {makerAsset.symbol}
          </strong>
        </div>
        <div>
          <span>You receive at least</span>
          <span className="summary-value">
            <strong className="number">
              {formatToken(m.takingAmount, takerAsset.decimals, 4)} {takerAsset.symbol}
            </strong>
            {takerAsset.symbol === "WAVAX" ? (
              <small className="wavax-output-note">Settlement transfers WAVAX, the wrapped-AVAX ERC-20 — not native AVAX automatically.</small>
            ) : null}
          </span>
        </div>
        <div className="summary-improvement">
          <span>Price improvement</span>
          <strong><b>70%</b> of surplus is yours</strong>
        </div>
        <div>
          <span>Signing fee</span>
          <strong>Gasless</strong>
        </div>
        <div>
          <span>Expiry</span>
          <strong className="number">{m.kind === "market" ? "10m" : expiryLabel(m.expirySeconds)}</strong>
        </div>
      </div>
      {m.needsApproval ? <p className="approval-note"><ShieldCheck size={15} /> One-time Permit2 approval. Seltra never receives a standing approval.</p> : null}
      {m.insufficientBalance ? <p className="form-error"><AlertTriangle size={15} /> Insufficient {makerAsset.symbol} balance.</p> : null}
      {state.tag === "rejected" ? (
        <p className="form-error">
          <AlertTriangle size={14} /> {state.reason}
        </p>
      ) : null}
      {state.tag === "resting" ? (
        <p className="form-success">
          <CheckCircle2 size={14} /> Order placed. Resting until {m.effectivePrice} or better.
        </p>
      ) : null}
      <div className="order-action-footer">
        <button
          className="button accent full"
          type="button"
          disabled={m.ctaDisabled}
          onClick={m.primaryAction}
        >
          {m.busy && state.tag !== "validating" ? <Loader2 className="spin" size={16} /> : !m.isConnected ? <Wallet size={16} /> : <PenLine size={16} />}
          {m.ctaLabel}
        </button>
        <p className="caption">Your funds stay in your wallet until an exact fill. Signing an order is gasless.</p>
      </div>
      {state.tag === "awaiting-signature" ? <div className="signature-pending" role="status"><div><Loader2 className="spin" size={20} /><h3>Confirm in wallet</h3><p>One signature. No gas. Funds stay in your wallet until the exact fill.</p></div></div> : null}
    </section>
  );
}

/**
 * Native AVAX is a frontend funding convenience: it always routes through a
 * WAVAX wrap before anything is signed. Only shown when the maker asset for
 * this side is WAVAX.
 */
function NativeAvaxToggle({ m }: { m: OrderEntryMachine }) {
  return (
    <div className="native-avax-toggle">
      <label className="toggle-row">
        <input type="checkbox" checked={m.useNativeAvax} onChange={(event) => m.setUseNativeAvax(event.target.checked)} />
        <span>Use native AVAX</span>
      </label>
      {m.useNativeAvax ? (
        <p className="caption native-avax-note">
          {m.nativeBalance !== undefined ? `${formatToken(m.nativeBalance, 18, 4)} AVAX available. ` : ""}
          AVAX routes through WAVAX —{" "}
          {m.wavaxDeficit > 0n
            ? `${formatToken(m.wavaxDeficit, 18, 6)} AVAX will be wrapped to WAVAX before signing.`
            : "your existing WAVAX balance already covers this amount, so no wrap is needed."}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Market orders sign a marketable limit; slippage is the only place that
 * bound comes from (a plain Limit order has none — its price is the bound).
 */
function MarketSlippagePanel({ m }: { m: OrderEntryMachine }) {
  const [customMode, setCustomMode] = useState(!SLIPPAGE_PRESET_BPS.includes(m.slippageBps));
  const [customPercent, setCustomPercent] = useState(() => (customMode ? (m.slippageBps / 100).toString() : ""));
  const [customError, setCustomError] = useState<string | null>(null);

  function selectPreset(bps: number) {
    setCustomMode(false);
    setCustomError(null);
    m.setSlippageValid(true);
    m.setSlippageBps(bps);
  }

  function updateCustom(raw: string) {
    setCustomPercent(raw);
    const result = validateCustomSlippagePercent(raw);
    if (!result.ok) {
      setCustomError(result.error);
      m.setSlippageValid(false);
      return;
    }
    setCustomError(null);
    m.setSlippageValid(true);
    m.setSlippageBps(result.value);
  }

  const isHighSlippage = customError === null && m.slippageBps >= HIGH_SLIPPAGE_BPS;

  return (
    <>
      <div className="quick-price" aria-label="Slippage bound">
        <span>Max slippage</span>
        {SLIPPAGE_PRESET_BPS.map((bps) => (
          <button key={bps} type="button" className={!customMode && m.slippageBps === bps ? "active" : ""} onClick={() => selectPreset(bps)}>
            {(bps / 100).toFixed(1)}%
          </button>
        ))}
        <button
          type="button"
          className={customMode ? "active" : ""}
          onClick={() => {
            setCustomMode(true);
            updateCustom(customPercent);
          }}
        >
          Custom
        </button>
      </div>
      {customMode ? (
        <div className="field advanced-field">
          <div className="input-row">
            <input
              value={customPercent}
              onChange={(event) => updateCustom(event.target.value)}
              inputMode="decimal"
              aria-label="Custom slippage percent"
              aria-invalid={customError !== null}
              placeholder="e.g. 0.35"
            />
            <span>%</span>
          </div>
          {customError ? <p className="form-error field-error" role="alert">{customError}</p> : null}
        </div>
      ) : null}
      {isHighSlippage ? (
        <p className="form-error field-error" role="alert">
          <AlertTriangle size={12} /> {(m.slippageBps / 100).toFixed(2)}% is unusually high slippage — a fill could land well below the executable price.
        </p>
      ) : null}
      <p className="caption market-note">
        {m.referencePrice !== undefined
          ? `Executable reference ${m.referencePrice.toFixed(m.pair.pricePrecision)} ${m.quote.symbol}. Signs a worst acceptable price of ${m.effectivePrice} ${m.quote.symbol} (${(m.slippageBps / 100).toFixed(2)}% ${m.side === "sell" ? "below" : "above"} reference). It cannot fill worse than this and expires in 10 minutes if unfilled.`
          : "No executable quote available right now — market orders need a live venue price."}
      </p>
    </>
  );
}
