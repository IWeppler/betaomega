import assert from "node:assert/strict";
import { test } from "node:test";
import { cancellationMessage, cancellationRequestMessage, confirmationMessage, contactMessage, reminderMessage, transferProofMessage, whatsappLink, type MessageBooking } from "./messages.ts";
import { formatCents } from "../../../platform/money/index.ts";

const booking: MessageBooking = {
  siteName: "Fropexio", customerName: "Ana", startsAt: "2026-11-10T21:30:00.000Z", kind: "shared", seats: 2, owedCents: 140000, link: "https://fropexio.example/reserva/abc",
};

test("el enlace de WhatsApp lleva el número y el texto codificado", () => {
  assert.equal(whatsappLink("5491123456789", "Hola, ¿qué tal? a&b"), "https://wa.me/5491123456789?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F%20a%26b");
});

test("la confirmación dice qué, cuándo, cuánto falta y dónde verla", () => {
  assert.equal(confirmationMessage(booking), "Hola, Ana. Tu reserva en Fropexio está confirmada: 2 lugares el martes 10 de noviembre a las 18:30. Queda $ 1.400 para pagar en el lugar. Podés verla acá: https://fropexio.example/reserva/abc");
});

test("sin nada que pagar no se menciona el saldo", () => {
  assert.equal(reminderMessage({ ...booking, owedCents: 0 }), "Hola, Ana. Te recordamos tu reserva en Fropexio: 2 lugares el martes 10 de noviembre a las 18:30. Te esperamos. Tu reserva: https://fropexio.example/reserva/abc");
});

test("un lugar y la sala completa se nombran bien", () => {
  assert.match(confirmationMessage({ ...booking, seats: 1 }), /: 1 lugar el /);
  assert.match(confirmationMessage({ ...booking, kind: "private", seats: 6 }), /: la sala completa el /);
});

test("la confirmación y el recordatorio incluyen la hierba de la reserva", () => {
  const withHerb = { ...booking, herbName: "Menta" };
  assert.match(confirmationMessage(withHerb), /2 lugares con Menta el /);
  assert.match(reminderMessage(withHerb), /2 lugares con Menta el /);
  assert.doesNotMatch(confirmationMessage({ ...booking, herbName: null }), /con Menta/);
});

test("la hora es la de Buenos Aires", () => {
  assert.match(reminderMessage({ ...booking, startsAt: "2026-11-11T01:00:00.000Z" }), /martes 10 de noviembre a las 22:00/);
});

test("una persona anonimizada no se nombra", () => {
  assert.match(cancellationMessage({ ...booking, customerName: "" }), /^Hola\. Tu reserva/);
});

test("la cancelación identifica el turno", () => {
  assert.equal(cancellationMessage(booking), "Hola, Ana. Tu reserva en Fropexio del martes 10 de noviembre a las 18:30 quedó cancelada. Si querés, podés hacer otra cuando quieras.");
});

test("quien reservó consulta o pide cancelar con el enlace de su reserva", () => {
  assert.equal(contactMessage(booking), "Hola, tengo una consulta sobre mi reserva en Fropexio del martes 10 de noviembre a las 18:30: https://fropexio.example/reserva/abc");
  assert.equal(cancellationRequestMessage(booking), "Hola, quiero cancelar mi reserva en Fropexio del martes 10 de noviembre a las 18:30: https://fropexio.example/reserva/abc");
});

test("el comprobante de transferencia nombra el monto y la reserva", () => {
  assert.equal(
    transferProofMessage({ ...booking, amountCents: 600_000 }),
    `Hola, te mando el comprobante de la transferencia de ${formatCents(600_000)} para mi reserva en Fropexio del martes 10 de noviembre a las 18:30: https://fropexio.example/reserva/abc`,
  );
});
