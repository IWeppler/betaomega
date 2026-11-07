import type { Cents } from "../../../platform/money/index.ts";

/** An ISO 8601 date and time. Plain strings, because a booking has to cross from the server to the browser. */
export type Instant = string;

export const bookingStatuses = ["held", "pending_transfer", "confirmed", "cancelled", "expired", "completed", "no_show"] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

export const bookingKinds = ["shared", "private"] as const;
export type BookingKind = (typeof bookingKinds)[number];

export type Booking = {
  id: string;
  slotId: string;
  customerId: string;
  kind: BookingKind;
  status: BookingStatus;
  seats: number;
  priceCents: Cents;
  discountCents: Cents;
  depositCents: Cents;
  codeId: string | null;
  packPurchaseId: string | null;
  packSessionReturned: boolean;
  /** Until when a held or pending_transfer booking keeps its seats. */
  expiresAt: Instant | null;
  /** The money arrived but there is nothing to apply it to: the panel shows it so someone returns it. */
  needsRefund: boolean;
};

const allowed: Record<BookingStatus, readonly BookingStatus[]> = {
  held: ["pending_transfer", "confirmed", "expired", "cancelled"],
  pending_transfer: ["confirmed", "expired", "cancelled"],
  confirmed: ["cancelled", "completed", "no_show"],
  expired: ["confirmed"], // only a late payment, when the seat is still free
  cancelled: [],
  completed: [],
  no_show: [],
};

export class InvalidTransitionError extends Error {
  readonly from: string;
  readonly to: string;
  constructor(from: string, to: string) {
    super(`No se puede pasar de ${from} a ${to}.`);
    this.from = from;
    this.to = to;
  }
}

export const canTransition = (from: BookingStatus, to: BookingStatus) => allowed[from].includes(to);

/** The only way to change a booking's status. The SQL functions check the same table on their own (docs/PATTERNS.md, pattern 17). */
export function transition<T extends { status: BookingStatus }>(booking: T, to: BookingStatus): T {
  if (!canTransition(booking.status, to)) throw new InvalidTransitionError(booking.status, to);
  return { ...booking, status: to };
}

type Hold = { status: BookingStatus; expiresAt: Instant | null };

const isPastHold = ({ status, expiresAt }: Hold, now: Instant) =>
  (status === "held" || status === "pending_transfer") && (expiresAt === null || Date.parse(expiresAt) <= Date.parse(now));

/** No scheduled task flips a lapsed hold, so its stored status can still say "held". Anything that reads a status for a decision or a screen uses this. */
export const effectiveStatus = (booking: Hold, now: Instant): BookingStatus => (isPastHold(booking, now) ? "expired" : booking.status);

/** Whether a booking still takes up its seats and its use of a code. A lapsed, expired or cancelled one gives them back just by no longer counting. */
export function isCurrent(booking: Hold, now: Instant): boolean {
  const status = effectiveStatus(booking, now);
  return status === "held" || status === "pending_transfer" || status === "confirmed" || status === "completed" || status === "no_show";
}
