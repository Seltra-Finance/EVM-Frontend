import type { Address } from "viem";

const zeroAddress = "0x0000000000000000000000000000000000000000" as const;

// NEXT_PUBLIC_ vars are inlined into the client bundle only when read as a
// static member expression (process.env.NEXT_PUBLIC_X). Never read them via
// process.env[name] — that returns undefined in the browser and desyncs
// server/client rendering.
function env(value: string | undefined, fallback: string): string {
  return value && value !== "" ? value : fallback;
}

function addressEnv(value: string | undefined, fallback: Address = zeroAddress): Address {
  return env(value, fallback) as Address;
}

function boundedIntegerEnv(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(env(value, String(fallback)));
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export interface TokenConfig {
  symbol: string;
  address: Address;
  decimals: number;
  logo: string;
}

export interface PairConfig {
  id: string;
  base: string;
  quote: string;
  pricePrecision: number;
  amountPrecision: number;
}

export interface SeltraConfig {
  chainId: 43113 | 43114;
  rpcUrl: string;
  explorerBaseUrl: string;
  api: { restUrl: string; wsUrl: string };
  contracts: {
    settlement: Address;
    router: Address;
    permit2: Address;
  };
  tokens: TokenConfig[];
  pairs: PairConfig[];
  walletConnectProjectId: string;
  maxExpirySeconds: number;
  surplusSplit: { makerBps: 7000; keeperBps: 3000 };
}

interface PairRegistryValue {
  base: Address;
  baseSymbol: string;
  baseDecimals: number;
  quote: Address;
  quoteSymbol: string;
  quoteDecimals: number;
}

interface ParsedPairRegistry {
  tokens: TokenConfig[];
  pairs: PairConfig[];
}

const TOKEN_AMOUNT_PRECISION: Record<string, number> = {
  WAVAX: 4,
  "WETH.e": 5,
  "BTC.b": 6,
  USDC: 2,
  USDt: 2,
};

function parsePairRegistry(raw: string | undefined): ParsedPairRegistry | undefined {
  if (!raw?.trim()) return undefined;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_PAIRS must be valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("NEXT_PUBLIC_PAIRS must be a JSON object");
  }

  const tokensByAddress = new Map<string, TokenConfig>();
  const tokenAddressBySymbol = new Map<string, string>();
  const pairIds = new Set<string>();
  const pairs: PairConfig[] = [];

  for (const [registryName, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`NEXT_PUBLIC_PAIRS.${registryName} must be an object`);
    }
    const item = entry as Record<string, unknown>;
    const pair: PairRegistryValue = {
      base: pairAddress(item.base, `${registryName}.base`),
      baseSymbol: pairSymbol(item.baseSymbol, `${registryName}.baseSymbol`),
      baseDecimals: tokenDecimals(item.baseDecimals, `${registryName}.baseDecimals`),
      quote: pairAddress(item.quote, `${registryName}.quote`),
      quoteSymbol: pairSymbol(item.quoteSymbol, `${registryName}.quoteSymbol`),
      quoteDecimals: tokenDecimals(item.quoteDecimals, `${registryName}.quoteDecimals`),
    };
    if (pair.base.toLowerCase() === pair.quote.toLowerCase()) {
      throw new Error(`NEXT_PUBLIC_PAIRS.${registryName} must use two different tokens`);
    }

    registerToken(tokensByAddress, tokenAddressBySymbol, pair.base, pair.baseSymbol, pair.baseDecimals);
    registerToken(tokensByAddress, tokenAddressBySymbol, pair.quote, pair.quoteSymbol, pair.quoteDecimals);

    const id = `${pair.baseSymbol}-${pair.quoteSymbol}`;
    if (pairIds.has(id.toLowerCase())) throw new Error(`duplicate frontend pair ${id}`);
    pairIds.add(id.toLowerCase());
    pairs.push({
      id,
      base: pair.baseSymbol,
      quote: pair.quoteSymbol,
      pricePrecision: pair.quoteSymbol === "USDt" ? 5 : 4,
      amountPrecision: TOKEN_AMOUNT_PRECISION[pair.baseSymbol] ?? Math.min(pair.baseDecimals, 6),
    });
  }

  if (pairs.length === 0) throw new Error("NEXT_PUBLIC_PAIRS must contain at least one pair");
  return { tokens: [...tokensByAddress.values()], pairs };
}

