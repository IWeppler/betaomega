import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { currentToast, holdToast, releaseToast, runToastAction, showToast } from "./toast-store.ts";
import { deferChange, offerUndo } from "./undo.ts";

// A window with only what deferChange uses: the pagehide listener.
const listeners = new Map<string, Set<() => void>>();
Object.assign(globalThis, {
  window: {
    addEventListener: (type: string, listener: () => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)?.add(listener); },
    removeEventListener: (type: string, listener: () => void) => { listeners.get(type)?.delete(listener); },
  },
});
const fire = (type: string) => [...(listeners.get(type) ?? [])].forEach(listener => listener());
const settle = () => new Promise(resolve => setImmediate(resolve));
const press = async () => {
  const toast = currentToast();
  assert.ok(toast?.action, "el aviso tiene que tener su botón");
  await runToastAction(toast);
};

mock.timers.enable({ apis: ["setTimeout", "Date"] });
beforeEach(() => {
  // Whatever the previous test left on screen closes now, so it does not run into this one.
  showToast("");
  mock.timers.tick(10_000);
  listeners.clear();
});

test("deshacer un cambio guardado lo vuelve atrás y lo dice", async () => {
  let undone = 0;
  offerUndo("Se guardó el plan.", async () => { undone++; });
  assert.equal(currentToast()?.message, "Se guardó el plan.");
  assert.equal(currentToast()?.action?.label, "Deshacer");
  await press();
  assert.equal(undone, 1);
  assert.equal(currentToast()?.message, "Se deshizo el cambio.");
});

test("si deshacer falla, el aviso dice por qué", async () => {
  offerUndo("Se guardó el plan.", async () => { throw new Error("Alguien más cambió este plan."); });
  await press();
  assert.equal(currentToast()?.message, "Alguien más cambió este plan.");
});

test("un cambio retenido se hace cuando termina la espera", async () => {
  const made: boolean[] = [];
  let sent = 0;
  deferChange({ message: "Se va a cancelar la reserva de Ana.", commit: async () => { sent++; return "Se canceló la reserva de Ana."; }, onSettled: done => made.push(done) });
  assert.equal(sent, 0, "todavía no se manda");
  mock.timers.tick(6_000);
  await settle();
  assert.equal(sent, 1);
  assert.deepEqual(made, [true]);
  assert.equal(currentToast()?.message, "Se canceló la reserva de Ana.");
});

test("deshacer un cambio retenido hace que nunca se mande", async () => {
  const made: boolean[] = [];
  let sent = 0;
  deferChange({ message: "Se va a cancelar la reserva de Ana.", commit: async () => { sent++; }, onSettled: done => made.push(done) });
  await press();
  mock.timers.tick(60_000);
  fire("pagehide");
  await settle();
  assert.equal(sent, 0);
  assert.deepEqual(made, [false]);
});

test("otro aviso o salir de la página mandan el cambio retenido en el momento", async () => {
  let sent = 0;
  deferChange({ message: "Primero", commit: async () => { sent++; } });
  showToast("Otra cosa");
  await settle();
  assert.equal(sent, 1, "el aviso nuevo lo manda");
  deferChange({ message: "Segundo", commit: async () => { sent++; } });
  fire("pagehide");
  await settle();
  assert.equal(sent, 2, "cerrar la página lo manda");
  mock.timers.tick(10_000);
  await settle();
  assert.equal(sent, 2, "nunca dos veces");
});

test("el resultado de un cambio retenido no le quita el botón a otro aviso", async () => {
  deferChange({ message: "Se va a confirmar la reserva de Ana.", commit: async () => "Se confirmó la reserva de Ana." });
  // Its notice gives way to a newer change, which sends it; its result must not cover the newer notice and its "Deshacer".
  offerUndo("Se guardó el plan.", async () => {});
  await settle();
  assert.equal(currentToast()?.message, "Se guardó el plan.");
});

test("con el puntero o el foco sobre el aviso, el tiempo se detiene", async () => {
  let sent = 0;
  deferChange({ message: "Se va a cancelar la reserva de Ana.", commit: async () => { sent++; } });
  mock.timers.tick(5_000);
  holdToast();
  holdToast(); // pointer and focus together count once
  mock.timers.tick(60_000);
  await settle();
  assert.equal(sent, 0);
  releaseToast();
  mock.timers.tick(1_999);
  await settle();
  assert.equal(sent, 0, "quedan al menos dos segundos al soltarlo");
  mock.timers.tick(1);
  await settle();
  assert.equal(sent, 1);
});
