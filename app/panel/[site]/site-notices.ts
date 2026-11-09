"use client";

import { useCallback, useEffect, useState } from "react";

/** What is waiting in another site: how many, in words, and the section that shows it. */
export type SiteNotice = { count: number; label: string; path: string };

const POLL_MS = 60_000;
const seenKey = (siteId: string) => `panel.seen.${siteId}`;

// When the person last had each site's panel open. Only in this browser: losing it (private window, cleared data) only means the notices count the
// last day again, so every access is wrapped and a failure is ignored.
function readSeen(siteId: string): string | null {
  try { return window.localStorage.getItem(seenKey(siteId)); } catch { return null; }
}
function writeSeen(siteId: string) {
  try { window.localStorage.setItem(seenKey(siteId), new Date().toISOString()); } catch { /* the notices fall back to the last day */ }
}

/**
 * Notices of the other sites of the panel, refreshed every minute and when the window gets the focus back. The site open now counts as seen: its
 * own sections already show what is pending.
 */
export function useSiteNotices(currentId: string, siteIds: readonly string[]) {
  const [notices, setNotices] = useState<Record<string, SiteNotice>>({});
  const key = siteIds.join(",");
  const load = useCallback(async () => {
    writeSeen(currentId);
    const params = new URLSearchParams();
    for (const id of key.split(",")) {
      const seen = readSeen(id);
      if (seen) params.set(`s.${id}`, seen);
    }
    try {
      const response = await fetch(`/api/panel/notifications?${params}`, { cache: "no-store" });
      if (!response.ok) return;
      const { notices: next } = await response.json() as { notices: Record<string, SiteNotice> };
      delete next[currentId];
      setNotices(next);
    } catch { /* a missed refresh is retried on the next one */ }
  }, [currentId, key]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, POLL_MS);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
      // Leaving a site also counts as having seen it up to now.
      writeSeen(currentId);
    };
  }, [load, currentId]);
  return notices;
}
