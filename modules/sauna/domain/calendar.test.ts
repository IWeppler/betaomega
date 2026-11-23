import assert from "node:assert/strict";
import { test } from "node:test";
import { googleCalendarUrl, icsFile, icsHref, type CalendarEvent } from "./calendar.ts";

const event: CalendarEvent = {
  title: "Fropexio: Sesión de 45 minutos", startsAt: "2026-11-10T21:30:00.000Z", endsAt: "2026-11-10T22:15:00.000Z",
  location: "Calle Larga, Centro", description: "Hierba: Menta", url: "https://fropexio.example/reserva/abc",
};
const now = "2026-11-08T12:00:00.000Z";

test("el enlace de Google lleva título, fechas en UTC, lugar y el enlace de la reserva", () => {
  const url = new URL(googleCalendarUrl(event));
  assert.equal(url.origin + url.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("text"), event.title);
  assert.equal(url.searchParams.get("dates"), "20261110T213000Z/20261110T221500Z");
  assert.equal(url.searchParams.get("location"), "Calle Larga, Centro");
  assert.equal(url.searchParams.get("details"), "Hierba: Menta\n\nhttps://fropexio.example/reserva/abc");
});

test("sin dirección no se manda lugar", () => {
  assert.equal(new URL(googleCalendarUrl({ ...event, location: "" })).searchParams.has("location"), false);
});

test("el .ics tiene el evento, escapa las comas y avisa un día y una hora antes", () => {
  const ics = icsFile([event], { now, host: "fropexio.example" });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /\r\nDTSTART:20261110T213000Z\r\n/);
  assert.match(ics, /\r\nDTEND:20261110T221500Z\r\n/);
  assert.match(ics, /\r\nUID:20261110T213000Z@fropexio\.example\r\n/);
  assert.match(ics, /\r\nLOCATION:Calle Larga\\, Centro\r\n/);
  assert.match(ics, /TRIGGER:-P1D/);
  assert.match(ics, /TRIGGER:-PT1H/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1);
});

test("un plan lleva un evento por turno, cada uno con su id", () => {
  const second = { ...event, startsAt: "2026-11-11T21:30:00.000Z", endsAt: "2026-11-11T22:15:00.000Z" };
  const ics = icsFile([event, second], { now, host: "fropexio.example" });
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.match(ics, /UID:20261111T213000Z@fropexio\.example/);
});

test("las líneas largas se pliegan a 75 octetos sin partir un carácter", () => {
  const long = icsFile([{ ...event, description: "ñandú ".repeat(60) }], { now, host: "h" });
  for (const line of long.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.ok(!long.includes("�"));
});

test("el enlace de descarga lleva el archivo codificado", () => {
  const href = icsHref(icsFile([event], { now, host: "h" }));
  assert.ok(href.startsWith("data:text/calendar;charset=utf-8,BEGIN%3AVCALENDAR"));
});
