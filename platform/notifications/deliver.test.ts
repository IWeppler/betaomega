import assert from "node:assert/strict";
import { test } from "node:test";
import { bookkeeping, deliver, MAX_FAILURES, pushResult, telegramResult, type Channels, type Destination, type SendResult } from "./deliver.ts";
import { buildNotice } from "./index.ts";

const notice = buildNotice({ siteId: "fropexio", siteName: "Fropexio", event: "sauna.payment_confirmed", customerName: "Ana", startsAt: "2026-11-14T22:00:00Z", late: false });
const phone = (id: string, siteIds: string[] = [], failures = 0): Destination => ({ kind: "push", id, endpoint: `https://push.example/${id}`, p256dh: "k", auth: "a", siteIds, failures });
const chat = (id: string, siteIds: string[] = [], failures = 0): Destination => ({ kind: "telegram", id, chatId: "123", siteIds, failures });

/** Channels that record what they were asked and answer what each id says. */
function fake(answers: Record<string, SendResult | Error> = {}) {
  const calls: { kind: string; id: string; body: string; url?: string }[] = [];
  const answer = async (id: string) => {
    const value = answers[id] ?? "sent";
    if (value instanceof Error) throw value;
    return value;
  };
  const channels: Channels = {
    push: async (destination, payload) => { calls.push({ kind: "push", id: destination.id, body: payload }); return answer(destination.id); },
    telegram: async (destination, text, url) => { calls.push({ kind: "telegram", id: destination.id, body: text, url }); return answer(destination.id); },
  };
  return { channels, calls };
}

test("manda por push y por Telegram a quien quiere ese sitio", async () => {
  const { channels, calls } = fake();
  const outcomes = await deliver(notice, [phone("p1"), chat("t1"), phone("p2", ["comidasdelcielo"])], "https://panel.example", channels);
  assert.deepEqual(calls.map(call => call.id).sort(), ["p1", "t1"]);
  assert.equal(outcomes.length, 2);
  assert.equal(JSON.parse(calls.find(call => call.kind === "push")!.body).url, "https://panel.example/fropexio/agenda");
  assert.equal(calls.find(call => call.kind === "telegram")!.url, "https://panel.example/fropexio/agenda");
  assert.match(calls.find(call => call.kind === "telegram")!.body, /^<b>Fropexio<\/b>\n/);
});

test("un canal sin configurar se saltea sin contar fallas", async () => {
  const { channels, calls } = fake();
  const outcomes = await deliver(notice, [phone("p1"), chat("t1")], "https://panel.example", { ...channels, telegram: null });
  assert.deepEqual(calls.map(call => call.id), ["p1"]);
  assert.deepEqual(outcomes.map(outcome => outcome.destination.id), ["p1"]);
});

test("un canal que se cae cuenta como falla y no corta a los demás", async () => {
  const { channels } = fake({ p1: new Error("timeout") });
  const outcomes = await deliver(notice, [phone("p1"), chat("t1")], "https://panel.example", channels);
  assert.deepEqual(outcomes.map(outcome => [outcome.destination.id, outcome.result]), [["p1", "failed"], ["t1", "sent"]]);
});

test("lo que ya no existe se borra; lo que falla suma, y demasiadas fallas seguidas también borran", () => {
  const result = bookkeeping([
    { destination: phone("gone"), result: "gone" },
    { destination: phone("ok", [], 4), result: "sent" },
    { destination: chat("retry", [], 2), result: "failed" },
    { destination: chat("tired", [], MAX_FAILURES - 1), result: "failed" },
  ]);
  assert.deepEqual(result.remove.map(item => item.id), ["gone", "tired"]);
  assert.deepEqual(result.sent.map(item => item.id), ["ok"]);
  assert.deepEqual(result.failed.map(item => [item.destination.id, item.failures]), [["retry", 3]]);
});

test("las respuestas de cada canal se leen igual que las documentan", () => {
  assert.equal(pushResult(201), "sent");
  assert.equal(pushResult(410), "gone");
  assert.equal(pushResult(404), "gone");
  assert.equal(pushResult(429), "failed");
  assert.equal(pushResult(undefined), "failed");
  assert.equal(telegramResult(200), "sent");
  assert.equal(telegramResult(403, "Forbidden: bot was blocked by the user"), "gone");
  assert.equal(telegramResult(400, "Bad Request: chat not found"), "gone");
  assert.equal(telegramResult(400, "Bad Request: can't parse entities"), "failed");
  assert.equal(telegramResult(429, "Too Many Requests"), "failed");
});
