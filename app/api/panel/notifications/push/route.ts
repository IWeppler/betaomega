import { cleanSubscription } from "@/platform/notifications";
import { savePushSubscription } from "@/platform/notifications/manage";
import { choice, fail, failure, guard, readBody } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { subscription, label, siteIds }: this phone receives the notices. */
export async function POST(request: Request) {
  const refused = await guard(request, true);
  if (refused) return refused;
  try {
    const body = await readBody(request);
    const subscription = cleanSubscription(body.subscription);
    if (!subscription) return fail(400, "El navegador no dio una suscripción válida. Probá de nuevo.");
    const { label, siteIds } = await choice(body);
    await savePushSubscription(subscription, label, siteIds);
    return Response.json({ ok: true });
  } catch (error) { return failure(error, "activar los avisos"); }
}
