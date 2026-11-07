"use client";
import { useSyncExternalStore } from "react";
type Toast = { id: number; message: string };
let current: Toast | null = null;
let serial = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => current;
const serverSnapshot = () => null;
export function showToast(message: string) {
  clearTimeout(timer);
  current = { id: ++serial, message };
  emit();
  timer = setTimeout(() => { current = null; emit(); }, 3000);
}

export function Toaster() {
  const toast = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return <div role="status" aria-live="polite" aria-atomic="true" className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex justify-end sm:left-auto">
    {toast && <div key={toast.id} className="max-w-sm rounded-card border border-line-strong bg-surface px-4 py-3 text-ink shadow-lift">{toast.message}</div>}
  </div>;
}
