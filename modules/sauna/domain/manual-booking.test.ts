import assert from "node:assert/strict";
import { test } from "node:test";
import type { Turn } from "./agenda.ts";
import { cleanManualBookingDraft, cleanManualBookingRequest, ManualBookingError, manualBookingKinds, manualBookingOptions, manualBookingPreview, prepareManualBooking, turnKey } from "./manual-booking.ts";
import { CustomerError } from "./customer.ts";
import { PricingError } from "./pricing.ts";
import { effectiveStatus, isCurrent } from "./booking.ts";
import { bookingActions, moneyState } from "./agenda.ts";
import { isClosed, seatsTaken } from "./availability.ts";
import { SetupError } from "./setup.ts";

const day = "2026-11-08";
const now = "2026-11-08T12:00:00Z";
const turn: Turn = { roomId: "room", turnTypeId: "type", typeName: "Turno 45", startsAt: "2026-11-08T13:00:00Z", endsAt: "2026-11-08T13:45:00Z", capacity: 2, freeSeats: 2, priceCents: 10000, privatePriceCents: null, depositPercent: 50, closed: false, bookable: true };

test("la entrada manual usa fecha y hora de Buenos Aires y devuelve todos los tipos del inicio elegido", () => {
  const longer = { ...turn, turnTypeId: "long", typeName: "Turno 60", endsAt: "2026-11-08T14:00:00Z" };
  const later = { ...turn, startsAt: "2026-11-08T14:00:00Z" };
  assert.deepEqual(manualBookingOptions([later, longer, turn], day, "10:00", now), [turn, longer]);
  assert.equal(manualBookingOptions([turn], day, "13:00", now).length, 0);
  assert.equal(manualBookingOptions([turn], "2026-11-09", undefined, now).length, 0);
  assert.deepEqual(manualBookingOptions([later, turn], day, undefined, now), [turn, later]);
});

test("una celda libre no habilita un turno cerrado, reservado, pasado o no ofrecido", () => {
  for (const patch of [{ closed: true }, { bookable: false }, { freeSeats: 1 }, { freeSeats: 0 }, { capacity: 0, freeSeats: 0 }, { priceCents: null, privatePriceCents: null }]) {
    assert.deepEqual(manualBookingOptions([{ ...turn, ...patch }], day, undefined, now), []);
  }
  assert.deepEqual(manualBookingOptions([turn], day, undefined, turn.startsAt), []);
  assert.deepEqual(manualBookingOptions([turn], day, undefined, turn.endsAt), []);
  assert.deepEqual(manualBookingOptions([{ ...turn, priceCents: null, privatePriceCents: 0 }], day, undefined, now).length, 1);
});

test("la selección distingue tipo, sala e inicio y se conserva entre lecturas equivalentes", () => {
  assert.equal(turnKey(turn), turnKey({ ...turn }));
  assert.notEqual(turnKey(turn), turnKey({ ...turn, turnTypeId: "other" }));
  assert.notEqual(turnKey(turn), turnKey({ ...turn, roomId: "other" }));
  assert.notEqual(turnKey(turn), turnKey({ ...turn, startsAt: "2026-11-08T14:00:00Z" }));
});

test("el formulario ofrece solo modalidades con precio, incluido cero", () => {
  assert.deepEqual(manualBookingKinds(turn), ["shared"]);
  assert.deepEqual(manualBookingKinds({ ...turn, priceCents: null, privatePriceCents: 0 }), ["private"]);
  assert.deepEqual(manualBookingKinds({ ...turn, privatePriceCents: 20000 }), ["shared", "private"]);
});

test("el resumen calcula duración y precio por modalidad sin restar una seña que no se cobró", () => {
  const both = { ...turn, privatePriceCents: 25000, depositPercent: 100 };
  assert.deepEqual(manualBookingPreview(both, "shared"), { durationMinutes: 45, totalCents: 10000, balanceCents: 10000 });
  assert.deepEqual(manualBookingPreview(both, "private"), { durationMinutes: 45, totalCents: 25000, balanceCents: 25000 });
  assert.equal(manualBookingPreview({ ...turn, priceCents: 0 }, "shared").balanceCents, 0);
  assert.throws(() => manualBookingPreview(turn, "private"), PricingError);
});

test("la revisión limpia nombre y WhatsApp y rechaza datos o modalidad inválidos", () => {
  const draft = { name: " Ana   Pérez ", whatsapp: "11 2345 6789", kind: "shared" as const };
  assert.deepEqual(cleanManualBookingDraft(turn, draft), { name: "Ana Pérez", whatsapp: "5491123456789", kind: "shared" });
  for (const patch of [{ name: "   " }, { name: "x".repeat(81) }, { whatsapp: "" }, { whatsapp: "abc" }, { whatsapp: "+34 612345678" }, { kind: "private" as const }]) {
    assert.throws(() => cleanManualBookingDraft(turn, { ...draft, ...patch }), CustomerError);
  }
});

const customer = { name: " Ana   Pérez ", whatsapp: "11 2345 6789", kind: "shared" as const };

