"use client";

import { useEffect, useRef } from "react";

/** Sends one event to the site's metrics. Fire and forget: `keepalive` lets it leave even if the page is closing, and a failure is ignored. */
export function sendMetric(siteId: string, event: { kind: "view"; voiceId?: string } | { kind: "search"; term: string }) {
  void fetch(`/api/sites/${siteId}/voices/metrics`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(event) }).catch(() => {});
}

/** Counts this visit once: the page, and the voice when it is a voice's page. Draws nothing. */
export function VoiceTracker({ siteId, voiceId }: { siteId: string; voiceId?: string }) {
  // Once per mount: React's strict mode runs effects twice in development, which would count twice.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    sendMetric(siteId, voiceId ? { kind: "view", voiceId } : { kind: "view" });
  }, [siteId, voiceId]);
  return null;
}
