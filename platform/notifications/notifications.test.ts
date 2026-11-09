import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applicationServerKey, BODY_MAX, buildNotice, cleanLabel, cleanSubscription, cleanSiteIds, escapeTelegram, firstName, isLinkCode, linkCodeUsable, linkExpiry, newLinkCode, panelOrigin, pushPayload,
  shortWhen, startCode, telegramText, wantsNotice, type NoticeInput,
} from "./index.ts";

const sauna = { siteId: "fropexio", siteName: "Fropexio" };
// 19:00 in Buenos Aires, Saturday 14 November 2026.
const SATURDAY = "2026-11-14T22:00:00Z";

test("la fecha corta va en hora de Buenos Aires, con el día escrito a mano", () => {
  assert.equal(shortWhen(SATURDAY), "sáb 14/11 19:00");
  // 01:00 UTC on Sunday is still Saturday 22:00 in Buenos Aires.
  assert.equal(shortWhen("2026-11-15T01:00:00Z"), "sáb 14/11 22:00");
});

test("solo el primer nombre, y una palabra neutra si la persona fue anonimizada", () => {
  assert.equal(firstName("  Ana María Pérez "), "Ana");
  assert.equal(firstName(""), "Alguien");
});

test("una reserva nueva dice quién, cuándo y si falta la seña, y abre Reservas", () => {
  const notice = buildNotice({ ...sauna, event: "sauna.booking_new", customerName: "Ana Pérez", startsAt: SATURDAY, depositDueCents: 1_200_000, plan: null });
  assert.equal(notice.title, "Fropexio");
  assert.equal(notice.body, "Nueva reserva: Ana, sáb 14/11 19:00. Falta la seña de $ 12.000.");
  assert.equal(notice.path, "/fropexio/reservas");
  assert.doesNotMatch(notice.body, /Pérez/);
});

test("un plan dice su nombre y cuántos turnos, desde el primero", () => {
  const notice = buildNotice({ ...sauna, event: "sauna.booking_new", customerName: "Ana", startsAt: SATURDAY, depositDueCents: 0, plan: { name: "Plan Vitalidad", turns: 4 } });
  assert.equal(notice.body, "Nuevo Plan Vitalidad (4 turnos): Ana, desde el sáb 14/11 19:00. Confirmada.");
});

test("cada evento abre su sección", () => {
  const inputs: NoticeInput[] = [
    { ...sauna, event: "sauna.transfer_chosen", customerName: "Ana", startsAt: SATURDAY, amountCents: 1_200_000 },
    { ...sauna, event: "sauna.payment_confirmed", customerName: "Ana", startsAt: SATURDAY, late: false },
    { ...sauna, event: "sauna.payment_problem", customerName: "Ana", outcome: "no_seat" },
    { siteId: "comidasdelcielo", siteName: "Comidas del cielo", event: "recetas.comment_new", recipeTitle: "Guiso de lentejas" },
  ];
  assert.deepEqual(inputs.map(input => buildNotice(input).path), ["/fropexio/reservas", "/fropexio/agenda", "/fropexio", "/comidasdelcielo/comentarios"]);
  assert.match(buildNotice(inputs[0]).body, /va a transferir \$ 12\.000 por el sáb 14\/11 19:00/);
  assert.match(buildNotice(inputs[2]).body, /^Pago para devolver: Ana pagó cuando el turno ya no estaba libre/);
  assert.equal(buildNotice(inputs[3]).body, 'Comentario por aprobar en "Guiso de lentejas".');
});

test("un pago tardío confirmado lo aclara", () => {
  assert.match(buildNotice({ ...sauna, event: "sauna.payment_confirmed", customerName: "Ana", startsAt: SATURDAY, late: true }).body, /Llegó tarde/);
});

test("los comentarios de un sitio se reemplazan en el celular; las reservas no", () => {
  const comment = (title: string) => buildNotice({ siteId: "c", siteName: "C", event: "recetas.comment_new", recipeTitle: title }).tag;
  assert.equal(comment("Uno"), comment("Otro"));
  const booking = (startsAt: string) => buildNotice({ ...sauna, event: "sauna.booking_new", customerName: "Ana", startsAt, depositDueCents: 0, plan: null }).tag;
  assert.notEqual(booking(SATURDAY), booking("2026-11-15T22:00:00Z"));
});

test("un texto largo se corta con puntos suspensivos", () => {
  const notice = buildNotice({ siteId: "c", siteName: "C", event: "recetas.comment_new", recipeTitle: "x".repeat(500) });
  assert.ok(notice.body.length <= BODY_MAX);
  assert.ok(notice.body.includes("…"));
});

