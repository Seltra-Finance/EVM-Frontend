"use client";

import { CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { Hex } from "viem";
import type { OrderRecord } from "@seltra/sdk";
import { pairById } from "@/config/seltra.config";
import { displaySymbol } from "@/components/token-icon";
import { seltraApi } from "@/lib/api";

// Fill notifications: the user WS channel already pushes every order change;
// this listens for the transition into "filled" and surfaces it. In-app toast
// always; a system notification additionally when the tab is hidden AND the
// user has already granted permission elsewhere — this never requests
// notification permission itself.

interface FillToast {
  orderHash: Hex;
  pair: string;
  side: "buy" | "sell";
  baseAmount: string;
  price: string;
  quoteSymbol: string;
  baseSymbol: string;
}

/** Only fills fresher than this count as live events, not history replay. */
const FRESH_FILL_MS = 60_000;
const TOAST_DISMISS_MS = 10_000;
const MAX_STACK = 4;

export function FillToasts() {
  const { address } = useAccount();
  const [toasts, setToasts] = useState<FillToast[]>([]);
  const statuses = useRef(new Map<string, string>());

  useEffect(() => {
    if (!address) return;
    const known = statuses.current;
    known.clear();
    // Seed known statuses so a reconnect replaying current state can't
    // re-announce an old fill as new.
    void seltraApi
      .getOrders({ maker: address })
      .then((orders) => {
        for (const order of orders) {
          if (!known.has(order.orderHash)) known.set(order.orderHash, order.status);
        }
      })
      .catch(() => undefined);

    const dismiss = (orderHash: Hex) => setToasts((current) => current.filter((toast) => toast.orderHash !== orderHash));

    const announce = (record: OrderRecord) => {
      const pair = pairById(record.pair);
      const toast: FillToast = {
        orderHash: record.orderHash,
        pair: record.pair,
        side: record.side,
        baseAmount: Number(record.baseAmount).toFixed(pair.amountPrecision),
        price: Number(record.price).toFixed(pair.pricePrecision),
        quoteSymbol: displaySymbol(pair.quote),
        baseSymbol: displaySymbol(pair.base),
      };
      setToasts((current) => [...current.filter((t) => t.orderHash !== toast.orderHash), toast].slice(-MAX_STACK));
      setTimeout(() => dismiss(toast.orderHash), TOAST_DISMISS_MS);
      if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Seltra — order filled", {
          body: `${toast.side.toUpperCase()} ${toast.baseAmount} ${toast.baseSymbol} at ${toast.price} ${toast.quoteSymbol}`,
        });
      }
    };

    const unsubscribe = seltraApi.subscribeUser(address, (msg) => {
      const record = msg.order;
      const previous = known.get(record.orderHash);
      known.set(record.orderHash, record.status);
      if (record.status !== "filled" || previous === "filled") return;
      // An order we've never seen whose fill isn't fresh is history, not news.
      if (previous === undefined && Date.now() - record.updatedAt > FRESH_FILL_MS) return;
      announce(record);
    });
    return () => {
      unsubscribe();
      setToasts([]);
    };
  }, [address]);

  if (toasts.length === 0) return null;

  return (
    <div className="fill-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.orderHash} className={`fill-toast ${toast.side}`}>
          <CheckCircle2 size={16} aria-hidden />
          <div className="fill-toast-body">
            <strong>Order filled</strong>
            <span className="number">
              {toast.side.toUpperCase()} {toast.baseAmount} {toast.baseSymbol} at {toast.price} {toast.quoteSymbol}
            </span>
            <Link href={`/order/${toast.orderHash}`}>View fill</Link>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToasts((current) => current.filter((t) => t.orderHash !== toast.orderHash))}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
