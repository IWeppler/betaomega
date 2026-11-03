import type { MetricEvent, ShareChannel } from "@/lib/metrics";

/** The same page opened again in the same tab within this time is one visit, not two (a reload, the back button). */
const sameVisitMs = 30 * 60 * 1000;

function send(siteId: string, event: MetricEvent) {
  const url = `/api/sites/${siteId}/metrics`;
  const body = JSON.stringify(event);
  // sendBeacon survives the page closing right after (a share that opens another app); fetch is the fallback.
  try { if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return; } catch { /* falls through to fetch */ }
  void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

/** Reports that this page was opened. Nothing happens when the same address was already counted in this tab recently. */
export function trackView(siteId: string, recipeId?: string) {
  try {
    const key = `r-view:${window.location.pathname}`;
    const last = Number(window.sessionStorage.getItem(key));
    if (last && Date.now() - last < sameVisitMs) return;
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch { /* storage blocked (private window): every load counts */ }
  send(siteId, { kind: "view", recipeId });
}

export function trackShare(siteId: string, channel: ShareChannel, recipeId?: string) {
  send(siteId, { kind: "share", recipeId, channel });
}
