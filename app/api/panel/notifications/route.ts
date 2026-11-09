import { isAdmin } from "@/lib/auth";
import { countPendingComments } from "@/lib/comment-store";
import { listPanelSites } from "@/lib/site-registry";
import type { Site } from "@/lib/sites";
import { saunaNotice } from "@/modules/sauna/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What is waiting in each site, for the panel's site list: whoever spends the day in one site still sees what arrives in the others.
// GET ?s.<siteId>=<ISO instant>: when the person last opened that site's panel (kept in their browser). Only the sites with something to say answer.

type SiteNotice = { count: number; label: string; path: string };

const DAY = 86_400_000;

/** The last visit as the browser says it, kept within the last 30 days. Without one, the last day. */
function sinceOf(value: string | null, now: number) {
  const time = value ? Date.parse(value) : Number.NaN;
  return new Date(Number.isNaN(time) ? now - DAY : Math.min(now, Math.max(time, now - 30 * DAY))).toISOString();
}

async function noticeOf(site: Site, since: string): Promise<SiteNotice | null> {
  if (site.kind === "recetas") {
    const count = await countPendingComments(site.id);
    return { count, label: count === 1 ? "comentario por aprobar" : "comentarios por aprobar", path: "comentarios" };
  }
  if (site.kind === "sauna") return { ...await saunaNotice(site.id, since), path: "reservas" };
  return null;
}

export async function GET(request: Request) {
  if (!await isAdmin()) return Response.json({ error: "Ingresá como administrador." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const now = Date.now();
  const sites = await listPanelSites();
  // One failing site (a missing table, a timeout) leaves the others' notices standing.
  const answers = await Promise.all(sites.map(site => noticeOf(site, sinceOf(params.get(`s.${site.id}`), now)).catch(error => {
    console.error(`[notifications] ${site.id} failed:`, error instanceof Error ? error.message.slice(0, 120) : "error");
    return null;
  })));
  const notices: Record<string, SiteNotice> = {};
  sites.forEach((site, index) => { const notice = answers[index]; if (notice && notice.count > 0) notices[site.id] = notice; });
  return Response.json({ notices }, { headers: { "Cache-Control": "no-store" } });
}
