import { createTelegramLink, registerTelegramWebhook } from "@/platform/notifications/manage";
import { choice, fail, failure, guard, readBody } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { label, siteIds }: a one-time address that opens the bot and links the chat that taps "Iniciar". */
export async function POST(request: Request) {
  const refused = await guard(request, true);
  if (refused) return refused;
  try {
    const { label, siteIds } = await choice(await readBody(request));
    const link = await createTelegramLink(label, siteIds);
    return link ? Response.json(link) : fail(409, "Falta configurar el bot: TELEGRAM_BOT_TOKEN y TELEGRAM_BOT_USERNAME.");
  } catch (error) { return failure(error, "crear el enlace de Telegram"); }
}

/** PUT: points the bot at this deployment. Needed once, and again if the panel's address changes. */
export async function PUT(request: Request) {
  const refused = await guard(request, true);
  if (refused) return refused;
  try {
    const result = await registerTelegramWebhook();
    return result.ok ? Response.json({ ok: true }) : fail(409, `Telegram no aceptó el webhook. ${result.description}`.trim());
  } catch (error) { return failure(error, "conectar el bot"); }
}
