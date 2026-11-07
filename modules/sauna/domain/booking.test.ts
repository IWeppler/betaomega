import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingStatuses, canTransition, effectiveStatus, InvalidTransitionError, isCurrent, transition, type BookingStatus } from "./booking.ts";

const NOW = "2026-11-10T15:00:00.000Z";
const LATER = "2026-11-10T15:15:00.000Z";
const EARLIER = "2026-11-10T14:45:00.000Z";

const valid: [BookingStatus, BookingStatus][] = [
  ["held", "pending_transfer"], ["held", "confirmed"], ["held", "expired"], ["held", "cancelled"],
  ["pending_transfer", "confirmed"], ["pending_transfer", "expired"], ["pending_transfer", "cancelled"],
  ["confirmed", "cancelled"], ["confirmed", "completed"], ["confirmed", "no_show"],
  ["expired", "confirmed"],
];

test("cada cambio de estado previsto está permitido", () => {
  for (const [from, to] of valid) assert.equal(transition({ status: from }, to).status, to, `${from} → ${to}`);
});

test("todo cambio de estado no previsto se rechaza", () => {
  for (const from of bookingStatuses) {
    for (const to of bookingStatuses) {
      if (valid.some(([a, b]) => a === from && b === to)) continue;
      assert.equal(canTransition(from, to), false, `${from} → ${to}`);
      assert.throws(() => transition({ status: from }, to), InvalidTransitionError, `${from} → ${to}`);
    }
  }
});

test("una reserva terminada no sale de su estado", () => {
  for (const from of ["cancelled", "completed", "no_show"] as const) {
    for (const to of bookingStatuses) assert.equal(canTransition(from, to), false, `${from} → ${to}`);
  }
});

test("una reserva vencida solo puede volver por un pago tardío", () => {
  assert.deepEqual(bookingStatuses.filter(to => canTransition("expired", to)), ["confirmed"]);
});

test("cambiar de estado no modifica la reserva original y conserva sus datos", () => {
  const booking = { status: "held" as BookingStatus, id: "b1" };
  const next = transition(booking, "confirmed");
  assert.equal(booking.status, "held");
  assert.deepEqual(next, { status: "confirmed", id: "b1" });
});

test("una retención vencida se lee como vencida aunque nadie haya cambiado su estado", () => {
  assert.equal(effectiveStatus({ status: "held", expiresAt: EARLIER }, NOW), "expired");
  assert.equal(effectiveStatus({ status: "pending_transfer", expiresAt: EARLIER }, NOW), "expired");
  assert.equal(effectiveStatus({ status: "held", expiresAt: NOW }, NOW), "expired", "vence justo en el instante indicado");
  assert.equal(effectiveStatus({ status: "held", expiresAt: LATER }, NOW), "held");
});

test("una reserva sin retención no vence por tiempo", () => {
  assert.equal(effectiveStatus({ status: "confirmed", expiresAt: EARLIER }, NOW), "confirmed");
  assert.equal(effectiveStatus({ status: "cancelled", expiresAt: EARLIER }, NOW), "cancelled");
});

test("ocupan lugar las reservas vigentes y las retenciones sin vencer", () => {
  for (const status of ["confirmed", "completed", "no_show"] as const) assert.equal(isCurrent({ status, expiresAt: null }, NOW), true, status);
  assert.equal(isCurrent({ status: "held", expiresAt: LATER }, NOW), true);
  assert.equal(isCurrent({ status: "pending_transfer", expiresAt: LATER }, NOW), true);
});

test("no ocupan lugar las canceladas, las vencidas ni las retenciones vencidas", () => {
  assert.equal(isCurrent({ status: "cancelled", expiresAt: null }, NOW), false);
  assert.equal(isCurrent({ status: "expired", expiresAt: EARLIER }, NOW), false);
  assert.equal(isCurrent({ status: "held", expiresAt: EARLIER }, NOW), false);
  assert.equal(isCurrent({ status: "pending_transfer", expiresAt: EARLIER }, NOW), false);
});
