import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, businessDate, businessDayStart, businessTime, businessWeek, dayLabel, isDateText, monthGrid, monthLabel, restOfBusinessDay, shortDayLabel, startOfWeek, weekdayOf } from "./time.ts";

test("la hora se muestra en Buenos Aires, en 24 horas", () => {
  assert.equal(businessTime("2026-11-10T23:30:00.000Z"), "20:30");
  assert.equal(businessTime("2026-11-10T03:05:00.000Z"), "00:05");
});

test("un día de negocio empieza a la medianoche de Buenos Aires", () => {
  assert.equal(businessDayStart("2026-11-10"), "2026-11-10T03:00:00.000Z");
  assert.equal(businessDate(businessDayStart("2026-11-10")), "2026-11-10");
});

test("el cierre del día va desde ahora hasta la medianoche de Buenos Aires", () => {
  assert.deepEqual(restOfBusinessDay("2026-11-10T15:00:00.000Z"), { startsAt: "2026-11-10T15:00:00.000Z", endsAt: "2026-11-11T03:00:00.000Z" });
  assert.equal(restOfBusinessDay("2026-11-11T02:30:00.000Z").endsAt, "2026-11-11T03:00:00.000Z", "a las 23:30 cierra lo que queda de ese día");
});

test("sumar días cruza meses y años, y reconoce fechas inválidas", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(weekdayOf("2026-11-10"), 2);
  assert.equal(startOfWeek("2026-11-15"), "2026-11-09");
  assert.equal(isDateText("2026-11-10"), true);
  for (const value of ["2026-02-30", "2026-13-01", "10/11/2026", "", null]) assert.equal(isDateText(value), false, String(value));
});

test("las fechas se nombran en español", () => {
  assert.equal(dayLabel("2026-11-10"), "martes 10 de noviembre");
  assert.equal(dayLabel("2026-11-01"), "domingo 1 de noviembre");
  assert.equal(shortDayLabel("2026-11-11"), "mié 11");
  assert.equal(monthLabel("2026-11-10"), "noviembre de 2026");
});

test("la página de un mes son semanas completas de lunes a domingo", () => {
  const november = monthGrid("2026-11-18");
  assert.equal(november[0], "2026-10-26");
  assert.equal(november.at(-1), "2026-12-06");
  assert.equal(november.length % 7, 0);
  const february = monthGrid("2027-02-10"); // starts on a Monday and ends on a Sunday
  assert.equal(february[0], "2027-02-01");
  assert.equal(february.at(-1), "2027-02-28");
});

test("el día de negocio es el de Buenos Aires, no el de UTC", () => {
  assert.equal(businessDate("2026-11-10T02:59:59.000Z"), "2026-11-09");
  assert.equal(businessDate("2026-11-10T03:00:00.000Z"), "2026-11-10");
});

test("la semana empieza el lunes", () => {
  assert.equal(businessWeek("2026-11-09T15:00:00.000Z"), "2026-11-09", "lunes");
  assert.equal(businessWeek("2026-11-11T15:00:00.000Z"), "2026-11-09", "miércoles");
  assert.equal(businessWeek("2026-11-15T15:00:00.000Z"), "2026-11-09", "domingo");
  assert.equal(businessWeek("2026-11-16T15:00:00.000Z"), "2026-11-16", "lunes siguiente");
});

test("el domingo a la noche sigue siendo de esa semana aunque en UTC ya sea lunes", () => {
  assert.equal(businessWeek("2026-11-16T02:59:00.000Z"), "2026-11-09");
  assert.equal(businessWeek("2026-11-16T03:00:00.000Z"), "2026-11-16");
});

test("una semana que cruza de mes o de año conserva su lunes", () => {
  assert.equal(businessWeek("2026-12-03T15:00:00.000Z"), "2026-11-30");
  assert.equal(businessWeek("2027-01-02T15:00:00.000Z"), "2026-12-28");
});
