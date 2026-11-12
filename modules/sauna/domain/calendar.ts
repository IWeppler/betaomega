// A turn as a calendar event, for the "add to calendar" buttons: a link that prefills Google Calendar, and an .ics file every other calendar opens.
// Pure: the caller gives the instants and the current time, so the same input always gives the same file.

export type CalendarEvent = {
  title: string;
  /** ISO instants. */
  startsAt: string;
  endsAt: string;
  /** The street and district, or empty. */
  location: string;
  description: string;
  /** Where the person finds their booking. */
  url: string;
};

/** 2026-11-10T21:30:00.000Z becomes 20261110T213000Z, the form both Google and .ics use. */
const stamp = (instant: string) => new Date(instant).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const detailsOf = (event: CalendarEvent) => [event.description, event.url].filter(Boolean).join("\n\n");

/** Opens Google Calendar with the event filled in. Google picks the reminder itself: the person's default. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${stamp(event.startsAt)}/${stamp(event.endsAt)}`, details: detailsOf(event) });
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Text values in an .ics file escape backslash, semicolon, comma and line breaks. */
const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines of an .ics file are at most 75 octets; a longer one continues on the next line, which starts with a space. Never cuts a character in two. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // A continuation line starts with the space, which counts too.
    if (size + bytes > (lines.length === 0 ? 75 : 74)) { lines.push(current); current = ""; size = 0; }
    current += char;
    size += bytes;
  }
  lines.push(current);
  return lines.join("\r\n ");
}

/** A day before and an hour before: the calendar itself reminds the person. */
const ALARMS = ["-P1D", "-PT1H"];

/** One .ics file with every event; `host` makes each event's id stable, so adding the same turn twice updates it instead of repeating it. */
export function icsFile(events: readonly CalendarEvent[], { now, host }: { now: string; host: string }): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Reservas//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${stamp(event.startsAt)}@${host}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(event.startsAt)}`,
      `DTEND:${stamp(event.endsAt)}`,
      `SUMMARY:${escapeText(event.title)}`,
      ...event.location ? [`LOCATION:${escapeText(event.location)}`] : [],
      `DESCRIPTION:${escapeText(detailsOf(event))}`,
      ...event.url ? [`URL:${event.url}`] : [],
      ...ALARMS.flatMap(trigger => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(event.title)}`, `TRIGGER:${trigger}`, "END:VALARM"]),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** The file as a link a plain anchor can download, with no server round trip. */
export const icsHref = (ics: string) => `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
