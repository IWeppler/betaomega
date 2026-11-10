import { moneyState, type AgendaBooking } from "./agenda.ts";
import { effectiveStatus, type BookingStatus, type Instant } from "./booking.ts";

// The panel's list of bookings (Reservas). A plan is one purchase of several turns, so it is one row that opens to its turns, not a row per turn:
// the agenda and the summary already show turns by time; this list answers "who booked what".

export type BookingGroup = {
  /** The plan's purchase, or the booking's own id for a single booking. */
  key: string;
  plan: { name: string; turns: number } | null;
  /** A plan's turns, earliest first. */
  bookings: AgendaBooking[];
  /** When it was booked: a plan's turns are booked together. */
  createdAt: Instant;
};

/** Newest booked first, as the search returns them; a plan where its newest turn was. */
export function groupBookings(bookings: readonly AgendaBooking[]): BookingGroup[] {
  const groups = new Map<string, BookingGroup>();
  for (const booking of bookings) {
    const key = booking.planPurchaseId ?? booking.id;
    const group = groups.get(key);
    if (group) {
      group.bookings.push(booking);
      if (booking.createdAt > group.createdAt) group.createdAt = booking.createdAt;
      continue;
    }
    groups.set(key, {
      key,
      plan: booking.planPurchaseId ? { name: booking.planName ?? "Plan", turns: booking.planTurns ?? 0 } : null,
      bookings: [booking],
      createdAt: booking.createdAt,
    });
  }
  const list = [...groups.values()];
  for (const group of list) group.bookings.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export const BOOKINGS_PAGE_SIZE = 20;

/** One page of a list. A page past the end shows the last one, so a list that shrank while someone was on its last page does not go blank. */
export function pageOf<T>(items: readonly T[], page: number, size = BOOKINGS_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}

/** The order states are listed in, the ones that need someone first. */
const statusOrder: BookingStatus[] = ["pending_transfer", "held", "confirmed", "completed", "no_show", "expired", "cancelled"];

/** How many turns of a group are in each state, as they are now (a lapsed hold counts as expired). */
export function statusCounts(bookings: readonly AgendaBooking[], now: Instant): { status: BookingStatus; count: number }[] {
  const counts = new Map<BookingStatus, number>();
  for (const booking of bookings) {
    const status = effectiveStatus(booking, now);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return statusOrder.filter(status => counts.has(status)).map(status => ({ status, count: counts.get(status) ?? 0 }));
}

/** The states where money is still expected. A cancelled, lapsed or missed turn owes nothing, whatever its price. */
const collecting = new Set<BookingStatus>(["held", "pending_transfer", "confirmed", "completed"]);

/** What a row still expects to collect, over its turns that are still on, and whether any payment of it has to be returned. */
export function groupMoney(bookings: readonly AgendaBooking[], now: Instant) {
  let depositDueCents = 0;
  let owedCents = 0;
  for (const booking of bookings) {
    if (!collecting.has(effectiveStatus(booking, now))) continue;
    const money = moneyState(booking);
    depositDueCents += money.depositDueCents;
    owedCents += money.owedCents;
  }
  return { depositDueCents, owedCents, refund: bookings.some(booking => booking.needsRefund) };
}

/**
 * The tabs of the list. A row is in every tab one of its turns belongs to: a plan with a transfer to confirm and turns ahead is both "attention" and
 * "upcoming".
 * - attention: someone has to do something: a hold or a transfer to confirm, a payment to return, or a turn that started and has no attendance yet.
 * - upcoming: confirmed and still ahead.
 * - past: attended or missed.
 * - closed: cancelled or lapsed, with nothing to return.
 */
export const bookingViews = ["attention", "upcoming", "past", "closed", "all"] as const;
export type BookingView = (typeof bookingViews)[number];

export function viewsOf(booking: AgendaBooking, now: Instant): BookingView[] {
  const status = effectiveStatus(booking, now);
  const started = Date.parse(booking.startsAt) <= Date.parse(now);
  const views: BookingView[] = ["all"];
  if (status === "held" || status === "pending_transfer" || booking.needsRefund || (status === "confirmed" && started)) views.push("attention");
  if (status === "confirmed" && !started) views.push("upcoming");
  if (status === "completed" || status === "no_show") views.push("past");
  if ((status === "cancelled" || status === "expired") && !booking.needsRefund) views.push("closed");
  return views;
}

const inView = (group: BookingGroup, view: BookingView, now: Instant) => group.bookings.some(booking => viewsOf(booking, now).includes(view));

/** How many rows each tab holds. */
export function viewCounts(groups: readonly BookingGroup[], now: Instant): Record<BookingView, number> {
  return Object.fromEntries(bookingViews.map(view => [view, groups.filter(group => inView(group, view, now)).length])) as Record<BookingView, number>;
}

/** The turn of a row that matters in a tab: the first that belongs to it. In "all", the next turn still ahead, or else the last one. */
export function leadOf(group: BookingGroup, view: BookingView, now: Instant): AgendaBooking {
  if (view === "all") return group.bookings.find(booking => Date.parse(booking.startsAt) > Date.parse(now)) ?? group.bookings[group.bookings.length - 1];
  return group.bookings.find(booking => viewsOf(booking, now).includes(view)) ?? group.bookings[0];
}

/** When a row asks for attention: a hold until it lapses, anything else by its turn. */
const deadline = (booking: AgendaBooking, now: Instant) => {
  const status = effectiveStatus(booking, now);
  return Date.parse((status === "held" || status === "pending_transfer") && booking.expiresAt ? booking.expiresAt : booking.startsAt);
};

/**
 * The rows of a tab, in the order that tab is read: what to solve and what is ahead, soonest first; what is past or closed, latest first. "All" is a
 * timeline read by the turn: what is ahead, soonest first, then what is past, latest first.
 */
export function rowsOf(groups: readonly BookingGroup[], view: BookingView, now: Instant): BookingGroup[] {
  const rows = groups.filter(group => inView(group, view, now));
  const at = (group: BookingGroup) => (view === "attention" ? deadline(leadOf(group, view, now), now) : Date.parse(leadOf(group, view, now).startsAt));
  if (view === "attention" || view === "upcoming") return rows.sort((a, b) => at(a) - at(b));
  if (view === "past" || view === "closed") return rows.sort((a, b) => at(b) - at(a));
  const current = Date.parse(now);
  const ahead = rows.filter(group => at(group) > current).sort((a, b) => at(a) - at(b));
  const behind = rows.filter(group => at(group) <= current).sort((a, b) => at(b) - at(a));
  return [...ahead, ...behind];
}

export type Charge = { tone: "danger" | "warn" | "plain" | "accent" | "none"; text: string };

/** What a row says about money, in one phrase: a refund first, then a missing deposit, then what is left to collect at the sauna. */
export function chargeOf(group: BookingGroup, now: Instant, format: (cents: number) => string): Charge {
  const money = groupMoney(group.bookings, now);
  if (money.refund) return { tone: "danger", text: "Devolver un pago" };
  if (money.depositDueCents > 0) return { tone: "warn", text: `Falta la seña: ${format(money.depositDueCents)}` };
  if (money.owedCents > 0) return { tone: "plain", text: `Cobrar ${format(money.owedCents)} en el lugar` };
  const live = group.bookings.some(booking => collecting.has(effectiveStatus(booking, now)));
  return live ? { tone: "accent", text: "Pagado" } : { tone: "none", text: "Sin cobro" };
}
