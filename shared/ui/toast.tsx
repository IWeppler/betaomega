"use client";
import { useSyncExternalStore } from "react";
import { currentToast, holdToast, releaseToast, runToastAction, subscribeToast } from "./toast-store";

export { showToast, toastCount, type ToastAction, type ToastOptions } from "./toast-store";

const serverSnapshot = () => null;

export function Toaster() {
  const toast = useSyncExternalStore(subscribeToast, currentToast, serverSnapshot);
  return <div role="status" aria-live="polite" aria-atomic="true" className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex justify-end sm:left-auto">
    {toast && <div key={toast.id} onPointerEnter={holdToast} onPointerLeave={releaseToast} onFocus={holdToast} onBlur={releaseToast}
      className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-card border border-line-strong bg-surface py-2 pl-4 text-ink shadow-lift ${toast.action ? "pr-2" : "pr-4"}`}>
      <span className="min-w-0 flex-1 py-1">{toast.message}</span>
      {toast.action && !toast.working && <button type="button" onClick={() => void runToastAction(toast)}
        className="min-h-control shrink-0 rounded-control px-3 font-semibold text-accent-text hover:bg-sunken focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {toast.action.label}
      </button>}
    </div>}
  </div>;
}
