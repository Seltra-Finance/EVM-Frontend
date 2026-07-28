"use client";

import { useCallback, useRef, useState } from "react";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { wavaxAbi } from "@/lib/abi";
import { isWavax, seltraConfig, type TokenConfig } from "@/config/seltra.config";

// Native AVAX is a frontend funding convenience only: Settlement/Permit2
// never see it. Before any order or grid can use it, the deficit between
// what's needed and the wallet's current WAVAX balance is wrapped into WAVAX
// via WAVAX.deposit(). This hook owns only the wrap transaction's mechanics —
// callers own balances/allowances and refetch them once wrap() resolves.

export type AvaxWrapPhase = "idle" | "estimating" | "wrapping" | "wrapped" | "rejected" | "reverted" | "timed-out";

/** Flat headroom reserved for the Permit2 approve transaction(s) that follow a wrap. */
const APPROVE_GAS_RESERVE_WEI = 10_000_000_000_000_000n; // 0.01 AVAX
/** Multiplies the live gas estimate so a price spike between estimate and send doesn't strand the tx. */
const GAS_ESTIMATE_BUFFER_NUM = 13n;
const GAS_ESTIMATE_BUFFER_DEN = 10n;
/** Used only if live estimation fails (e.g. RPC hiccup) — a conservative flat fallback. */
const FALLBACK_WRAP_GAS_RESERVE_WEI = 5_000_000_000_000_000n; // 0.005 AVAX

export function wavaxToken(): TokenConfig | undefined {
  return seltraConfig.tokens.find((token) => isWavax(token));
}

export function useAvaxWrap() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<AvaxWrapPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  // Guards against a second submit from a rerender while one is already in
  // flight — the CTA is also disabled during "wrapping", this is belt & braces.
  const inFlight = useRef(false);

  /** Wrap-tx gas cost estimate plus the flat approve-tx reserve, in wei. Never guessed as zero. */
  const estimateGasReserve = useCallback(async (): Promise<bigint> => {
    const token = wavaxToken();
    if (!publicClient || !address || !token) return FALLBACK_WRAP_GAS_RESERVE_WEI + APPROVE_GAS_RESERVE_WEI;
    try {
      const [gasUnits, gasPrice] = await Promise.all([
        publicClient.estimateContractGas({
          address: token.address,
          abi: wavaxAbi,
          functionName: "deposit",
          value: 1n,
          account: address,
        }),
        publicClient.getGasPrice(),
      ]);
      const wrapReserve = ((gasUnits * GAS_ESTIMATE_BUFFER_NUM) / GAS_ESTIMATE_BUFFER_DEN) * gasPrice;
      return wrapReserve + APPROVE_GAS_RESERVE_WEI;
    } catch {
      return FALLBACK_WRAP_GAS_RESERVE_WEI + APPROVE_GAS_RESERVE_WEI;
    }
  }, [publicClient, address]);

  /** Wraps exactly `amount` wei of native AVAX into WAVAX. Never called silently — always a direct user action. */
  const wrap = useCallback(async (amount: bigint): Promise<boolean> => {
    const token = wavaxToken();
    if (inFlight.current || amount <= 0n || !address || !publicClient || !token) return false;
    inFlight.current = true;
    setPhase("wrapping");
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: token.address,
        abi: wavaxAbi,
        functionName: "deposit",
        value: amount,
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 120_000,
        onReplaced: () => {
          // A sped-up/cancelled replacement is still being tracked to its own
          // receipt below — this only affects the message if it ultimately fails.
        },
      });
      if (receipt.status !== "success") {
        setPhase("reverted");
        setError(`The wrap transaction for ${formatEther(amount)} AVAX reverted on-chain.`);
        return false;
      }
      setPhase("wrapped");
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wrap failed";
      if (/user rejected|denied|rejected the request/i.test(message)) {
        setPhase("rejected");
        setError("Wrap rejected in wallet.");
      } else if (/timeout|timed out/i.test(message)) {
        setPhase("timed-out");
        setError("Wrap transaction timed out waiting for confirmation. Check your wallet or the explorer before retrying.");
      } else {
        setPhase("reverted");
        setError(shortReason(message));
      }
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [address, publicClient, writeContractAsync]);

  return {
    phase,
    error,
    wrap,
    estimateGasReserve,
    reset: () => {
      setPhase("idle");
      setError(null);
    },
  };
}

function shortReason(message: string): string {
  const firstLine = message.split("\n")[0];
  return firstLine.length > 140 ? `${firstLine.slice(0, 140)}…` : firstLine;
}
