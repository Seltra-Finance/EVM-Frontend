"use client";

import { activeChain, appKitEnabled, appKitNetworks, projectId, wagmiAdapter } from "@/lib/wallet";

// AppKit's modal (wallet discovery UI, WalletConnect relay, wallet icon sets)
// is by far the heaviest dependency on the trade page. It is only needed the
// moment the user opens the connect dialog — so it loads as a dynamic chunk
// then, not in the first-load bundle. The one exception: a persisted
// WalletConnect session needs the modal stack initialized to re-establish
// itself, so Providers eagerly warms this after mount when such a session
// exists in storage (still an async chunk, still off the critical path).

interface AppKitModal {
  open: (options?: { view?: "Connect" }) => Promise<void> | void;
}

let modalPromise: Promise<AppKitModal> | null = null;

export function ensureAppKit(): Promise<AppKitModal> | null {
  if (!appKitEnabled || !wagmiAdapter) return null;
  if (!modalPromise) {
    modalPromise = import("@reown/appkit/react").then(
      ({ createAppKit }) =>
        createAppKit({
          adapters: [wagmiAdapter!],
          networks: [...appKitNetworks],
          defaultNetwork: appKitNetworks[activeChain.id === 43114 ? 1 : 0],
          projectId,
          metadata: {
            name: "Seltra",
            description: "Wallet-native limit orders on Avalanche.",
            url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            icons: [],
          },
          // Wallets only: no email/social login, no analytics beacon (CSP stays tight).
          features: { email: false, socials: false, analytics: false, swaps: false, onramp: false },
          themeMode: "dark",
          themeVariables: {
            "--w3m-accent": "#2dd4bf",
            "--w3m-border-radius-master": "2px",
            // Match the app's UI font (globals.css --font-ui); AppKit defaults to its own.
            "--w3m-font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
          },
        }) as unknown as AppKitModal,
    );
  }
  return modalPromise;
}

export async function openAppKit(): Promise<void> {
  const modal = await ensureAppKit();
  if (modal) await modal.open({ view: "Connect" });
}

/** Evidence of a prior WalletConnect/AppKit session that needs the modal stack to reconnect. */
export function hasPersistedWalletSession(): boolean {
  try {
    return Object.keys(window.localStorage).some(
      (key) => key.startsWith("wc@2:") || key.startsWith("@appkit") || key.startsWith("@w3m"),
    );
  } catch {
    return false;
  }
}
