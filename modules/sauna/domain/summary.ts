import type { Cents } from "../../../platform/money/index.ts";
import { agendaByDay, moneyState, peopleOf, type AgendaBooking, type AgendaTurn } from "./agenda.ts";
import { effectiveStatus, type Instant } from "./booking.ts";
import { addDays, businessDate, type DateText } from "./time.ts";

/** Why a booking shows up in "Para resolver", in the order the list uses. */
export type PendingReason = "refund" | "attendance" | "confirm";

export type PendingItem = { reason: PendingReason; booking: AgendaBooking };

export type DayLoad = { day: DateText; people: number; bookings: number };

export type Summary = {
  /** Today's turns, in order. */
  today: AgendaTurn[];
  /** The first later day with turns, to show when today has none. */
  nextDay: { day: DateText; turns: AgendaTurn[] } | null;
  /** The first of today's turns that has not ended yet. */
  nextTurnKey: string | null;
  peopleToday: number;
  bookingsToday: number;
  /** What is still to collect for today's bookings that are not lost. */
  owedTodayCents: Cents;
  pending: PendingItem[];
  /** Today and the six days after it. */
  week: DayLoad[];
};

/**
 * Bookings that appeared since the last look and still hold their seats, oldest first. The first look has nothing to compare with, so it reports none:
 * otherwise opening the panel would announce every booking already there.
 */
export function newBookings(seen: ReadonlySet<string> | null, bookings: readonly AgendaBooking[], now: Instant): AgendaBooking[] {
  if (!seen) return [];
  return bookings
    .filter(booking => !seen.has(booking.id) && ["held", "pending_transfer", "confirmed"].includes(effectiveStatus(booking, now)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

const reasonOrder: Record<PendingReason, number> = { refund: 0, attendance: 1, confirm: 2 };

/** What someone opening the panel needs first: today's turns, what is waiting for them, and the coming week. */
export function summaryOf(bookings: readonly AgendaBooking[], now: Instant): Summary {
  const today = businessDate(now);
  const days = agendaByDay(bookings, now);
  const turns = days.get(today) ?? [];
  const todayBookings = turns.flatMap(turn => turn.bookings);
  const pending: PendingItem[] = [];
  for (const booking of bookings) {
    const status = effectiveStatus(booking, now);
    if (booking.needsRefund) pending.push({ reason: "refund", booking });
    else if (status === "confirmed" && Date.parse(booking.endsAt) <= Date.parse(now)) pending.push({ reason: "attendance", booking });
    else if (status === "held" || status === "pending_transfer") pending.push({ reason: "confirm", booking });
  }
  pending.sort((a, b) => reasonOrder[a.reason] - reasonOrder[b.reason] || Date.parse(a.booking.startsAt) - Date.parse(b.booking.startsAt));
  return {
    today: turns,
    nextDay: [...days.entries()].map(([day, dayTurns]) => ({ day, turns: dayTurns })).find(({ day }) => day > today) ?? null,
    nextTurnKey: turns.find(turn => Date.parse(turn.endsAt) > Date.parse(now))?.key ?? null,
    peopleToday: peopleOf(turns),
    bookingsToday: todayBookings.length,
    owedTodayCents: todayBookings.filter(booking => effectiveStatus(booking, now) !== "no_show").reduce((sum, booking) => sum + moneyState(booking).owedCents, 0),
    pending,
    week: Array.from({ length: 7 }, (_, index) => {
      const day = addDays(today, index);
      const dayTurns = days.get(day) ?? [];
      return { day, people: peopleOf(dayTurns), bookings: dayTurns.reduce((sum, turn) => sum + turn.bookings.length, 0) };
    }),
  };
}
