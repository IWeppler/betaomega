import "server-only";
import { rpc } from "@/platform/db";
import type { MetricsReport } from "../domain/metrics";

// Server-only access to the voice metrics functions (supabase/schema.sql).
let warned = 0;

/** Adds one to today's counter. Never throws: a failed count must not break anything. Warns at most once an hour (a missing schema.sql). */
export async function track(siteId: string, kind: "page_view" | "voice_view" | "search", voiceId = "", term = "") {
  try { await rpc("voice_track", { p_site: siteId, p_kind: kind, p_voice: voiceId, p_term: term }); } catch (error) {
    if (Date.now() - warned < 3_600_000) return;
    warned = Date.now();
    console.warn("[voices] no se pudo registrar la métrica (¿falta correr supabase/schema.sql?):", error instanceof Error ? error.message : error);
  }
}

export const metricsReport = (siteId: string, days: number) => rpc<MetricsReport>("voice_metrics_report", { p_site: siteId, p_days: days });
