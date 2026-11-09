import { listPanelSites } from "@/lib/site-registry";
import { noticeSetup } from "@/platform/notifications/manage";
import { failure, guard, noStore } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the Avisos screen shows: channels ready, destinations and the sites to choose from. */
export async function GET(request: Request) {
  const refused = await guard(request, false);
  if (refused) return refused;
  try {
    const [setup, sites] = await Promise.all([noticeSetup(), listPanelSites()]);
    return Response.json({ ...setup, sites: sites.map(site => ({ id: site.id, name: site.name })) }, { headers: noStore });
  } catch (error) { return failure(error, "leer los avisos"); }
}
