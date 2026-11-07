import type { AgendaBooking } from "./agenda.ts";
import { effectiveStatus, type Instant } from "./booking.ts";
import type { ClosureEntry } from "./setup.ts";
import { addDays, businessDayStart, type DateText } from "./time.ts";

// How the week grid of the Agenda is drawn: each booking and each closure is one block that spans the rows of its time, instead of a word repeated in
// every cell. Pure, so the arithmetic of rows, lanes and "now" has tests.

/** What a block says about the money and the state, which is what someone attending needs at a glance. */
export type BlockTone = "confirmed" | "unpaid" | "refund" | "done" | "closure";

export type WeekBlock = {
  key: string;
  /** 0 is the first day of the week shown. */
  dayIndex: number;
  /** First and last row covered, indexes into the rows of the grid, both included. */
  firstRow: number;
  lastRow: number;
  /** Side by side when two blocks share time: which one and out of how many in that day. */
  lane: number;
  lanes: number;
  tone: BlockTone;
  startsAt: Instant;
  endsAt: Instant;
  past: boolean;
  booking: AgendaBooking | null;
  closure: ClosureEntry | null;
};

const minuteOf = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));

/** The tone of a booking, most urgent first: money to give back, then a deposit not paid yet. */
export function toneOf(booking: AgendaBooking, now: Instant): BlockTone {
  if (booking.needsRefund) return "refund";
  const status = effectiveStatus(booking, now);
  if (status === "held" || status === "pending_transfer") return "unpaid";
  if (status === "completed" || status === "no_show") return "done";
  return "confirmed";
}

/** The rows a span of minutes of one day covers. Null when it falls outside the rows shown (before opening or after closing). */
function rowSpan(rows: readonly number[], stepMinutes: number, from: number, to: number): [number, number] | null {
  const covered = rows.flatMap((row, index) => (row < to && row + stepMinutes > from ? [index] : []));
  return covered.length ? [covered[0], covered[covered.length - 1]] : null;
}

/**
 * Every block of a week. `bookings` are the current ones. A closure that spans several days becomes one block per day, cut to that day; one that only
 * covers hours outside the rows is left out here and still shows in the side panel of its day.
 */
export function weekBlocks({ from, rows, stepMinutes, bookings, closures, now }: {
  from: DateText; rows: readonly string[]; stepMinutes: number; bookings: readonly AgendaBooking[]; closures: readonly ClosureEntry[]; now: Instant;
}): WeekBlock[] {
  const rowMinutes = rows.map(minuteOf);
  const blocks: Omit<WeekBlock, "lane" | "lanes">[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const day = addDays(from, dayIndex);
    const start = Date.parse(businessDayStart(day));
    const end = Date.parse(businessDayStart(addDays(day, 1)));
    const place = (startsAt: Instant, endsAt: Instant) => {
      const from = Math.max(Date.parse(startsAt), start);
      const to = Math.min(Date.parse(endsAt), end);
      if (to <= from) return null;
      return rowSpan(rowMinutes, stepMinutes, (from - start) / 60_000, (to - start) / 60_000);
    };
    for (const booking of bookings) {
      const span = place(booking.startsAt, booking.endsAt);
      if (span) blocks.push({ key: `b:${booking.id}`, dayIndex, firstRow: span[0], lastRow: span[1], tone: toneOf(booking, now), startsAt: booking.startsAt, endsAt: booking.endsAt, past: Date.parse(booking.endsAt) <= Date.parse(now), booking, closure: null });
    }
    for (const closure of closures) {
      const span = place(closure.startsAt, closure.endsAt);
      if (span) blocks.push({ key: `c:${closure.id}:${day}`, dayIndex, firstRow: span[0], lastRow: span[1], tone: "closure", startsAt: closure.startsAt, endsAt: closure.endsAt, past: Date.parse(closure.endsAt) <= Date.parse(now), booking: null, closure });
    }
  }
  return withLanes(blocks);
}

/** Blocks that share rows in a day go side by side; each day splits into as many lanes as it needs at its busiest. */
function withLanes(blocks: Omit<WeekBlock, "lane" | "lanes">[]): WeekBlock[] {
  const result: WeekBlock[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const day = blocks.filter(block => block.dayIndex === dayIndex).sort((a, b) => a.firstRow - b.firstRow || b.lastRow - a.lastRow);
    const laneEnds: number[] = [];
    const placed = day.map(block => {
      let lane = laneEnds.findIndex(lastRow => lastRow < block.firstRow);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = block.lastRow;
      return { ...block, lane };
    });
    result.push(...placed.map(block => ({ ...block, lanes: Math.max(laneEnds.length, 1) })));
  }
  return result;
}

/** Where "now" falls in the grid of today, as a fraction of its rows from the top, or null when today is not shown or it is outside the rows. */
export function nowPosition({ from, rows, stepMinutes, now }: { from: DateText; rows: readonly string[]; stepMinutes: number; now: Instant }): { dayIndex: number; fraction: number } | null {
  if (!rows.length) return null;
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const start = Date.parse(businessDayStart(addDays(from, dayIndex)));
    const minutes = (Date.parse(now) - start) / 60_000;
    if (minutes < 0 || minutes >= 24 * 60) continue;
    const first = minuteOf(rows[0]);
    const last = minuteOf(rows[rows.length - 1]) + stepMinutes;
    if (minutes < first || minutes >= last) return null;
    return { dayIndex, fraction: (minutes - first) / (last - first) };
  }
  return null;
}
