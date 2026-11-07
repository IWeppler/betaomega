import type { Cents } from "../../../platform/money/index.ts";
import { InvalidTransitionError, type BookingKind, type BookingStatus, type Instant } from "./booking.ts";
import type { PackRejection } from "./rejections.ts";
import { businessWeek } from "./time.ts";

export const packStatuses = ["held", "pending_transfer", "active", "expired", "cancelled"] as const;
export type PackStatus = (typeof packStatuses)[number];

export type PackPurchase = {
  id: string;
  customerId: string;
  status: PackStatus;
  sessions: number;
  priceCents: Cents;
  validDays: number;
  /** Set when the payment is confirmed. */
  validUntil: Instant | null;
  maxPerWeek: number;
};

const allowed: Record<PackStatus, readonly PackStatus[]> = {
  held: ["pending_transfer", "active", "expired", "cancelled"],
  pending_transfer: ["active", "expired", "cancelled"],
  active: ["cancelled"],
  expired: ["active"], // a late payment activates the pack: it does not depend on a seat
  cancelled: [],
};

export const canTransitionPack = (from: PackStatus, to: PackStatus) => allowed[from].includes(to);

export function transitionPack<T extends { status: PackStatus }>(purchase: T, to: PackStatus): T {
  if (!canTransitionPack(purchase.status, to)) throw new InvalidTransitionError(purchase.status, to);
  return { ...purchase, status: to };
}

const DAY = 86_400_000;

/** Validity runs from the confirmation of the payment, counted in exact 24-hour days. */
export const packValidUntil = (confirmedAt: Instant, validDays: number): Instant => new Date(Date.parse(confirmedAt) + validDays * DAY).toISOString();

/** A booking made with a pack: its status, its turn and whether the person attending gave the session back when cancelling. */
export type PackSession = { status: BookingStatus; startsAt: Instant; sessionReturned: boolean };

/** A session is spent unless it was explicitly given back: a no-show spends it, and so does a cancellation that kept it. */
export function sessionsLeft(sessions: number, used: readonly PackSession[]): number {
  return sessions - used.filter(session => !session.sessionReturned).length;
}

/** Turns of the Monday-to-Sunday week of `startsAt`, by the date of the turn and not of the day it was booked. A cancelled turn leaves the week free again. */
export function sessionsInWeek(used: readonly PackSession[], startsAt: Instant): number {
  const week = businessWeek(startsAt);
  return used.filter(session => session.status !== "cancelled" && session.status !== "expired" && businessWeek(session.startsAt) === week).length;
}

type SessionRequest = { kind: BookingKind; seats: number; startsAt: Instant; hasCode: boolean };

/** Null when this pack can book the turn. `used` is read under the purchase's lock, so two bookings cannot both take the last session. */
export function checkPackSession(purchase: Pick<PackPurchase, "status" | "sessions" | "validUntil" | "maxPerWeek">, request: SessionRequest, used: readonly PackSession[]): PackRejection | null {
  if (purchase.status !== "active" || purchase.validUntil === null) return "pack_not_active";
  if (request.hasCode) return "pack_with_code";
  if (request.kind !== "shared" || request.seats !== 1) return "pack_shared_only";
  if (Date.parse(request.startsAt) >= Date.parse(purchase.validUntil)) return "pack_expired";
  if (sessionsLeft(purchase.sessions, used) <= 0) return "pack_no_sessions";
  if (sessionsInWeek(used, request.startsAt) >= purchase.maxPerWeek) return "pack_week_limit";
  return null;
}