function pairAddress(value: unknown, label: string): Address {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`NEXT_PUBLIC_PAIRS.${label} must be an EVM address`);
  }
  return value as Address;
}

function pairSymbol(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 16 || /[-/]/.test(value)) {
    throw new Error(`NEXT_PUBLIC_PAIRS.${label} is invalid`);
  }
  return value;
}

function tokenDecimals(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 255) {
    throw new Error(`NEXT_PUBLIC_PAIRS.${label} must be an integer from 0 to 255`);
  }
  return parsed;
}

function registerToken(
  byAddress: Map<string, TokenConfig>,
  addressBySymbol: Map<string, string>,
  address: Address,
  symbol: string,
  decimals: number,
): void {
  const normalizedAddress = address.toLowerCase();
  const normalizedSymbol = symbol.toLowerCase();
  const existing = byAddress.get(normalizedAddress);
  if (existing && (existing.symbol !== symbol || existing.decimals !== decimals)) {
    throw new Error(`token ${address} has conflicting frontend metadata`);
  }
  const symbolAddress = addressBySymbol.get(normalizedSymbol);
  if (symbolAddress && symbolAddress !== normalizedAddress) {
    throw new Error(`token symbol ${symbol} maps to more than one address`);
  }
  byAddress.set(normalizedAddress, {
    symbol,
    address,
    decimals,
    logo: symbol.slice(0, 1).toUpperCase(),
  });
  addressBySymbol.set(normalizedSymbol, normalizedAddress);
}

// Defaults are the deployed Fuji demo stack (contracts repo addresses.fuji.json):
// open-mint sWAVAX/sUSDC, the only pair the deployed settlement allowlists.
// Settlement/router intentionally default to zero (placement stays blocked)
// until .env.local supplies the real addresses.
const baseToken: TokenConfig = {
  symbol: env(process.env.NEXT_PUBLIC_BASE_SYMBOL, "sWAVAX"),
  address: addressEnv(process.env.NEXT_PUBLIC_BASE_TOKEN, "0x760D9a5B4ae94f5e6c3ce014e3C116544515C830"),
  decimals: Number(env(process.env.NEXT_PUBLIC_BASE_DECIMALS, "18")),
  logo: env(process.env.NEXT_PUBLIC_BASE_SYMBOL, "sWAVAX").slice(0, 1).toUpperCase(),
};

const quoteToken: TokenConfig = {
  symbol: env(process.env.NEXT_PUBLIC_QUOTE_SYMBOL, "sUSDC"),
  address: addressEnv(process.env.NEXT_PUBLIC_QUOTE_TOKEN, "0x00B766567013BbCe12bF802f6E7C65F6da581Efe"),
  decimals: Number(env(process.env.NEXT_PUBLIC_QUOTE_DECIMALS, "6")),
  logo: env(process.env.NEXT_PUBLIC_QUOTE_SYMBOL, "sUSDC").slice(0, 1).toUpperCase(),
};

const pairRegistry = parsePairRegistry(process.env.NEXT_PUBLIC_PAIRS);
const fallbackPair: PairConfig = {
  id: `${baseToken.symbol}-${quoteToken.symbol}`,
  base: baseToken.symbol,
  quote: quoteToken.symbol,
  pricePrecision: 2,
  amountPrecision: 4,
};