test("la reserva manual confirmada no vence por falta de pago y mantiene la deuda completa", () => {
  const prepared = prepareManualBooking(turn, customer, now);
  assert.deepEqual(prepared.customer, { name: "Ana Pérez", whatsapp: "5491123456789" });
  assert.equal(prepared.booking.status, "confirmed");
  assert.equal(prepared.booking.expiresAt, null);
  assert.equal(effectiveStatus(prepared.booking, "2026-11-08T12:59:00Z"), "confirmed");
  assert.equal(isCurrent(prepared.booking, "2026-11-09T12:00:00Z"), true);
  assert.deepEqual(moneyState(prepared.booking), { totalCents: 10000, paidCents: 0, owedCents: 10000, depositDueCents: 0 });
  assert.deepEqual(prepared.booking.movements, []);
  assert.deepEqual(bookingActions({ ...prepared.booking, startsAt: prepared.startsAt }, now), { confirm: false, transfer: false, attendance: false, cancel: true });
});

test("individual y grupal conservan sus precios y ambas bloquean el módulo completo", () => {
  const offered = { ...turn, privatePriceCents: 25000 };
  for (const kind of ["shared", "private"] as const) {
    const prepared = prepareManualBooking(offered, { ...customer, kind }, now);
    assert.equal(prepared.booking.seats, kind === "private" ? 2 : 1);
    assert.equal(prepared.booking.priceCents, kind === "private" ? 25000 : 10000);
    const occupied = { ...prepared.booking, startsAt: prepared.startsAt, endsAt: prepared.endsAt };
    assert.equal(seatsTaken([occupied], "2026-11-08T13:30:00Z", "2026-11-08T14:00:00Z", now, 2), 2);
    assert.equal(seatsTaken([occupied], prepared.endsAt, "2026-11-08T14:30:00Z", now, 2), 0);
  }
});

test("la preparación no admite turnos pasados, sin horario ofrecido, cerrados o reservados", () => {
  for (const patch of [{ bookable: false }, { closed: true }, { freeSeats: 1 }, { freeSeats: 0 }, { capacity: 0, freeSeats: 0 }, { capacity: 2.5, freeSeats: 2.5 }, { startsAt: "invalid" }, { endsAt: turn.startsAt }]) {
    assert.throws(() => prepareManualBooking({ ...turn, ...patch }, customer, now), ManualBookingError);
  }
  assert.throws(() => prepareManualBooking(turn, customer, turn.startsAt), ManualBookingError);
  assert.throws(() => prepareManualBooking(turn, customer, turn.endsAt), ManualBookingError);
  const closure = { roomId: null, startsAt: "2026-11-08T13:30:00Z", endsAt: "2026-11-08T14:00:00Z" };
  assert.throws(() => prepareManualBooking({ ...turn, closed: isClosed(turn, [closure]) }, customer, now), ManualBookingError);
  assert.throws(() => prepareManualBooking(turn, { ...customer, kind: "private" }, now), CustomerError);
});

test("el precio viene del turno, sin descuento, seña exigida ni pagos inventados por el borrador", () => {
  const untrusted = { ...customer, priceCents: 1, discountCents: 9999, depositCents: 10000, seats: 200, status: "held", expiresAt: now, paidCents: 10000 };
  const prepared = prepareManualBooking(turn, untrusted, now);
  assert.equal(prepared.booking.priceCents, turn.priceCents);
  assert.equal(prepared.booking.discountCents, 0);
  assert.equal(prepared.booking.depositCents, 0);
  assert.equal(prepared.booking.seats, 1);
  assert.equal(moneyState(prepared.booking).owedCents, turn.priceCents);
  assert.deepEqual(prepared.booking.movements, []);
  const free = prepareManualBooking({ ...turn, priceCents: 0 }, customer, now);
  assert.equal(free.booking.status, "confirmed");
  assert.equal(moneyState(free.booking).owedCents, 0);
  assert.deepEqual(free.booking.movements, []);
  for (const priceCents of [-1, 0.5, Number.NaN]) assert.throws(() => prepareManualBooking({ ...turn, priceCents }, customer, now), ManualBookingError);
});

const request = { roomId: "11111111-1111-4111-8111-111111111111", turnTypeId: "22222222-2222-4222-8222-222222222222", requestId: "33333333-3333-4333-8333-333333333333", startsAt: "2026-11-08T10:00:00-03:00", expectedPriceCents: 10000, ...customer };

test("la petición manual normaliza datos y exige identificadores, fecha con zona y precio revisado", () => {
  assert.deepEqual(cleanManualBookingRequest(request), { ...request, name: "Ana Pérez", whatsapp: "5491123456789", startsAt: "2026-11-08T13:00:00.000Z" });
  for (const patch of [{ roomId: "x" }, { turnTypeId: "" }, { requestId: null }, { expectedPriceCents: -1 }, { expectedPriceCents: 0.5 }, { expectedPriceCents: "10000" }, { kind: "other" }, { startsAt: "2026-02-30T10:00:00Z" }, { startsAt: "2026-11-08T10:00" }, { startsAt: "2026-11-08T24:00:00Z" }]) {
    assert.throws(() => cleanManualBookingRequest({ ...request, ...patch }), SetupError);
  }
  assert.throws(() => cleanManualBookingRequest({ ...request, whatsapp: "+34 612345678" }), CustomerError);
  assert.throws(() => cleanManualBookingRequest(null), SetupError);
});

test("la petición no admite precio libre, cupo, estado, pagos, sitio o aceptación enviados por el navegador", () => {
  for (const extra of ["priceCents", "seats", "status", "paidCents", "depositCents", "siteId", "actor", "termsAccepted", "manual", "code", "packToken"]) {
    assert.throws(() => cleanManualBookingRequest({ ...request, [extra]: true }), SetupError, extra);
  }
});
