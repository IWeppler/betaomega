// The notice at the bottom of the panel, without its look: what is shown, for how long, and what its button does. toast.tsx draws it. Kept apart so
// it can be tested without a browser.

/** A button in the notice, such as "Deshacer". `run` resolves to the message shown after it, or throws one written for the person. */
export type ToastAction = { label: string; run: () => Promise<string | void>; /** What the notice says while it runs. */ busyMessage?: string };
export type ToastOptions = {
  durationMs?: number;
  action?: ToastAction;
  /** Called once when this notice gives way to another one or runs out of time, but not after its action ran. */
  onClose?: () => void;
  /** Not shown if the notice on screen has an action: a result must not take away someone else's "Deshacer". */
  unlessAction?: boolean;
};

export type Toast = { id: number; message: string; action?: ToastAction; working: boolean; onClose?: () => void };

let current: Toast | null = null;
let serial = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let remaining = 0;
let startedAt = 0;
let held = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export const subscribeToast = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const currentToast = () => current;

const close = (id: number) => {
  if (current?.id !== id) return;
  const { onClose } = current;
  current = null;
  emit();
  onClose?.();
};
const schedule = (id: number, ms: number) => {
  clearTimeout(timer);
  remaining = ms;
  startedAt = Date.now();
  held = false;
  timer = setTimeout(() => close(id), ms);
};

/** Shows a notice at the bottom of the screen. A notice with an action stays longer, and stops counting while the pointer or the focus is on it. */
export function showToast(message: string, options: number | ToastOptions = {}) {
  const { durationMs, action, onClose, unlessAction } = typeof options === "number" ? { durationMs: options } : options;
  if (unlessAction && current?.action && !current.working) return;
  const previous = current;
  current = { id: ++serial, message, action, working: false, onClose };
  // The one it replaces is closed: a pending change it was holding back goes through now.
  previous?.onClose?.();
  emit();
  schedule(current.id, durationMs ?? (action ? 8000 : 3000));
}

/** Increases with every notice shown: whoever saves can tell whether the change already reported itself. */
export const toastCount = () => serial;

/** Presses the notice's button. Nothing happens if that notice is no longer the one on screen. */
export async function runToastAction(toast: Toast) {
  if (!toast.action || toast.working || current?.id !== toast.id) return;
  clearTimeout(timer);
  // The action replaces closing: onClose must not run after it.
  current = { ...toast, onClose: undefined, working: true, message: toast.action.busyMessage ?? `${toast.action.label}…` };
  emit();
  let message: string;
  try { message = (await toast.action.run()) || "Listo."; } catch (failure) { message = (failure as Error).message || "No se pudo completar. Probá de nuevo."; }
  // Something newer may have taken its place meanwhile: then that one stays.
  if (current?.id === toast.id) showToast(message, 5000);
}

/** Time stops while the person is on a notice with a button, so reaching it is never a race (WCAG 2.2.1). */
export function holdToast() {
  if (!current?.action || current.working || held) return;
  clearTimeout(timer);
  held = true;
  remaining = Math.max(2000, remaining - (Date.now() - startedAt));
}
export function releaseToast() {
  if (current?.action && !current.working && held) schedule(current.id, remaining);
}