export const seltraConfig: SeltraConfig = {
  chainId: Number(env(process.env.NEXT_PUBLIC_CHAIN_ID, "43113")) === 43114 ? 43114 : 43113,
  rpcUrl: env(process.env.NEXT_PUBLIC_RPC_URL, "https://api.avax-test.network/ext/bc/C/rpc"),
  explorerBaseUrl: env(process.env.NEXT_PUBLIC_EXPLORER_BASE_URL, "https://testnet.snowtrace.io"),
  api: {
    restUrl: env(process.env.NEXT_PUBLIC_API_REST_URL, "http://localhost:8080"),
    wsUrl: env(process.env.NEXT_PUBLIC_API_WS_URL, "ws://localhost:8080/stream"),
  },
  contracts: {
    settlement: addressEnv(process.env.NEXT_PUBLIC_SETTLEMENT),
    router: addressEnv(process.env.NEXT_PUBLIC_ROUTER),
    permit2: addressEnv(process.env.NEXT_PUBLIC_PERMIT2, "0x000000000022D473030F116dDEE9F6B43aC78BA3"),
  },
  tokens: pairRegistry?.tokens ?? [baseToken, quoteToken],
  pairs: pairRegistry?.pairs ?? [fallbackPair],
  walletConnectProjectId: env(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, ""),
  maxExpirySeconds: boundedIntegerEnv(
    process.env.NEXT_PUBLIC_MAX_EXPIRY_SECONDS,
    2_592_000,
    3_600,
    2_592_000,
  ),
  surplusSplit: { makerBps: 7000, keeperBps: 3000 },
};

export const defaultPairId = seltraConfig.pairs[0].id;
export const defaultTradePath = `/trade/${defaultPairId}`;

export function pairById(pairId: string): PairConfig {
  return seltraConfig.pairs.find((pair) => pair.id === pairId) ?? seltraConfig.pairs[0];
}

export function tokenBySymbol(symbol: string): TokenConfig {
  const token = seltraConfig.tokens.find((item) => item.symbol === symbol);
  if (!token) throw new Error(`Unknown token ${symbol}`);
  return token;
}

export function isConfiguredAddress(address: Address): boolean {
  return address.toLowerCase() !== zeroAddress;
}

export const WAVAX_SYMBOL = "WAVAX";

/**
 * Native AVAX is a frontend funding convenience only — Seltra Settlement and
 * Permit2 only ever operate on the WAVAX ERC-20. Native AVAX must never
 * appear as address(0) (or any address) in an order, API request, pair
 * registry, or signature: it has no address here on purpose. Any flow that
 * lets a user fund with native AVAX wraps the deficit into WAVAX before an
 * order is built.
 */
export const nativeAvax = { symbol: "AVAX", decimals: 18 } as const;

export function isWavax(token: Pick<TokenConfig, "symbol">): boolean {
  return token.symbol === WAVAX_SYMBOL;
}

/** True when a leg of this pair is WAVAX, so a native-AVAX funding shortcut can apply. */
export function pairHasWavaxLeg(pair: PairConfig): boolean {
  return pair.base === WAVAX_SYMBOL || pair.quote === WAVAX_SYMBOL;
}

/**
 * Resolves a display pair id to its canonical pair id. Display ids may use
 * the "AVAX" funding alias in place of a WAVAX leg (e.g. "AVAX-USDC" for
 * canonical "WAVAX-USDC", or "WETH.e-AVAX" for canonical "WETH.e-WAVAX").
 * This never introduces a second orderbook, history, or API pair id — the
 * alias resolves to the exact same canonical pair.
 */
export function resolveDisplayPairId(input: string, pairs: PairConfig[] = seltraConfig.pairs): string | undefined {
  const trimmed = input.trim();
  if (pairs.some((pair) => pair.id === trimmed)) return trimmed;
  const aliased = trimmed
    .split("-")
    .map((segment) => (segment === nativeAvax.symbol ? WAVAX_SYMBOL : segment))
    .join("-");
  return aliased !== trimmed && pairs.some((pair) => pair.id === aliased) ? aliased : undefined;
}
