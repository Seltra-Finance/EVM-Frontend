import { encodeAbiParameters, keccak256, parseUnits, zeroAddress, type Address, type Hex } from "viem";
import { ORDER_TYPEHASH } from "./constants";
import type { Order, OrderSide, Permit2Data } from "./types";
import { generateNonce, randomSalt } from "./nonce";

export function hashOrder(order: Order): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "address" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint40" },
        { type: "address" },
        { type: "uint8" },
      ],
      [
        ORDER_TYPEHASH,
        order.maker,
        order.receiver,
        order.makerAsset,
        order.takerAsset,
        order.makingAmount,
        order.takingAmount,
        order.salt,
        order.epoch,
        Number(order.expiry),
        order.allowedSender,
        order.flags,
      ],
    ),
  );
}

export function buildOrder(params: {
  maker: Address;
  receiver?: Address;
  makerAsset: Address;
  takerAsset: Address;
  makingAmount: bigint;
  takingAmount: bigint;
  epoch: bigint;
  expirySeconds: number;
  /** Absolute expiry (unix seconds); overrides expirySeconds so batch children share one expiry. */
  expiryAt?: bigint;
  allowedSender?: Address;
}): { order: Order; permit: Permit2Data } {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const expiry = params.expiryAt ?? now + BigInt(params.expirySeconds);
  const order: Order = {
    maker: params.maker,
    receiver: params.receiver ?? params.maker,
    makerAsset: params.makerAsset,
    takerAsset: params.takerAsset,
    makingAmount: params.makingAmount,
    takingAmount: params.takingAmount,
    salt: randomSalt(),
    epoch: params.epoch,
    expiry,
    allowedSender: params.allowedSender ?? zeroAddress,
    flags: 0,
  };
  const permit: Permit2Data = {
    permitted: { token: order.makerAsset, amount: order.makingAmount },
    nonce: generateNonce(),
    deadline: order.expiry,
  };
  return { order, permit };
}

export function buildAmounts(
  side: OrderSide,
  amount: string,
  price: string,
  baseDecimals: number,
  quoteDecimals: number,
): { makingAmount: bigint; takingAmount: bigint } {
  const normalizedAmount = normalizeDecimalInput(amount);
  const normalizedPrice = normalizeDecimalInput(price);
  const cleanAmount = normalizedAmount && Number(normalizedAmount) > 0 ? normalizedAmount : "0";
  const cleanPrice = normalizedPrice && Number(normalizedPrice) > 0 ? normalizedPrice : "0";
  if (side === "sell") {
    return {
      makingAmount: parseUnits(cleanAmount, baseDecimals),
      takingAmount: parseUnits((Number(cleanAmount) * Number(cleanPrice)).toFixed(quoteDecimals), quoteDecimals),
    };
  }
  return {
    makingAmount: parseUnits((Number(cleanAmount) * Number(cleanPrice)).toFixed(quoteDecimals), quoteDecimals),
    takingAmount: parseUnits(cleanAmount, baseDecimals),
  };
}

/**
 * Build an order from the maker-asset spend shown in the order form: base
 * token for a sell, quote token for a buy. Kept separate from `buildAmounts`
 * so existing SDK consumers whose `amount` is always base-denominated do not
 * silently change behavior.
 */
export function buildMakerAmounts(
  side: OrderSide,
  amount: string,
  price: string,
  baseDecimals: number,
  quoteDecimals: number,
): { makingAmount: bigint; takingAmount: bigint } {
  // `amount` is always the maker's spend budget: base token for a sell and
  // quote token for a buy. This mirrors the order form's token label, balance,
  // MAX button, and Permit2 approval amount.
  const amountUnits = parsePositiveUnits(amount, side === "sell" ? baseDecimals : quoteDecimals);
  const priceUnits = parsePositiveUnits(price, quoteDecimals);
  if (amountUnits === undefined || priceUnits === undefined) {
    return { makingAmount: 0n, takingAmount: 0n };
  }

  const baseUnit = 10n ** BigInt(baseDecimals);
  if (side === "sell") {
    return {
      makingAmount: amountUnits,
      // Round the minimum quote receipt up so the encoded order never accepts
      // an effective price below the displayed sell limit.
      takingAmount: ceilDiv(amountUnits * priceUnits, baseUnit),
    };
  }
  return {
    makingAmount: amountUnits,
    // Round the minimum base receipt up so the encoded order never pays an
    // effective price above the displayed buy limit.
    takingAmount: ceilDiv(amountUnits * baseUnit, priceUnits),
  };
}

/** Accept either decimal separator while rejecting ambiguous mixed input. */
export function normalizeDecimalInput(value: string): string {
  const trimmed = value.trim();
  const commaCount = trimmed.split(",").length - 1;
  if (!trimmed.includes(".") && commaCount === 1) return trimmed.replace(",", ".");
  return trimmed;
}

function parsePositiveUnits(value: string, decimals: number): bigint | undefined {
  const normalized = normalizeDecimalInput(value);
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return undefined;
  try {
    const parsed = parseUnits(normalized.startsWith(".") ? `0${normalized}` : normalized, decimals);
    return parsed > 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}
