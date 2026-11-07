import type { Instant } from "./booking.ts";

/** Business days are Buenos Aires days, wherever the server or the browser runs (docs/CONVENTIONS.md §6). */
export const BUSINESS_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** A calendar date, YYYY-MM-DD. Date arithmetic below goes through UTC only to avoid the local zone of whoever runs it. */
export type DateText = string;

const DAY = 86_400_000;
const dateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

const utc = (date: DateText) => Date.parse(`${date}T00:00:00.000Z`);

/** Dates arrive in URLs, so an impossible one ("2026-13-01", "2026-02-30") has to be a plain no. */
export function isDateText(value: unknown): value is DateText {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = utc(value);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** The calendar date of an instant in Buenos Aires. */
export const businessDate = (instant: Instant): DateText => dateFormat.format(Date.parse(instant));

/** The time of an instant in Buenos Aires, as HH:mm. */
export const businessTime = (instant: Instant) => timeFormat.format(Date.parse(instant)).slice(0, 5);

export const addDays = (date: DateText, days: number): DateText => new Date(utc(date) + days * DAY).toISOString().slice(0, 10);

/** 0 is Sunday, like sauna_time_bands.weekday. */
export const weekdayOf = (date: DateText) => new Date(utc(date)).getUTCDay();

/** The Monday of a date's week. */
export const startOfWeek = (date: DateText) => addDays(date, -((weekdayOf(date) + 6) % 7));

/** The Monday that opens the week of an instant. Same week as date_trunc('week', …) in SQL. */
export const businessWeek = (instant: Instant) => startOfWeek(businessDate(instant));

/** The instant a Buenos Aires day begins, measuring the zone's offset instead of assuming it. */
export function businessDayStart(date: DateText): Instant {
  const guess = new Date(utc(date)).toISOString();
  const wall = Date.parse(`${businessDate(guess)}T${timeFormat.format(utc(date))}Z`);
  return new Date(utc(date) - (wall - utc(date))).toISOString();
}

/** From now to the end of the Buenos Aires day: the closure behind "no more turns today". */
export const restOfBusinessDay = (now: Instant) => ({ startsAt: now, endsAt: businessDayStart(addDays(businessDate(now), 1)) });

const weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Written by hand, like formatCents: Intl's Spanish output differs between server and browser, and these labels are rendered by both.
export const weekdayName = (weekday: number) => weekdays[weekday];
/** "martes 10 de noviembre" */
export const dayLabel = (date: DateText) => `${weekdays[weekdayOf(date)]} ${Number(date.slice(8))} de ${months[Number(date.slice(5, 7)) - 1]}`;
/** "mar 10" */
export const shortDayLabel = (date: DateText) => `${weekdays[weekdayOf(date)].slice(0, 3)} ${Number(date.slice(8))}`;
/** "noviembre de 2026" */
export const monthLabel = (date: DateText) => `${months[Number(date.slice(5, 7)) - 1]} de ${date.slice(0, 4)}`;

/** Every date of the calendar page holding a date: whole Monday-to-Sunday weeks. */
export function monthGrid(date: DateText): DateText[] {
  const first = startOfWeek(`${date.slice(0, 8)}01`);
  const nextMonth = new Date(utc(`${date.slice(0, 8)}01`));
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const last = addDays(startOfWeek(addDays(nextMonth.toISOString().slice(0, 10), -1)), 6);
  return Array.from({ length: (utc(last) - utc(first)) / DAY + 1 }, (_, index) => addDays(first, index));
}
