import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountToCents, approvedPayment, argentineDate, bookingOfReference, bookingReference, centsToAmount, cleanPaymentId, isSigned, paymentRef, parseSignature,
  preferenceBody, signatureManifest, authorizationUrl, tokensFrom, needsRefresh, readOauthCookie,
} from "./mercadopago.ts";

const BOOKING = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const SECRET = "secreto-de-prueba";
/** A stand-in for HMAC-SHA256: 64 hex characters that change with the secret and with every character of the text. The real one is in api/payments.ts. */
const sign = (secret: string) => (manifest: string) => {
  let hash = 2166136261;
  return Array.from({ length: 8 }, (_, round) => {
    for (const char of `${round}:${secret}:${manifest}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return hash.toString(16).padStart(8, "0");
  }).join("");
};

test("los centavos van a Mercado Pago en pesos y vuelven sin perder un centavo", () => {
  assert.equal(centsToAmount(1_234_567), 12_345.67);
  assert.equal(amountToCents(12_345.67), 1_234_567);
  assert.equal(amountToCents(0.1 + 0.2), 30);
  assert.equal(amountToCents(0), null);
  assert.equal(amountToCents(Number.NaN), null);
});

test("las fechas salen con la hora de Argentina y su desfase", () => {
  assert.equal(argentineDate("2026-11-10T15:10:00.000Z"), "2026-11-10T12:10:00.000-03:00");
  assert.equal(argentineDate("2026-11-10T01:00:00.000Z"), "2026-11-09T22:00:00.000-03:00");
});

test("la referencia de un pago lleva la reserva y solo acepta un identificador válido", () => {
  assert.equal(bookingOfReference(bookingReference(BOOKING)), BOOKING);
  assert.equal(bookingOfReference(BOOKING), null);
  assert.equal(bookingOfReference("booking:no-es-un-id"), null);
  assert.equal(bookingOfReference("pack:" + BOOKING), null);
  assert.equal(bookingOfReference(null), null);
});

test("la preferencia cobra la seña exacta, vence con la retención y no acepta pagos en efectivo", () => {
  const body = preferenceBody({
    bookingId: BOOKING, title: "Seña", depositCents: 600_000, expiresAt: "2026-11-10T15:10:00.000Z", now: "2026-11-10T14:55:00.000Z",
    returnUrl: "https://fropexio.vercel.app/reserva/abc", notificationUrl: "https://fropexio.vercel.app/api/sites/fropexio/sauna/mercadopago",
  });
  assert.deepEqual(body.items, [{ id: BOOKING, title: "Seña", quantity: 1, unit_price: 6000, currency_id: "ARS" }]);
  assert.equal(body.external_reference, `booking:${BOOKING}`);
  assert.equal(body.binary_mode, true);
  assert.equal(body.expires, true);
  assert.equal(body.expiration_date_to, "2026-11-10T12:10:00.000-03:00");
  assert.equal(body.auto_return, "approved");
  assert.deepEqual(body.payment_methods.excluded_payment_types, [{ id: "ticket" }, { id: "atm" }]);
});

test("sin https no se pide la vuelta automática, que Mercado Pago rechazaría", () => {
  const body = preferenceBody({
    bookingId: BOOKING, title: "Seña", depositCents: 100, expiresAt: "2026-11-10T15:10:00.000Z", now: "2026-11-10T14:55:00.000Z",
    returnUrl: "http://fropexio.localhost:3000/reserva/abc", notificationUrl: "https://fropexio.vercel.app/api/x",
  });
  assert.equal("auto_return" in body, false);
});

test("el texto firmado sigue la plantilla de Mercado Pago y omite lo que falta", () => {
  assert.equal(signatureManifest({ dataId: "123", requestId: "req-1", ts: "1704908010" }), "id:123;request-id:req-1;ts:1704908010;");
  assert.equal(signatureManifest({ dataId: "ORD01ABC", requestId: null, ts: "1" }), "id:ord01abc;ts:1;");
  assert.equal(signatureManifest({ dataId: null, requestId: null, ts: "1" }), "ts:1;");
});

test("solo vale una firma hecha con la clave del sitio", () => {
  const notice = { dataId: "123", requestId: "req-1" };
  const v1 = sign(SECRET)("id:123;request-id:req-1;ts:1704908010;");
  assert.equal(isSigned({ ...notice, signature: `ts=1704908010,v1=${v1}` }, sign(SECRET)), true);
  assert.equal(isSigned({ ...notice, signature: `v1=${v1.toUpperCase()}, ts=1704908010` }, sign(SECRET)), true);
  assert.equal(isSigned({ ...notice, signature: `ts=1704908010,v1=${v1}` }, sign("otra-clave")), false);
  assert.equal(isSigned({ ...notice, dataId: "124", signature: `ts=1704908010,v1=${v1}` }, sign(SECRET)), false);
  assert.equal(isSigned({ ...notice, signature: `ts=1704908011,v1=${v1}` }, sign(SECRET)), false);
  assert.equal(isSigned({ ...notice, signature: null }, sign(SECRET)), false);
  assert.equal(parseSignature("ts=1,v1=corto"), null);
});

test("solo un pago aprobado en pesos para una reserva mueve algo", () => {
  const paid = { id: 987654321, status: "approved", currency_id: "ARS", transaction_amount: 6000, external_reference: `booking:${BOOKING}` };
  assert.deepEqual(approvedPayment(paid), { bookingId: BOOKING, ref: paymentRef("987654321"), amountCents: 600_000 });
  assert.equal(approvedPayment({ ...paid, status: "pending" }), null);
  assert.equal(approvedPayment({ ...paid, status: "rejected" }), null);
  assert.equal(approvedPayment({ ...paid, currency_id: "USD" }), null);
  assert.equal(approvedPayment({ ...paid, external_reference: "pedido-42" }), null);
  assert.equal(approvedPayment({ ...paid, transaction_amount: "6000" }), null);
  assert.equal(approvedPayment({ ...paid, id: "1; drop" }), null);
});

test("un identificador de pago es solo dígitos", () => {
  assert.equal(cleanPaymentId("123456"), "123456");
  assert.equal(cleanPaymentId("12a"), null);
  assert.equal(cleanPaymentId(123), null);
  assert.equal(cleanPaymentId("1".repeat(21)), null);
});

test("la autorización lleva la aplicación, la vuelta, el state y el desafío PKCE", () => {
  const url = new URL(authorizationUrl({ clientId: "217995404308633", redirectUri: "https://panel.example/api/sites/fropexio/sauna/mercadopago/oauth", state: "s".repeat(43), challenge: "c".repeat(43) }));
  assert.equal(url.origin + url.pathname, "https://auth.mercadopago.com/authorization");
  assert.equal(url.searchParams.get("client_id"), "217995404308633");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "https://panel.example/api/sites/fropexio/sauna/mercadopago/oauth");
  assert.equal(url.searchParams.get("state"), "s".repeat(43));
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});

test("solo se guarda una respuesta de token completa, con su vencimiento", () => {
  const answer = { access_token: "APP_USR-a", refresh_token: "TG-r", user_id: 123456, expires_in: 15_552_000, live_mode: true };
  assert.deepEqual(tokensFrom(answer, "2026-11-07T00:00:00.000Z"), {
    accessToken: "APP_USR-a", refreshToken: "TG-r", userId: "123456", expiresAt: "2027-05-06T00:00:00.000Z", liveMode: true,
  });
  for (const bad of [{ access_token: "" }, { refresh_token: undefined }, { user_id: "abc" }, { expires_in: 0 }, { expires_in: "100" }]) {
    assert.equal(tokensFrom({ ...answer, ...bad }, "2026-11-07T00:00:00.000Z"), null, JSON.stringify(bad));
  }
  assert.equal(tokensFrom(null, "2026-11-07T00:00:00.000Z"), null);
});

test("el token se renueva una semana antes de vencer", () => {
  assert.equal(needsRefresh("2026-11-20T00:00:00.000Z", "2026-11-07T00:00:00.000Z"), false);
  assert.equal(needsRefresh("2026-11-13T00:00:00.000Z", "2026-11-07T00:00:00.000Z"), true);
  assert.equal(needsRefresh("2026-11-01T00:00:00.000Z", "2026-11-07T00:00:00.000Z"), true);
});

test("la cookie del OAuth solo acepta un state y un verificador bien formados", () => {
  const state = "a".repeat(43);
  const verifier = "B-_".repeat(15);
  assert.deepEqual(readOauthCookie(`${state}.${verifier}`), { state, verifier });
  assert.equal(readOauthCookie(undefined), null);
  assert.equal(readOauthCookie(`${state}`), null);
  assert.equal(readOauthCookie(`${state}.corto`), null);
  assert.equal(readOauthCookie(`${state}.${verifier};x=1`), null);
});
