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
  tokens: [baseToken, quoteToken],
  pairs: [
    {
      id: `${baseToken.symbol}-${quoteToken.symbol}`,
      base: baseToken.symbol,
      quote: quoteToken.symbol,
      pricePrecision: 2,
      amountPrecision: 4,
    },
  ],
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
