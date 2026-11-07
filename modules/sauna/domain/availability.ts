import { isCurrent, type BookingKind, type BookingStatus, type Instant } from "./booking.ts";
import type { SeatRejection, WindowRejection } from "./rejections.ts";

export const slotModes = ["shared", "private", "either"] as const;
export type SlotMode = (typeof slotModes)[number];

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type BookingWindow = { minLeadMinutes: number; maxAdvanceDays: number };

/** Null when the turn can still be booked at `now`. */
export function checkWindow(startsAt: Instant, now: Instant, { minLeadMinutes, maxAdvanceDays }: BookingWindow): WindowRejection | null {
  const start = Date.parse(startsAt);
  const current = Date.parse(now);
  if (start < current + minLeadMinutes * MINUTE) return "too_soon";
  if (start > current + maxAdvanceDays * DAY) return "too_far";
  return null;
}

/** A closure with no room applies to every room. */
export type Closure = { roomId: string | null; startsAt: Instant; endsAt: Instant };

/** A closure blocks new bookings of every turn it touches, even partly. Touching at the very edge does not count. */
export function isClosed(turn: { roomId: string; startsAt: Instant; endsAt: Instant }, closures: readonly Closure[]): boolean {
  const start = Date.parse(turn.startsAt);
  const end = Date.parse(turn.endsAt);
  return closures.some(closure => (closure.roomId === null || closure.roomId === turn.roomId) && Date.parse(closure.startsAt) < end && Date.parse(closure.endsAt) > start);
}

type HeldTurn = { status: BookingStatus; expiresAt: Instant | null; startsAt: Instant; endsAt: Instant };

/**
 * The seats a new booking has to fit next to. The room is too small to put strangers together, so one booking of any kind fills it: whatever overlaps,
 * even by a minute and even for one person, counts as every seat. Same rule as public.sauna_peak_seats.
 */
export function seatsTaken(bookings: readonly HeldTurn[], from: Instant, to: Instant, now: Instant, capacity: number): number {
  const start = Date.parse(from);
  const end = Date.parse(to);
  return bookings.some(booking => isCurrent(booking, now) && Date.parse(booking.startsAt) < end && Date.parse(booking.endsAt) > start) ? capacity : 0;
}

/** A private booking takes every seat, which is what keeps shared bookings out of the same turn. */
export const seatsNeeded = (kind: BookingKind, seats: number, capacity: number) => (kind === "private" ? capacity : seats);

/** Null when the booking fits. `taken` must come from seatsTaken, read under the room's lock. */
export function checkSeats(turn: { mode: SlotMode; capacity: number }, kind: BookingKind, seats: number, taken: number): SeatRejection | null {
  if (turn.mode !== "either" && turn.mode !== kind) return "kind_not_offered";
  if (kind === "private") return taken > 0 ? "not_empty" : null;
  if (!Number.isInteger(seats) || seats < 1) return "invalid_seats";
  return taken + seats > turn.capacity ? "full" : null;
}

/** A hold never outlives the start of its turn. */
export function holdUntil(now: Instant, startsAt: Instant, holdMinutes: number): Instant {
  return new Date(Math.min(Date.parse(now) + holdMinutes * MINUTE, Date.parse(startsAt))).toISOString();
}
