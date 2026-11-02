import { CART_STORAGE_KEY, serializeCart, type Cart } from "@/lib/cart";

/**
 * The cart's storage, shaped for useSyncExternalStore. It holds the raw JSON string; lib/cart.ts parses it.
 * Every localStorage access is wrapped: if storage is blocked (private browsing) the cart lives in memory.
 */
let raw = "[]";
let loaded = false;
/** Lines dropped because their product is no longer offered, until the customer dismisses the notice. */
let removed = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { raw = window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]"; } catch { /* storage blocked: start empty, keep working in memory */ }
}
export function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  // Another tab changed the cart.
  const onStorage = (event: StorageEvent) => { if (event.key === CART_STORAGE_KEY) { raw = event.newValue ?? "[]"; emit(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
export const getSnapshot = () => { load(); return raw; };
export const getServerSnapshot = () => "[]";
export const getRemoved = () => removed;
export const getServerRemoved = () => 0;
export function setRemoved(count: number) { removed = count; emit(); }
/** Saves the cart. `dropped` is how many lines were removed because they are no longer offered. */
export function writeCart(cart: Cart, dropped = 0) {
  raw = serializeCart(cart);
  removed += dropped;
  try { window.localStorage.setItem(CART_STORAGE_KEY, raw); } catch { /* storage blocked: the cart stays in memory */ }
  emit();
}
