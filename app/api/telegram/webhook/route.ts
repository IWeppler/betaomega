import { equal } from "@/platform/auth/server";
import { handleTelegramUpdate } from "@/platform/notifications/manage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The bot's webhook (docs/tareas-notificaciones.md, point 4). Telegram signs every call with the secret given to setWebhook; anything else is refused.
// It answers 200 even when the message is useless, so Telegram does not retry it.

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !equal(given, secret)) return new Response(null, { status: 401 });
  const text = await request.text();
  if (text.length > 20_000) return new Response(null, { status: 200 });
  try {
    await handleTelegramUpdate(JSON.parse(text));
  } catch (error) {
    console.error("[telegram] update failed:", error instanceof Error ? error.message.slice(0, 160) : "error");
  }
  return new Response(null, { status: 200 });
}
