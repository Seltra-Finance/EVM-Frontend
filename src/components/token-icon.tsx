import Image from "next/image";

// Official token marks saved locally under public/tokens (sourced from the
// widely-used trustwallet/assets repository by contract address, never
// hotlinked). Demo/testnet symbols map onto the same real-asset icon they
// represent — the UI already labels the network as Testnet elsewhere.
const TOKEN_ICONS: Record<string, string> = {
  WAVAX: "/tokens/wavax.png",
  sWAVAX: "/tokens/wavax.png",
  AVAX: "/tokens/wavax.png",
  USDC: "/tokens/usdc.png",
  sUSDC: "/tokens/usdc.png",
  "USDt": "/tokens/usdt.png",
  "WETH.e": "/tokens/weth.png",
  "BTC.b": "/tokens/btc.png",
};

/** Tether's on-chain symbol on Avalanche is literally "USDt" — normalize only the display text, never the underlying identifier used for pair ids/API calls. */
export function displaySymbol(symbol: string): string {
  return symbol === "USDt" ? "USDT" : symbol;
}

export function TokenIcon({ symbol, size = 18 }: { symbol: string; size?: number }) {
  const src = TOKEN_ICONS[symbol];
  if (src) {
    return <Image src={src} alt="" width={size} height={size} unoptimized className="token-icon" aria-hidden />;
  }
  return (
    <span className="token-icon token-icon-fallback" style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }} aria-hidden>
      {symbol.slice(0, 1).toUpperCase()}
    </span>
  );
}
