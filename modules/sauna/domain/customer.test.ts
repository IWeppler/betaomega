import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanArgentineWhatsapp, cleanName, cleanWhatsapp, CustomerError } from "./customer.ts";

test("un nombre se guarda sin espacios sobrantes", () => {
  assert.equal(cleanName("  Ana   María "), "Ana María");
});

test("un nombre vacío o demasiado largo es un error", () => {
  for (const value of ["", "   ", null, 5, "x".repeat(81)]) assert.throws(() => cleanName(value), CustomerError);
});

test("un mismo celular escrito de distintas formas da el mismo número", () => {
  for (const written of ["+54 9 11 2345-6789", "5491123456789", "541123456789", "11 2345 6789", "011 2345-6789", "11 15 2345 6789", "011 15 2345 6789", "(011) 15-2345-6789"]) {
    assert.equal(cleanWhatsapp(written), "5491123456789", written);
  }
});

test("reconoce la característica de cualquier largo al sacar el 15", () => {
  assert.equal(cleanWhatsapp("0351 15 234 5678"), "5493512345678");
  assert.equal(cleanWhatsapp("2966 15 12 3456"), "5492966123456");
});

test("un número de otro país conserva su código", () => {
  assert.equal(cleanWhatsapp("+34 612 34 56 78"), "34612345678");
  assert.equal(cleanWhatsapp("+598 94 123 456"), "59894123456");
});

test("el 9 de celular escrito después del +54 fijo da el mismo número", () => {
  assert.equal(cleanWhatsapp("9 11 2345 6789"), "5491123456789");
});

test("una reserva solo admite números argentinos", () => {
  assert.equal(cleanArgentineWhatsapp("11 2345 6789"), "5491123456789");
  assert.throws(() => cleanArgentineWhatsapp("+34 612 34 56 78"), CustomerError);
});

test("un número inválido es un error", () => {
  for (const value of ["", "   ", null, 123, "hola", "11 2345", "1234567890123456", "11-2345-678x", "+12345"]) {
    assert.throws(() => cleanWhatsapp(value), CustomerError, String(value));
  }
});
