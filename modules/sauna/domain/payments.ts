import type { Cents } from "../../../platform/money/index.ts";
import { effectiveStatus, type BookingStatus, type Instant } from "./booking.ts";
import type { PaymentOutcome } from "./rejections.ts";

export const paymentMethods = ["mercadopago", "transfer", "cash"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentKinds = ["deposit", "balance", "pack", "refund"] as const;
export type PaymentKind = (typeof paymentKinds)[number];

/** One row of the ledger (docs/PATTERNS.md, pattern 15). `amountCents` is always positive: `kind` says which way the money went. */
export type Movement = { kind: PaymentKind; amountCents: Cents };

export type Ledger = { chargedCents: Cents; depositPaidCents: Cents; refundedCents: Cents; netCents: Cents };

/** A balance is always computed from its movements. Nothing stores it, so nothing can drift from the history. */
export function ledgerOf(movements: readonly Movement[]): Ledger {
  const total = (match: (kind: PaymentKind) => boolean) => movements.reduce((sum, { kind, amountCents }) => (match(kind) ? sum + amountCents : sum), 0);
  const chargedCents = total(kind => kind !== "refund");
  const refundedCents = total(kind => kind === "refund");
  return { chargedCents, depositPaidCents: total(kind => kind === "deposit"), refundedCents, netCents: chargedCents - refundedCents };
}

export type IncomingPayment = {
  status: BookingStatus;
  expiresAt: Instant | null;
  depositCents: Cents;
  amountCents: Cents;
  startsAt: Instant;
  /** Read under the turn's lock. */
  seatsFree: number;
  seats: number;
  closed: boolean;
  now: Instant;
};

/**
 * What a new payment does to its booking. The money is always recorded first: whatever the outcome, it did arrive.
 * - confirmed / late_confirmed: the booking ends up confirmed.
 * - no_seat, amount_mismatch, unapplied: the booking does not change and needsRefund flags the money for the panel.
 * A hold that lapsed counts as expired even if no one changed its stored status. public.sauna_confirm_payment repeats this order.
 */
export function settlePayment(payment: IncomingPayment): Exclude<PaymentOutcome, "duplicate"> {
  const { status, depositCents, amountCents, startsAt, seatsFree, seats, closed, now } = payment;
  if (status !== "held" && status !== "pending_transfer" && status !== "expired") return "unapplied";
  if (amountCents !== depositCents) return "amount_mismatch";
  if (effectiveStatus(payment, now) !== "expired") return "confirmed";
  const turnAhead = Date.parse(startsAt) > Date.parse(now);
  return turnAhead && !closed && seats <= seatsFree ? "late_confirmed" : "no_seat";
}

export const leavesBookingConfirmed = (outcome: PaymentOutcome) => outcome === "confirmed" || outcome === "late_confirmed";