test("Telegram recibe el texto escapado para HTML", () => {
  assert.equal(escapeTelegram("<b>A & B</b>"), "&lt;b&gt;A &amp; B&lt;/b&gt;");
  const notice = buildNotice({ siteId: "c", siteName: "Sal & <Pimienta>", event: "recetas.comment_new", recipeTitle: "<script>" });
  assert.equal(telegramText(notice), '<b>Sal &amp; &lt;Pimienta&gt;</b>\nComentario por aprobar en "&lt;script&gt;".');
});

test("el push lleva título, texto, dirección completa y etiqueta, y nada más", () => {
  const notice = buildNotice({ ...sauna, event: "sauna.payment_confirmed", customerName: "Ana", startsAt: SATURDAY, late: false });
  const payload = JSON.parse(pushPayload(notice, "https://panel.example"));
  assert.deepEqual(Object.keys(payload).sort(), ["body", "tag", "title", "url"]);
  assert.equal(payload.url, "https://panel.example/fropexio/agenda");
});

test("un destino sin sitios elegidos quiere todos; si eligió, solo esos", () => {
  assert.ok(wantsNotice({ siteIds: [] }, "fropexio"));
  assert.ok(wantsNotice({ siteIds: ["fropexio"] }, "fropexio"));
  assert.ok(!wantsNotice({ siteIds: ["comidasdelcielo"] }, "fropexio"));
  assert.deepEqual(cleanSiteIds(["fropexio", "fropexio", "otro", 3], ["fropexio", "comidasdelcielo"]), ["fropexio"]);
  assert.deepEqual(cleanSiteIds("fropexio", ["fropexio"]), []);
  assert.equal(cleanLabel("  Celular de Ana  "), "Celular de Ana");
  assert.equal(cleanLabel("x".repeat(100)).length, 60);
});

test("el panel se abre en el primer host configurado, con https salvo en local", () => {
  assert.equal(panelOrigin("betayomega.vercel.app,panel.localhost"), "https://betayomega.vercel.app");
  assert.equal(panelOrigin("panel.localhost:3000"), "http://panel.localhost:3000");
  assert.equal(panelOrigin(""), null);
  assert.equal(panelOrigin("evil.com/path"), null);
});

test("la prueba llega a todos, aunque hayan elegido otros sitios", () => {
  const notice = buildNotice({ siteId: "fropexio", siteName: "Fropexio", event: "panel.test", destinationLabel: "Celular de Ana" });
  assert.equal(notice.body, "Prueba desde Celular de Ana: los avisos llegan bien.");
  assert.equal(notice.path, "/fropexio/avisos");
  assert.ok(wantsNotice({ siteIds: ["comidasdelcielo"] }, "fropexio", "panel.test"));
});

test("una suscripción push solo se acepta con su forma y un servicio https", () => {
  const good = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNc_x-1", auth: "tBH2" } };
  assert.deepEqual(cleanSubscription(good), { endpoint: good.endpoint, p256dh: "BNc_x-1", auth: "tBH2" });
  assert.equal(cleanSubscription({ ...good, endpoint: "http://fcm.googleapis.com/x" }), null);
  assert.equal(cleanSubscription({ ...good, keys: { p256dh: "<script>", auth: "a" } }), null);
  assert.equal(cleanSubscription({ endpoint: good.endpoint }), null);
  assert.equal(cleanSubscription("x"), null);
});

test("la clave pública VAPID pasa de base64url a bytes", () => {
  assert.deepEqual([...applicationServerKey("AQID_w")], [1, 2, 3, 255]);
});

test("el código de Telegram es largo, al azar y entra en el parámetro de inicio", () => {
  const code = newLinkCode();
  assert.ok(isLinkCode(code));
  assert.equal(code.length, 43);
  assert.notEqual(code, newLinkCode());
  assert.ok(!isLinkCode("corto"));
  assert.ok(!isLinkCode(`${code}!`));
});

test("del mensaje /start solo sale un código con formato válido", () => {
  const code = newLinkCode();
  assert.equal(startCode(`/start ${code}`), code);
  assert.equal(startCode(`/start@FropexioBot ${code}`), code);
  assert.equal(startCode("/start"), null);
  assert.equal(startCode("/start corto"), null);
  assert.equal(startCode(`hola ${code}`), null);
  assert.equal(startCode(undefined), null);
});

test("un código vale una sola vez y por diez minutos", () => {
  const now = "2026-11-09T12:00:00.000Z";
  const expiresAt = linkExpiry(now);
  assert.equal(expiresAt, "2026-11-09T12:10:00.000Z");
  assert.ok(linkCodeUsable({ expiresAt, usedAt: null }, "2026-11-09T12:09:59.000Z"));
  assert.ok(!linkCodeUsable({ expiresAt, usedAt: null }, "2026-11-09T12:10:00.000Z"));
  assert.ok(!linkCodeUsable({ expiresAt, usedAt: "2026-11-09T12:01:00.000Z" }, "2026-11-09T12:02:00.000Z"));
});
