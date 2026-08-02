// USD conversion for stats volume. Volume is reported by the backend in each
// pair's quote token (USDC, USDt, WAVAX, …). To show a single dollar figure we
// triangulate: dollar stables count 1:1, and WAVAX-quoted volume is converted
// through the live WAVAX/USD executable quote. Anything we can't price is left
// in its native token rather than guessed.

const USD_STABLES = new Set(["USDC", "USDt", "USDT", "sUSDC", "DAI"]);

export function isUsdStable(symbol: string): boolean {
  return USD_STABLES.has(symbol);
}

export function isWavaxLike(symbol: string): boolean {
  return symbol === "WAVAX" || symbol === "sWAVAX";
}

/** USD value of one unit of `quoteSymbol`, or undefined if it can't be priced. `avaxUsd` = USD per WAVAX. */
export function usdRateForQuote(quoteSymbol: string, avaxUsd: number | undefined): number | undefined {
  if (isUsdStable(quoteSymbol)) return 1;
  if (isWavaxLike(quoteSymbol)) return avaxUsd && avaxUsd > 0 ? avaxUsd : undefined;
  return undefined;
}

export interface QuoteVolume {
  quoteSymbol: string;
  amount: string;
}

export interface UsdVolume {
  /** Sum of the priced portion in USD, or null when nothing could be priced. */
  usd: number | null;
  /** Entries that couldn't be priced, left in their native token. */
  unpriced: QuoteVolume[];
  /** True when every entry was priced (and there was at least one). */
  complete: boolean;
}

/** Converts per-quote-token volumes into a single USD figure where possible. */
export function usdVolume(entries: QuoteVolume[], avaxUsd: number | undefined): UsdVolume {
  let usd = 0;
  let priced = 0;
  const unpriced: QuoteVolume[] = [];
  for (const entry of entries) {
    const rate = usdRateForQuote(entry.quoteSymbol, avaxUsd);
    const amount = Number(entry.amount);
    if (rate === undefined || !Number.isFinite(amount)) {
      unpriced.push(entry);
      continue;
    }
    usd += amount * rate;
    priced += 1;
  }
  return { usd: priced > 0 ? usd : null, unpriced, complete: priced > 0 && unpriced.length === 0 };
}
