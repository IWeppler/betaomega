import { getPanelSite } from "@/platform/sites/server";
import { cleanLabel } from "@/platform/notifications";
import { sendNotice } from "@/platform/notifications/server";
import { fail, guard, readBody } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { siteId, label }: a test notice to every phone and chat, now, so the screen can say how many got it. */
export async function POST(request: Request) {
  const refused = await guard(request, true);
  if (refused) return refused;
  const body = await readBody(request);
  const site = typeof body.siteId === "string" ? await getPanelSite(body.siteId) : undefined;
  if (!site) return fail(400, "Sitio inválido.");
  const result = await sendNotice({ siteId: site.id, event: "panel.test", destinationLabel: cleanLabel(body.label) });
  return Response.json(result);
}
