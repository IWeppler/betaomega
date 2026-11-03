import { isAdmin } from "@/lib/auth";
import { metricsReport, trackMetric } from "@/lib/metric-store";
import { cleanMetric, reportRanges } from "@/lib/metrics";
import { isLiveRecipe } from "@/lib/recipe-store";
import { looksLikeBot } from "@/lib/recipes";
import { failure, notFound, recipeSite, type SiteParams } from "../recipes/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ignored = () => new Response(null, { status: 204 });

/** Beacons may arrive without an Origin header; when there is one it must be this site's. */
function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.get("host"); } catch { return false; }
}

/**
 * The public site reports a visit or a share. Crawlers, link previews and the administrator's own visits are ignored
 * (answered as done, so nothing tells them apart). Nothing here can fail the page: the browser does not wait for the answer.
 */
export async function POST(request: Request, { params }: SiteParams) {
  if (!originAllowed(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const site = await recipeSite(params);
  if (!site) return notFound();
  try {
    const text = await request.text();
    if (text.length > 1000) return Response.json({ error: "Evento inválido." }, { status: 413 });
    const event = cleanMetric(JSON.parse(text));
    if (looksLikeBot(request.headers.get("user-agent")) || /prefetch|preview/i.test(request.headers.get("purpose") ?? request.headers.get("sec-purpose") ?? "") || await isAdmin()) return ignored();
    // A recipe that is not published (or not yet) has no views or shares to count.
    if (event.recipeId && !await isLiveRecipe(site.id, event.recipeId)) return ignored();
    if (event.kind === "share") await trackMetric(site.id, event.recipeId, "share", event.channel);
    else await Promise.all([trackMetric(site.id, undefined, "page_view"), event.recipeId ? trackMetric(site.id, event.recipeId, "recipe_view") : undefined]);
    return ignored();
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Evento inválido." }, { status: 400 });
    if (error instanceof Error && !("code" in error)) return Response.json({ error: error.message }, { status: 400 });
    console.error("[metrics] failed:", error);
    return ignored();
  }
}

/** The panel's report for the last 7, 30 or 90 days. */
export async function GET(request: Request, { params }: SiteParams) {
  if (!await isAdmin()) return Response.json({ error: "Ingresá como administrador." }, { status: 401 });
  const site = await recipeSite(params);
  if (!site) return notFound();
  const asked = Number(new URL(request.url).searchParams.get("days"));
  const days = (reportRanges as readonly number[]).includes(asked) ? asked : 30;
  try {
    return Response.json(await metricsReport(site.id, days), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error, "leer las métricas"); }
}
