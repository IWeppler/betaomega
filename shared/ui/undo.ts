"use client";
import { showToast } from "./toast-store.ts";

// Undo for the panel. Two ways, depending on what the change allows:
// - offerUndo: the change is already saved and can be saved back, such as a form or a status that has an opposite.
// - deferChange: the change cannot be taken back once made (cancelling a booking, recording a payment, deleting): it waits while the notice is on
//   screen and only then goes to the server. Another notice, leaving the page or the end of the wait sends it.

/**
 * After a saved change: "Deshacer" runs `undo`, which saves the previous state back and may resolve to what to tell the person instead of
 * "Se deshizo el cambio.", or throws a message written for them.
 */
export function offerUndo(message: string, undo: () => Promise<string | void>) {
  showToast(message, { action: { label: "Deshacer", busyMessage: "Deshaciendo…", run: async () => (await undo()) || "Se deshizo el cambio." } });
}

/**
 * Before a change that cannot be taken back. `commit` makes it and resolves to an optional message for the person; `onSettled` says whether it was
 * made, so the screen can reload. The wait is short and stops while the pointer or the focus is on the notice.
 */
export function deferChange({ message, commit, onSettled }: { message: string; commit: () => Promise<string | void>; onSettled?: (made: boolean) => void }) {
  let waiting = true;
  const stop = () => {
    waiting = false;
    window.removeEventListener("pagehide", send);
  };
  function send() {
    if (!waiting) return;
    stop();
    commit().then(
      text => { if (text) showToast(text, { durationMs: 6000, unlessAction: true }); onSettled?.(true); },
      (failure: unknown) => { showToast((failure as Error).message || "No se pudo completar. Probá de nuevo.", 8000); onSettled?.(false); },
    );
  }
  window.addEventListener("pagehide", send);
  showToast(message, {
    durationMs: 6000,
    onClose: send,
    action: { label: "Deshacer", run: async () => { stop(); onSettled?.(false); return "Se deshizo: no se hizo ningún cambio."; } },
  });
}
