"use client";

import { useEffect, useReducer, useState } from "react";
import { formatEther, formatUnits, type Address, type Hex } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useSignTypedData,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { erc20Abi, seltraSettlementAbi } from "@/lib/abi";
import {
  isConfiguredAddress,
  isWavax,
  pairById,
  seltraConfig,
  tokenBySymbol,
  type PairConfig,
  type TokenConfig,
} from "@/config/seltra.config";
import { seltraApi } from "@/lib/api";
import { useMarkets } from "@/lib/market-data";
import {
  buildMakerAmounts,
  buildOrder,
  maxUint256,
  normalizeDecimalInput,
  typedDataForSigning,
  type SignedOrder,
} from "@seltra/sdk";
import { activeChain } from "@/lib/wallet";
import { useWalletDialog } from "@/components/wallet-button";
import { useAvaxWrap } from "@/hooks/use-avax-wrap";

export type OrderSide = "buy" | "sell";

export type OrderFlowState =
  | { tag: "idle" }
  | { tag: "validating" }
  | { tag: "needs-wrap" }
  | { tag: "wrapping" }
  | { tag: "needs-approval" }
  | { tag: "approving"; hash?: Hex }
  | { tag: "ready" }
  | { tag: "awaiting-signature" }
  | { tag: "submitting" }
  | { tag: "resting"; orderHash: Hex }
  | { tag: "rejected"; reason: string };

type FlowAction =
  | { type: "VALIDATE" }
  | { type: "NEEDS_WRAP" }
  | { type: "WRAPPING" }
  | { type: "NEEDS_APPROVAL" }
  | { type: "APPROVING"; hash?: Hex }
  | { type: "READY" }
  | { type: "SIGNING" }
  | { type: "SUBMITTING" }
  | { type: "RESTING"; orderHash: Hex }
  | { type: "REJECTED"; reason: string }
  | { type: "RESET" };

function flowReducer(_state: OrderFlowState, action: FlowAction): OrderFlowState {
  switch (action.type) {
    case "VALIDATE":
      return { tag: "validating" };
    case "NEEDS_WRAP":
      return { tag: "needs-wrap" };
    case "WRAPPING":
      return { tag: "wrapping" };
    case "NEEDS_APPROVAL":
      return { tag: "needs-approval" };
    case "APPROVING":
      return { tag: "approving", hash: action.hash };
    case "READY":
      return { tag: "ready" };
    case "SIGNING":
      return { tag: "awaiting-signature" };
    case "SUBMITTING":
      return { tag: "submitting" };
    case "RESTING":
      return { tag: "resting", orderHash: action.orderHash };
    case "REJECTED":
      return { tag: "rejected", reason: action.reason };
    case "RESET":
      return { tag: "idle" };
  }
}

export interface OrderEntryValues {
  side: OrderSide;
  amount: string;
  price: string;
  expirySeconds: number;
}

export type OrderKind = "limit" | "market";

/** Market orders sign a marketable limit with a short expiry so they never linger. */
const MARKET_EXPIRY_SECONDS = 600;

export interface OrderEntryMachine {
  pair: PairConfig;
  base: TokenConfig;
  quote: TokenConfig;
  makerAsset: TokenConfig;
  takerAsset: TokenConfig;

  kind: OrderKind;
  setKind: (kind: OrderKind) => void;
  slippageBps: number;
  setSlippageBps: (bps: number) => void;
  /** The live executable quote (from the terminal); market pricing anchor. */
  referencePrice?: number;
  /** The price the order will actually sign at: user limit, or quote ± slippage. */
  effectivePrice: string;

  side: OrderSide;
  setSide: (side: OrderSide) => void;
  amount: string;
  setAmount: (amount: string) => void;
  price: string;
  setPrice: (price: string) => void;
  expirySeconds: number;
  setExpirySeconds: (seconds: number) => void;
  setAmountPercent: (percent: bigint) => void;
  setMaxAmount: () => void;
  values: OrderEntryValues;

  makingAmount: bigint;
  takingAmount: bigint;

  balance: bigint | undefined;
  balanceKnown: boolean;
  insufficientBalance: boolean;
  belowMinimumNotional: boolean;
  minimumQuoteAmount: string | null;
  needsApproval: boolean;

