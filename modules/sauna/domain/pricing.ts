import { isCents, percentOf, type Cents } from "../../../platform/money/index.ts";
import type { BookingKind } from "./booking.ts";

export const codeTypes = ["percent", "fixed", "no_deposit", "free"] as const;
export type CodeType = (typeof codeTypes)[number];

/** `value` is a percentage for "percent", cents for "fixed" and unused for the other two. */
export type CodeEffect = { type: CodeType; value: number };

/** What a turn charges. A price is null when the turn does not offer that kind of booking. */
export type SlotPrices = { priceCents: Cents | null; privatePriceCents: Cents | null; depositPercent: number };

export type Quote = {
  /** Before the discount. */
  priceCents: Cents;
  discountCents: Cents;
  /** Price minus discount: what the booking costs in the end. */
  totalCents: Cents;
  /** What is charged to hold the booking. */
  depositCents: Cents;
  /** What is left to pay at the sauna. */
  balanceCents: Cents;
  /** Nothing to charge, so the booking is confirmed at once. */
  confirmsAtOnce: boolean;
};

export class PricingError extends Error {}

export function priceFor(slot: SlotPrices, kind: BookingKind, seats: number): Cents {
  const price = kind === "private" ? slot.privatePriceCents : slot.priceCents;
  if (price === null) throw new PricingError(`El turno no ofrece reservas de tipo ${kind}.`);
  if (kind === "private") return price;
  if (!Number.isInteger(seats) || seats < 1) throw new PricingError(`Cantidad de lugares inválida: ${seats}`);
  return price * seats;
}

export function discountFor(code: CodeEffect | null, priceCents: Cents): Cents {
  switch (code?.type) {
    case "percent": return percentOf(priceCents, code.value);
    case "fixed":
      if (!isCents(code.value)) throw new PricingError(`Monto de descuento inválido: ${code.value}`);
      return Math.min(code.value, priceCents); // never below zero
    case "free": return priceCents;
    default: return 0; // "no_deposit" does not lower the price: the whole total stays to pay at the sauna
  }
}

/** The discount comes first and the deposit is taken from the discounted price (docs/SAUNA.md §4). Runs on the server only. */
export function quote(slot: SlotPrices, kind: BookingKind, seats: number, code: CodeEffect | null): Quote {
  const priceCents = priceFor(slot, kind, seats);
  const discountCents = discountFor(code, priceCents);
  const totalCents = priceCents - discountCents;
  const depositCents = code?.type === "no_deposit" ? 0 : percentOf(totalCents, slot.depositPercent);
  return { priceCents, discountCents, totalCents, depositCents, balanceCents: totalCents - depositCents, confirmsAtOnce: depositCents === 0 };
}
