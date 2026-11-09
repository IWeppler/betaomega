import type { AgendaBooking } from "./agenda.ts";
import { effectiveStatus, type Instant } from "./booking.ts";
import type { TimeBand } from "./hours.ts";
import { businessDate, businessTime, weekdayOf } from "./time.ts";

/** Weekdays in the order the panel shows them: Monday first. 0 is Sunday, like weekdayOf. */
export const weekOrder = [1, 2, 3, 4, 5, 6, 0] as const;

/** How many intensity steps the heat map uses, besides the empty one. */
export const LEVELS = 4;

export type PreferenceCell = { weekday: number; hour: number; bookings: number; people: number };

export type Preferences = {
  /** Hours of the day (0–23) with a row in the map: the opening hours plus any hour that had a booking. */
  hours: number[];
  /** One row per hour, one cell per weekday in weekOrder. */
  rows: PreferenceCell[][];
  /** Totals per weekday, in weekOrder. */
  days: { weekday: number; bookings: number; people: number }[];
  /** The fullest cell, to scale the colors. */
  most: number;
  total: number;
  /** The weekday and the hour with the most bookings, or null without bookings. A tie keeps the first in weekOrder or the earliest hour. */
  topDay: number | null;
  topHour: number | null;
};

// A booking that was cancelled or lapsed never happened; one that did not show still says when the person wanted to come.
const counted = new Set(["held", "pending_transfer", "confirmed", "completed", "no_show"]);

const hourOf = (instant: Instant) => Number(businessTime(instant).slice(0, 2));

/** The hours a band covers, counting a partial last hour ("10:00"–"13:30" covers 10, 11, 12 and 13). */
function bandHours(band: Pick<TimeBand, "from" | "to">): number[] {
  const from = Number(band.from.slice(0, 2));
  const [toHour, toMinute] = [Number(band.to.slice(0, 2)), Number(band.to.slice(3))];
  // "00:00" as the end means midnight.
  const end = (toHour === 0 && toMinute === 0 ? 24 : toHour) + (toMinute > 0 ? 1 : 0);
  return Array.from({ length: Math.max(end - from, 0) }, (_, index) => from + index);
}

/** When people book: bookings per weekday and starting hour, in Buenos Aires time. */
export function preferencesOf(bookings: readonly AgendaBooking[], now: Instant, bands: readonly Pick<TimeBand, "from" | "to">[] = []): Preferences {
  const grid = new Map<string, PreferenceCell>();
  const hours = new Set(bands.flatMap(bandHours));
  let total = 0;
  for (const booking of bookings) {
    if (!counted.has(effectiveStatus(booking, now))) continue;
    const weekday = weekdayOf(businessDate(booking.startsAt));
    const hour = hourOf(booking.startsAt);
    hours.add(hour);
    const key = `${weekday}-${hour}`;
    const cell = grid.get(key) ?? { weekday, hour, bookings: 0, people: 0 };
    cell.bookings += 1;
    cell.people += booking.seats;
    grid.set(key, cell);
    total += 1;
  }
  const sortedHours = [...hours].sort((a, b) => a - b);
  const rows = sortedHours.map(hour => weekOrder.map(weekday => grid.get(`${weekday}-${hour}`) ?? { weekday, hour, bookings: 0, people: 0 }));
  const days = weekOrder.map((weekday, column) => ({
    weekday,
    bookings: rows.reduce((sum, row) => sum + row[column].bookings, 0),
    people: rows.reduce((sum, row) => sum + row[column].people, 0),
  }));
  const hourTotals = rows.map(row => row.reduce((sum, cell) => sum + cell.bookings, 0));
  const top = <T>(items: readonly T[], value: (item: T) => number) => items.reduce<T | null>((best, item) => (value(item) > (best ? value(best) : 0) ? item : best), null);
  const topDay = top(days, day => day.bookings);
  const topHourIndex = top(hourTotals.map((count, index) => ({ count, index })), item => item.count);
  return {
    hours: sortedHours,
    rows,
    days,
    most: Math.max(0, ...rows.flat().map(cell => cell.bookings)),
    total,
    topDay: topDay?.weekday ?? null,
    topHour: topHourIndex ? sortedHours[topHourIndex.index] : null,
  };
}

/**
 * The `count` hours with the most bookings, earliest first, for a compact map. A tie keeps the earlier hour. Without enough booked hours, the opening
 * hours fill the rest, so a new site still shows a grid.
 */
export function topHours(preferences: Pick<Preferences, "hours" | "rows">, count = 5): number[] {
  const totals = preferences.hours.map((hour, index) => ({ hour, bookings: preferences.rows[index].reduce((sum, cell) => sum + cell.bookings, 0) }));
  return totals
    .sort((a, b) => b.bookings - a.bookings || a.hour - b.hour)
    .slice(0, count)
    .map(item => item.hour)
    .sort((a, b) => a - b);
}

/** The color step of a cell: 0 when empty, 1 to LEVELS by its share of the fullest cell. */
export const levelOf = (count: number, most: number) => (count <= 0 || most <= 0 ? 0 : Math.max(1, Math.ceil((count / most) * LEVELS)));
