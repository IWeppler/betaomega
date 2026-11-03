import type { MetricsReport } from "./metrics";
import { rpc, SupabaseError } from "./supabase";

// Server-only access to the metrics functions (supabase/schema.sql).
let warned = false;
const warnOnce = (error: unknown) => {
  if (warned) return;
  warned = true;
  console.warn("[metrics] no se pudo registrar (¿falta correr supabase/schema.sql?):", error);
};

/** Adds one to today's counter. Never throws: a failed count must not break anything. */
export async function trackMetric(siteId: string, recipeId: string | undefined, kind: "page_view" | "recipe_view" | "share", channel = "") {
  try { await rpc("track_metric", { p_site: siteId, p_recipe: recipeId ?? null, p_kind: kind, p_channel: channel }); } catch (error) { warnOnce(error); }
}

export async function metricsReport(siteId: string, days: number) {
  return rpc<MetricsReport>("metrics_report", { p_site: siteId, p_days: days });
}

/** Views recorded per recipe since the metrics began. Empty when the functions are not there yet. */
export async function recordedViews(siteId: string): Promise<Record<string, number>> {
  try { return await rpc<Record<string, number>>("recipe_view_totals", { p_site: siteId }); } catch (error) {
    if (!(error instanceof SupabaseError)) throw error;
    warnOnce(error);
    return {};
  }
}
