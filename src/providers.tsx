"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { ensureAppKit, hasPersistedWalletSession } from "@/lib/appkit";
import { appKitEnabled, wagmiConfig } from "@/lib/wallet";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // AppKit itself is lazy (see lib/appkit.ts) — but a returning WalletConnect
  // session can only re-establish once the modal stack exists, so warm it in
  // the background when storage shows one. Injected-wallet reconnects go
  // through wagmi directly and don't need this.
  useEffect(() => {
    if (appKitEnabled && hasPersistedWalletSession()) void ensureAppKit();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
