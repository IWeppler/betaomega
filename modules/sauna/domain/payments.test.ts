import assert from "node:assert/strict";
import { test } from "node:test";
import { leavesBookingConfirmed, ledgerOf, settlePayment, type IncomingPayment } from "./payments.ts";

const NOW = "2026-11-10T15:00:00.000Z";
const payment = (over: Partial<IncomingPayment> = {}): IncomingPayment => ({
  status: "held", expiresAt: "2026-11-10T15:10:00.000Z", depositCents: 300000, amountCents: 300000,
  startsAt: "2026-11-11T20:00:00.000Z", seatsFree: 2, seats: 1, closed: false, now: NOW, ...over,
});
const LAPSED = "2026-11-10T14:50:00.000Z";

test("el saldo se calcula sumando los movimientos", () => {
  assert.deepEqual(ledgerOf([]), { chargedCents: 0, depositPaidCents: 0, refundedCents: 0, netCents: 0 });
  assert.deepEqual(ledgerOf([
    { kind: "deposit", amountCents: 300000 },
    { kind: "balance", amountCents: 700000 },
    { kind: "refund", amountCents: 100000 },
    { kind: "refund", amountCents: 50000 },
  ]), { chargedCents: 1000000, depositPaidCents: 300000, refundedCents: 150000, netCents: 850000 });
  assert.equal(ledgerOf([{ kind: "pack", amountCents: 5000000 }]).chargedCents, 5000000);
});

test("un pago a tiempo por el monto exacto confirma", () => {
  assert.equal(settlePayment(payment()), "confirmed");
  assert.equal(settlePayment(payment({ status: "pending_transfer" })), "confirmed");
});

test("una retención vigente confirma sin mirar el cupo: su lugar ya está tomado", () => {
  assert.equal(settlePayment(payment({ seatsFree: 0 })), "confirmed");
});

test("un pago tardío confirma si el turno no empezó y sigue habiendo lugar", () => {
  assert.equal(settlePayment(payment({ status: "expired", expiresAt: LAPSED })), "late_confirmed");
  assert.equal(settlePayment(payment({ expiresAt: LAPSED })), "late_confirmed", "una retención vencida cuenta como tardía aunque diga held");
  assert.equal(settlePayment(payment({ status: "pending_transfer", expiresAt: LAPSED })), "late_confirmed");
});

test("un pago tardío sin lugar queda como pago sin cupo", () => {
  assert.equal(settlePayment(payment({ status: "expired", expiresAt: LAPSED, seatsFree: 0 })), "no_seat");
  assert.equal(settlePayment(payment({ expiresAt: LAPSED, seats: 3, seatsFree: 2 })), "no_seat");
});

test("un pago tardío con el turno ya empezado queda como pago sin cupo", () => {
  assert.equal(settlePayment(payment({ status: "expired", expiresAt: LAPSED, startsAt: NOW })), "no_seat");
  assert.equal(settlePayment(payment({ status: "expired", expiresAt: LAPSED, startsAt: "2026-11-10T14:00:00.000Z" })), "no_seat");
});

test("un pago tardío en un turno cerrado queda como pago sin cupo", () => {
  assert.equal(settlePayment(payment({ status: "expired", expiresAt: LAPSED, closed: true })), "no_seat");
});

test("un pago a tiempo no depende del cierre: un cierre no cancela lo ya reservado", () => {
  assert.equal(settlePayment(payment({ closed: true })), "confirmed");
});

test("un pago por otro monto no confirma, sea de menos o de más", () => {
  assert.equal(settlePayment(payment({ amountCents: 299999 })), "amount_mismatch");
  assert.equal(settlePayment(payment({ amountCents: 300001 })), "amount_mismatch");
  assert.equal(settlePayment(payment({ status: "expired", expiresAt: LAPSED, amountCents: 1 })), "amount_mismatch");
});

test("un pago sobre una reserva ya resuelta no la cambia", () => {
  for (const status of ["confirmed", "cancelled", "completed", "no_show"] as const) {
    assert.equal(settlePayment(payment({ status, expiresAt: null })), "unapplied", status);
  }
});

test("solo dos resultados dejan la reserva confirmada", () => {
  assert.equal(leavesBookingConfirmed("confirmed"), true);
  assert.equal(leavesBookingConfirmed("late_confirmed"), true);
  for (const outcome of ["duplicate", "no_seat", "amount_mismatch", "unapplied"] as const) assert.equal(leavesBookingConfirmed(outcome), false, outcome);
});
