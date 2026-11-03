"use client";

import { useEffect } from "react";

/* Registers the panel's worker (public/panel-sw.js). Skipped in development, like the sites' worker. */
export function RegisterPanelServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) void navigator.serviceWorker.register("/panel-sw.js").catch(() => undefined);
  }, []);
  return null;
}
