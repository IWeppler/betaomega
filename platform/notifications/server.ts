import "server-only";
import { after } from "next/server";
import webpush, { WebPushError } from "web-push";
import { defaultPanelHosts } from "@/lib/sites";
import { panelTable } from "@/platform/db";
import { getPanelSite } from "@/platform/sites/server";
import { bookkeeping, deliver, pushResult, telegramResult, type Channels, type Destination, type PushDestination, type TelegramDestination } from "./deliver";
import { buildNotice, panelOrigin, type NoticeInput } from "./index";

// Sending the panel's notices (docs/tareas-notificaciones.md, point 2). Sites raise them with notify(); it answers at once and the sending runs
// after the response, so a slow or failing channel never delays nor undoes a booking, a payment or a comment.

const missing = "Faltan las tablas de avisos: corré supabase/schema.sql.";
const SEND_TIMEOUT_MS = 5_000;
/** How long a push service keeps a notice for a phone that is off: half a day. */
const PUSH_TTL_SECONDS = 12 * 3_600;

type PushRow = { id: string; endpoint: string; p256dh: string; auth: string; site_ids: string[]; failures: number };
type ChatRow = { id: string; chat_id: string | number; site_ids: string[]; failures: number };

const pushTable = panelTable<PushRow>("panel_push_subscriptions", missing);
const chatTable = panelTable<ChatRow>("panel_telegram_chats", missing);

/** The VAPID keys, or null while they are not set: then push is off. */
export function vapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

const telegramToken = () => process.env.TELEGRAM_BOT_TOKEN || null;

/** The real channels. A missing configuration leaves its channel null, so its destinations wait without counting failures. */
function channels(): Channels {
  const keys = vapidKeys();
  const token = telegramToken();
  return {
    push: keys ? async (destination, payload) => {
      try {
        const answer = await webpush.sendNotification({ endpoint: destination.endpoint, keys: { p256dh: destination.p256dh, auth: destination.auth } }, payload, {
          vapidDetails: keys, TTL: PUSH_TTL_SECONDS, urgency: "high", timeout: SEND_TIMEOUT_MS,
        });
        return pushResult(answer.statusCode);
      } catch (error) {
        return pushResult(error instanceof WebPushError ? error.statusCode : undefined);
      }
    } : null,
    telegram: token ? async (destination, text, url) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        body: JSON.stringify({
          chat_id: destination.chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true },
          // Telegram only accepts public https addresses on a button: on a local panel the message goes without it.
          ...(url.startsWith("https://") ? { reply_markup: { inline_keyboard: [[{ text: "Abrir en el panel", url }]] } } : {}),
        }),
      });
      const answer = await response.json().catch(() => ({})) as { description?: string };
      return telegramResult(response.status, answer.description);
    } : null,
  };
}

async function destinations(): Promise<Destination[]> {
  const [phones, chats] = await Promise.all([
    pushTable("select=id,endpoint,p256dh,auth,site_ids,failures&limit=200"),
    chatTable("select=id,chat_id,site_ids,failures&limit=200"),
  ]);
  return [
    ...phones.map((row): PushDestination => ({ kind: "push", id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth, siteIds: row.site_ids ?? [], failures: row.failures })),
    ...chats.map((row): TelegramDestination => ({ kind: "telegram", id: row.id, chatId: String(row.chat_id), siteIds: row.site_ids ?? [], failures: row.failures })),
  ];
}

const tableOf = (destination: Destination) => (destination.kind === "push" ? pushTable : chatTable);
const ids = (items: Destination[]) => `id=in.(${items.map(item => item.id).join(",")})`;

/** Writes back what the channels answered: gone destinations are deleted, delivered ones reset their failures. */
async function record(outcomes: Awaited<ReturnType<typeof deliver>>) {
  const { remove, sent, failed } = bookkeeping(outcomes);
  const now = new Date().toISOString();
  const writes: Promise<unknown>[] = [];
  for (const kind of ["push", "telegram"] as const) {
    const table = kind === "push" ? pushTable : chatTable;
    const gone = remove.filter(item => item.kind === kind);
    const ok = sent.filter(item => item.kind === kind);
    if (gone.length) writes.push(table(ids(gone), { method: "DELETE" }));
    if (ok.length) writes.push(table(ids(ok), { method: "PATCH", body: JSON.stringify({ failures: 0, last_sent_at: now }), headers: { Prefer: "return=minimal" } }));
  }
  for (const { destination, failures } of failed) {
    writes.push(tableOf(destination)(`id=eq.${destination.id}`, { method: "PATCH", body: JSON.stringify({ failures }), headers: { Prefer: "return=minimal" } }));
  }
  await Promise.allSettled(writes);
}

/** A notice without its site's name: the server looks it up, so the callers only pass the site's id. */
export type RaisedNotice = NoticeInput extends infer T ? T extends unknown ? Omit<T, "siteName"> : never : never;

/** Sends one notice now. Exported for the panel's test button; the sites use notify(). Never throws. */
export async function sendNotice(raised: RaisedNotice): Promise<{ sent: number; failed: number }> {
  try {
    const origin = panelOrigin(process.env.PANEL_HOSTS || defaultPanelHosts);
    if (!origin) return { sent: 0, failed: 0 };
    const site = await getPanelSite(raised.siteId);
    const notice = buildNotice({ ...raised, siteName: site?.name ?? raised.siteId } as NoticeInput);
    const outcomes = await deliver(notice, await destinations(), origin, channels());
    await record(outcomes);
    return { sent: outcomes.filter(item => item.result === "sent").length, failed: outcomes.filter(item => item.result !== "sent").length };
  } catch (error) {
    // Logged without the notice's text: it names a person.
    console.error("[notifications] send failed:", raised.event, error instanceof Error ? error.message.slice(0, 160) : "error");
    return { sent: 0, failed: 0 };
  }
}

/** Raises a notice. Returns at once: the sending runs after the response (next/server `after`). Call it only once the thing it tells happened. */
export function notify(raised: RaisedNotice) {
  after(() => sendNotice(raised));
}