  /** True only when makerAsset is WAVAX — the leg native AVAX can fund. */
  nativeAvaxApplicable: boolean;
  useNativeAvax: boolean;
  setUseNativeAvax: (value: boolean) => void;
  nativeBalance: bigint | undefined;
  /** WAVAX still needed beyond the current WAVAX balance; wrapped before signing. */
  wavaxDeficit: bigint;
  wrapError: string | null;

  isConnected: boolean;
  wrongNetwork: boolean;
  fillsPaused: boolean;

  state: OrderFlowState;
  busy: boolean;
  ctaLabel: string;
  ctaDisabled: boolean;
  approvalPending: boolean;
  primaryAction: () => void;
  reset: () => void;
  /** Custom-expiry validity from ExpiryControl; false blocks review/signing. */
  expiryValid: boolean;
  setExpiryValid: (valid: boolean) => void;
  /** Custom-slippage validity (Market tab); false blocks review/signing. */
  slippageValid: boolean;
  setSlippageValid: (valid: boolean) => void;
}

export function useOrderEntryMachine(params: {
  pairId: string;
  initial?: Partial<OrderEntryValues>;
  /** Live executable quote price; enables market (marketable-limit) orders. */
  referencePrice?: number;
}): OrderEntryMachine {
  const pair = pairById(params.pairId);
  const base = tokenBySymbol(pair.base);
  const quote = tokenBySymbol(pair.quote);
  const { address, isConnected, chainId } = useAccount();
  const { data: markets } = useMarkets();
  const [kind, setKind] = useState<OrderKind>("limit");
  const [slippageBps, setSlippageBps] = useState(50);
  const [side, setSide] = useState<OrderSide>(params.initial?.side ?? "sell");
  const [amount, setAmount] = useState(params.initial?.amount ?? "");
  const [price, setPrice] = useState(params.initial?.price ?? "");
  const [expirySeconds, setExpirySeconds] = useState(
    Math.min(params.initial?.expirySeconds ?? 86_400, seltraConfig.maxExpirySeconds),
  );
  const [expiryValid, setExpiryValid] = useState(true);
  const [slippageValid, setSlippageValid] = useState(true);
  const [useNativeAvax, setUseNativeAvaxRaw] = useState(false);
  const [gasReserve, setGasReserve] = useState<bigint | undefined>(undefined);
  const [state, dispatch] = useReducer(flowReducer, { tag: "idle" });
  const { wrap: wrapAvax, estimateGasReserve, error: wrapError, reset: resetWrap } = useAvaxWrap();

  const makerAsset = side === "sell" ? base : quote;
  const takerAsset = side === "sell" ? quote : base;
  const nativeAvaxApplicable = isWavax(makerAsset);

  // Market = marketable limit: quote minus the slippage bound for sells,
  // plus it for buys. The signed order can never fill worse than this.
  const effectivePrice =
    kind === "market"
      ? params.referencePrice !== undefined
        ? (params.referencePrice * (side === "sell" ? 1 - slippageBps / 10_000 : 1 + slippageBps / 10_000)).toFixed(pair.pricePrecision)
        : ""
      : price;
  const orderExpirySeconds = kind === "market" ? MARKET_EXPIRY_SECONDS : expirySeconds;

  const { makingAmount, takingAmount } = buildMakerAmounts(
    side,
    amount,
    effectivePrice,
    base.decimals,
    quote.decimals,
  );
  const marketPolicy = markets?.find((market) => market.pair.toLowerCase() === pair.id.toLowerCase());
  const minimumQuoteNotional = BigInt(marketPolicy?.minOrderNotional ?? "0");
  const quoteNotional = side === "buy" ? makingAmount : takingAmount;
  const belowMinimumNotional =
    quoteNotional > 0n && minimumQuoteNotional > 0n && quoteNotional < minimumQuoteNotional;

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: makerAsset.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: makerAsset.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, seltraConfig.contracts.permit2] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: epoch } = useReadContract({
    address: seltraConfig.contracts.settlement,
    abi: seltraSettlementAbi,
    functionName: "currentEpoch",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && isConfiguredAddress(seltraConfig.contracts.settlement) },
  });
  const { data: fillsPaused } = useReadContract({
    address: seltraConfig.contracts.settlement,
    abi: seltraSettlementAbi,
    functionName: "fillsPaused",
    query: { enabled: isConfiguredAddress(seltraConfig.contracts.settlement), refetchInterval: 15_000 },
  });
  const { data: nativeBalanceData } = useBalance({
    address,
    query: { enabled: Boolean(address) && nativeAvaxApplicable },
  });
  const nativeBalance = nativeBalanceData?.value;
  const { writeContractAsync, data: approveHash } = useWriteContract();
  const { isLoading: approvalPending, isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChain } = useSwitchChain();
  const openWalletDialog = useWalletDialog();

  const balanceKnown = balance !== undefined;
  // Native AVAX only ever covers a deficit above the existing WAVAX balance —
  // it is never wrapped speculatively, and never touches the gas reserve.
  const wavaxDeficit =
    nativeAvaxApplicable && useNativeAvax && balanceKnown && makingAmount > balance
      ? makingAmount - balance
      : 0n;
  const spendableNative = nativeBalance !== undefined && gasReserve !== undefined ? (nativeBalance > gasReserve ? nativeBalance - gasReserve : 0n) : 0n;
  // With native funding on, "available" is existing WAVAX plus whatever
  // native AVAX can still be wrapped without eating into the gas reserve.
  const effectiveAvailable = nativeAvaxApplicable && useNativeAvax && balanceKnown ? balance + spendableNative : balance;

  const hasBalance = balanceKnown && effectiveAvailable !== undefined && effectiveAvailable >= makingAmount;
  const insufficientBalance = balanceKnown && effectiveAvailable !== undefined && effectiveAvailable < makingAmount;
  const hasAllowance = allowance !== undefined && allowance >= makingAmount;
  const needsApproval = isConnected && !hasAllowance;
  const wrongNetwork = isConnected && chainId !== seltraConfig.chainId;
  const canWrite = isConnected && Boolean(address) && !wrongNetwork;

  useEffect(() => {
    if (!nativeAvaxApplicable || !useNativeAvax || !address) {
      setGasReserve(undefined);
      return;
    }
    let cancelled = false;
    void estimateGasReserve().then((reserve) => {
      if (!cancelled) setGasReserve(reserve);
    });
    return () => {
      cancelled = true;
    };
  }, [nativeAvaxApplicable, useNativeAvax, address, estimateGasReserve]);

  // Switching pair/side away from the WAVAX leg turns native funding off —
  // it would otherwise silently keep affecting an asset it no longer applies to.
  useEffect(() => {
    if (!nativeAvaxApplicable && useNativeAvax) setUseNativeAvaxRaw(false);
  }, [nativeAvaxApplicable, useNativeAvax]);

  // Advance past `approving` only once the approval tx is mined and the
  // allowance re-read confirms it, so a click on "Place" can't race a stale allowance.
  useEffect(() => {
    if (!approvalConfirmed || state.tag !== "approving") return;
    void refetchAllowance().then(() => dispatch({ type: "READY" }));
  }, [approvalConfirmed, state.tag, refetchAllowance]);

  // A rejection belongs to the inputs it was raised for; editing them clears it.
  function clearRejection() {
    if (state.tag === "rejected") dispatch({ type: "RESET" });
  }

  function updateSide(next: OrderSide) {
    clearRejection();
    // Amount is denominated in the maker asset (base on Sell, quote on Buy),
    // so carrying it across sides would silently change its token unit.
    if (next !== side) setAmount("");
    setSide(next);
  }

  function updateKind(next: OrderKind) {
    clearRejection();
    setKind(next);
  }

  function updateSlippage(next: number) {
    clearRejection();
    setSlippageBps(next);
  }

  function updateAmount(next: string) {
    clearRejection();
    setAmount(normalizeDecimalInput(next));
  }

  function updatePrice(next: string) {
    clearRejection();
    setPrice(normalizeDecimalInput(next));
  }

  function updateExpiry(next: number) {
    clearRejection();
    // ExpiryControl owns validation (inline error, no silent clamp); this
    // only ever receives values it has already deemed valid.
    setExpirySeconds(next);
  }

  function setAmountPercent(percent: bigint) {
    // Gas safety: MAX-style presets are built from effectiveAvailable, which
    // already has the gas reserve subtracted out of the native AVAX side.
    // Amount is maker-denominated on both sides, so the displayed preset and
    // the eventual Permit2 spend are exactly the same token quantity.
    if (!effectiveAvailable) return;
    updateAmount(formatUnits((effectiveAvailable * percent) / 100n, makerAsset.decimals));
  }

  function setMaxAmount() {
    if (!effectiveAvailable) return;
    updateAmount(formatUnits(effectiveAvailable, makerAsset.decimals));
  }

  function updateUseNativeAvax(next: boolean) {
    clearRejection();
    resetWrap();
    setUseNativeAvaxRaw(next);
  }

  async function approvePermit2() {
    if (!address) return;
    dispatch({ type: "APPROVING" });
    try {
      const hash = await writeContractAsync({
        address: makerAsset.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [seltraConfig.contracts.permit2, maxUint256],
      });
      dispatch({ type: "APPROVING", hash });
    } catch (error) {
      dispatch({ type: "REJECTED", reason: error instanceof Error ? error.message : "Approval rejected" });
    }
  }

  async function performWrap() {
    if (wavaxDeficit <= 0n) {
      dispatch({ type: "READY" });
      return;
    }
    dispatch({ type: "WRAPPING" });
    const reserve = gasReserve ?? (await estimateGasReserve());
    if (nativeBalance === undefined || nativeBalance < wavaxDeficit + reserve) {
      dispatch({
        type: "REJECTED",
        reason: `Not enough AVAX to wrap ${formatEther(wavaxDeficit)} and still cover an estimated ${formatEther(reserve)} AVAX of gas. Reduce the amount or add AVAX.`,
      });
      return;
    }
    const ok = await wrapAvax(wavaxDeficit);
    if (!ok) {
      dispatch({ type: "REJECTED", reason: wrapError ?? "Wrap failed" });
      return;
    }
    // Trust only a fresh WAVAX balance/allowance read before moving on — a
    // click on "Place" right after can't race a stale allowance either way.
    const [, allowanceResult] = await Promise.all([refetchBalance(), refetchAllowance()]);
    if (allowanceResult.data !== undefined && allowanceResult.data >= makingAmount) dispatch({ type: "READY" });
    else dispatch({ type: "NEEDS_APPROVAL" });
  }

  async function placeOrder() {
    dispatch({ type: "VALIDATE" });
    if (!canWrite || !address) return;
    if (fillsPaused) {
      dispatch({ type: "REJECTED", reason: "Fills are paused by the guardian. You can still cancel orders." });
      return;
    }
    if (kind === "market" && params.referencePrice === undefined) {
      dispatch({ type: "REJECTED", reason: "No executable quote available for a market order right now" });
      return;
    }
    if (kind === "market" && (slippageBps <= 0 || slippageBps >= 10_000)) {
      dispatch({ type: "REJECTED", reason: "Slippage must be above 0% and below 100%" });
      return;
    }
    if (makingAmount <= 0n || takingAmount <= 0n) {
      dispatch({ type: "REJECTED", reason: "Amount and limit price must be above zero" });
      return;
    }
    if (belowMinimumNotional) {
      dispatch({
        type: "REJECTED",
        reason: `Order must be at least ${marketPolicy?.minOrderNotionalFormatted ?? "the configured minimum"} ${quote.symbol}`,
      });
      return;
    }
    if (orderExpirySeconds <= 0 || orderExpirySeconds > seltraConfig.maxExpirySeconds) {
      dispatch({ type: "REJECTED", reason: `Expiry must be above zero and at most ${Math.round(seltraConfig.maxExpirySeconds / 86_400)} days` });
      return;
    }
    if (!balanceKnown) {
      dispatch({ type: "REJECTED", reason: `${makerAsset.symbol} balance unavailable. Check your RPC connection and try again` });
      return;
    }
    if (!hasBalance) {
      dispatch({ type: "REJECTED", reason: `Insufficient ${makerAsset.symbol} balance` });
      return;
    }
    if (wavaxDeficit > 0n) {
      dispatch({ type: "NEEDS_WRAP" });
      return;
    }
    if (!hasAllowance) {
      dispatch({ type: "NEEDS_APPROVAL" });
      return;
    }
    if (!isConfiguredAddress(seltraConfig.contracts.settlement)) {
      dispatch({ type: "REJECTED", reason: "Settlement address is not configured" });
      return;
    }
    try {
      const { order, permit } = buildOrder({
        maker: address as Address,
        makerAsset: makerAsset.address,
        takerAsset: takerAsset.address,
        makingAmount,
        takingAmount,
        epoch: epoch ?? 0n,
        expirySeconds: orderExpirySeconds,
      });
      const typedData = typedDataForSigning({
        chainId: seltraConfig.chainId,
        permit2: seltraConfig.contracts.permit2,
        settlement: seltraConfig.contracts.settlement,
        order,
        permit,
      });
      dispatch({ type: "SIGNING" });
      const signature = await signTypedDataAsync(typedData);
      const signed: SignedOrder = { order, permit, signature };
      dispatch({ type: "SUBMITTING" });
      const result = await seltraApi.submitOrder(signed);
      dispatch({ type: "RESTING", orderHash: result.orderHash });
      setAmount("");
    } catch (error) {
      dispatch({ type: "REJECTED", reason: error instanceof Error ? error.message : "Order rejected" });
    }
  }

  function primaryAction() {
    if (!isConnected) {
      openWalletDialog();
      return;
    }
    if (wrongNetwork) {
      switchChain({ chainId: activeChain.id });
      return;
    }
    if (state.tag === "needs-wrap") {
      void performWrap();
      return;
    }
    if (state.tag === "needs-approval") {
      void approvePermit2();
      return;
    }
    void placeOrder();
  }

  const busy =
    state.tag === "validating" ||
    state.tag === "wrapping" ||
    state.tag === "approving" ||
    state.tag === "awaiting-signature" ||
    state.tag === "submitting" ||
    approvalPending;

  const ctaLabel = !isConnected
    ? "Connect wallet"
    : wrongNetwork
      ? "Switch to Avalanche"
      : fillsPaused
        ? "Fills are paused"
        : state.tag === "validating"
        ? "Checking order"
        : state.tag === "wrapping"
          ? "Wrapping AVAX…"
          : state.tag === "needs-wrap"
            ? "Wrap AVAX"
            : state.tag === "approving" || approvalPending
              ? `Approving ${makerAsset.symbol}`
              : state.tag === "needs-approval"
                ? `Approve ${makerAsset.symbol}`
                : state.tag === "awaiting-signature"
                  ? "Awaiting signature"
                  : state.tag === "submitting"
                    ? "Submitting order"
                    : `Place ${side} order`;

  const ctaDisabled =
    state.tag === "wrapping" ||
    state.tag === "awaiting-signature" ||
    state.tag === "submitting" ||
    approvalPending ||
    // Paused fills block placement (with the reason as the CTA label); connect
    // and network-switch actions stay available, and cancels are never gated.
    Boolean(fillsPaused && isConnected && !wrongNetwork) ||
    // A limit order's own invalid custom expiry blocks review/signing; market
    // orders use a fixed expiry so this never applies to them.
    (kind === "limit" && !expiryValid) ||
    // Symmetric for Market's custom slippage input.
    (kind === "market" && !slippageValid);

  return {
    pair,
    base,
    quote,
    makerAsset,
    takerAsset,
    kind,
    setKind: updateKind,
    slippageBps,
    setSlippageBps: updateSlippage,
    referencePrice: params.referencePrice,
    effectivePrice,
    side,
    setSide: updateSide,
    amount,
    setAmount: updateAmount,
    price,
    setPrice: updatePrice,
    expirySeconds,
    setExpirySeconds: updateExpiry,
    setAmountPercent,
    setMaxAmount,
    values: { side, amount, price, expirySeconds },
    makingAmount,
    takingAmount,
    balance,
    balanceKnown,
    insufficientBalance,
    belowMinimumNotional,
    minimumQuoteAmount: marketPolicy?.minOrderNotionalFormatted ?? null,
    needsApproval,
    nativeAvaxApplicable,
    useNativeAvax,
    setUseNativeAvax: updateUseNativeAvax,
    nativeBalance,
    wavaxDeficit,
    wrapError,
    isConnected,
    wrongNetwork,
    fillsPaused: Boolean(fillsPaused),
    state,
    busy,
    ctaLabel,
    ctaDisabled,
    approvalPending,
    primaryAction,
    reset: () => dispatch({ type: "RESET" }),
    expiryValid,
    setExpiryValid,
    slippageValid,
    setSlippageValid,
  };
}
