import type { Cents } from "../../../platform/money/index.ts";
import type { TimeBand } from "./hours.ts";
import type { ClosureEntry } from "./setup.ts";
import { effectiveStatus, isCurrent, type BookingKind, type BookingStatus, type Instant } from "./booking.ts";
import { ledgerOf, type Movement } from "./payments.ts";
import { addDays, businessDate, businessDayStart, monthGrid, startOfWeek, type DateText } from "./time.ts";

/** A turn as public.sauna_availability describes it: one start of one type. */
export type Turn = {
  roomId: string;
  turnTypeId: string;
  typeName: string;
  startsAt: Instant;
  endsAt: Instant;
  capacity: number;
  /** Seats left at the fullest moment of this turn, counting the turns it overlaps. */
  freeSeats: number;
  priceCents: Cents | null;
  privatePriceCents: Cents | null;
  depositPercent: number;
  closed: boolean;
  bookable: boolean;
};

/** A booking as the panel sees it. The name and number are empty once the person was anonymized. */
export type AgendaBooking = {
  id: string;
  token: string;
  status: BookingStatus;
  kind: BookingKind;
  seats: number;
  priceCents: Cents;
  discountCents: Cents;
  depositCents: Cents;
  expiresAt: Instant | null;
  needsRefund: boolean;
  createdAt: Instant;
  customerName: string;
  customerWhatsapp: string | null;
  roomId: string;
  typeName: string;
  startsAt: Instant;
  endsAt: Instant;
  movements: Movement[];
};

export const statusLabels: Record<BookingStatus, string> = {
  held: "Retenida",
  pending_transfer: "Espera transferencia",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  expired: "Vencida",
  completed: "Asistió",
  no_show: "No vino",
};

export type MoneyState = {
  totalCents: Cents;
  paidCents: Cents;
  /** What is still to collect from the person. */
  owedCents: Cents;
  /** The part of the deposit not paid yet. */
  depositDueCents: Cents;
};

export function moneyState(booking: Pick<AgendaBooking, "priceCents" | "discountCents" | "depositCents" | "movements">): MoneyState {
  const totalCents = booking.priceCents - booking.discountCents;
  const paidCents = ledgerOf(booking.movements).netCents;
  return { totalCents, paidCents, owedCents: Math.max(totalCents - paidCents, 0), depositDueCents: Math.max(booking.depositCents - paidCents, 0) };
}

/**
 * What can be done with a booking. The SQL function behind each action checks the same again.
 * - confirm: a current hold, by hand and without money. A pending transfer is confirmed by recording it instead.
 * - transfer: the stored status says it waits for a transfer, lapsed or not. A transfer that shows up late follows the late payment rule (docs/SAUNA.md §3).
 */
export function bookingActions(booking: Pick<AgendaBooking, "status" | "expiresAt" | "startsAt">, now: Instant) {
  const status = effectiveStatus(booking, now);
  const started = Date.parse(booking.startsAt) <= Date.parse(now);
  return {
    confirm: status === "held",
    transfer: booking.status === "pending_transfer",
    attendance: status === "confirmed" && started,
    cancel: status === "held" || status === "pending_transfer" || status === "confirmed",
  };
}

export type AgendaView = "day" | "week" | "month";

export function agendaRange(view: AgendaView, date: DateText): { from: DateText; to: DateText } {
  if (view === "day") return { from: date, to: date };
  if (view === "week") return { from: startOfWeek(date), to: addDays(startOfWeek(date), 6) };
  const grid = monthGrid(date);
  return { from: grid[0], to: grid[grid.length - 1] };
}

/** The same place one page before or after. A month keeps its day, or the last one the shorter month has. */
export function moveAgenda(view: AgendaView, date: DateText, direction: 1 | -1): DateText {
  if (view === "day") return addDays(date, direction);
  if (view === "week") return addDays(date, 7 * direction);
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + direction, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The bookings of one start and type. The agenda shows what is booked and not every possible start: with overlapping types, that would be a very long list of empty rows. */
export type AgendaTurn = { key: string; roomId: string; typeName: string; startsAt: Instant; endsAt: Instant; bookings: AgendaBooking[] };

/** Current bookings by day of Buenos Aires and by turn, in order. */
export function agendaByDay(bookings: readonly AgendaBooking[], now: Instant): Map<DateText, AgendaTurn[]> {
  const all = new Map<string, AgendaTurn>();
  for (const booking of bookings) {
    if (!isCurrent(booking, now)) continue;
    const key = `${booking.roomId}|${Date.parse(booking.startsAt)}|${booking.typeName}`;
    const entry = all.get(key) ?? { key, roomId: booking.roomId, typeName: booking.typeName, startsAt: booking.startsAt, endsAt: booking.endsAt, bookings: [] };
    entry.bookings.push(booking);
    all.set(key, entry);
  }
  const days = new Map<DateText, AgendaTurn[]>();
  for (const entry of [...all.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
    const day = businessDate(entry.startsAt);
    days.set(day, [...(days.get(day) ?? []), entry]);
  }
  return days;
}

/** Whether a closure touches a day, even partly. */
export function isDayClosed(day: DateText, closures: readonly { startsAt: Instant; endsAt: Instant }[]): boolean {
  const start = Date.parse(businessDayStart(day));
  const end = Date.parse(businessDayStart(addDays(day, 1)));
  return closures.some(closure => Date.parse(closure.startsAt) < end && Date.parse(closure.endsAt) > start);
}

/** Seats booked across the turns of a day. */
export const peopleOf = (turns: readonly AgendaTurn[]) => turns.reduce((total, { bookings }) => total + bookings.reduce((sum, booking) => sum + booking.seats, 0), 0);

/** Rows run from the earliest opening to the latest closing, using the configured interval. */
export function agendaRows(bands: readonly TimeBand[], stepMinutes: number): string[] {
  if (!bands.length || stepMinutes <= 0) return [];
  const minute = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  const first = Math.min(...bands.map(band => minute(band.from)));
  const last = Math.max(...bands.map(band => minute(band.to)));
  const rows = new Set<number>();
  for (let value = first; value < last; value += stepMinutes) rows.add(value);
  return [...rows].sort((a, b) => a - b).map(value => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`);
}

export const cellInstant = (day: DateText, clock: string): Instant => new Date(Date.parse(businessDayStart(day)) + (Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3))) * 60_000).toISOString();

export function closuresOfRange(startsAt: Instant, endsAt: Instant, closures: readonly ClosureEntry[]): ClosureEntry[] {
  return closures.filter(closure => Date.parse(closure.startsAt) < Date.parse(endsAt) && Date.parse(closure.endsAt) > Date.parse(startsAt));
}

export function dayClosureState(day: DateText, closures: readonly ClosureEntry[]): "full" | "partial" | null {
  const start = Date.parse(businessDayStart(day));
  const end = Date.parse(businessDayStart(addDays(day, 1)));
  const ranges = closuresOfRange(new Date(start).toISOString(), new Date(end).toISOString(), closures).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  if (!ranges.length) return null;
  let covered = start;
  for (const range of ranges) {
    if (Date.parse(range.startsAt) > covered) break;
    covered = Math.max(covered, Date.parse(range.endsAt));
  }
  return covered >= end ? "full" : "partial";
}
