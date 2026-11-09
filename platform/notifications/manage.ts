import "server-only";
import { createHash } from "node:crypto";
import { defaultPanelHosts } from "@/lib/sites";
import { panelTable } from "@/platform/db";
import { linkCodeUsable, linkExpiry, newLinkCode, panelOrigin, startCode } from "./index";
import { vapidKeys } from "./server";

// Managing where the notices go (docs/tareas-notificaciones.md, points 3 and 4): the panel's phones and Telegram chats, and linking a chat through the
// bot. Only the routes of the panel and the Telegram webhook call this; they check the session or the webhook's secret first.

const missing = "Faltan las tablas de avisos: corré supabase/schema.sql.";

type PushRow = { id: string; endpoint: string; label: string; site_ids: string[]; last_sent_at: string | null; created_at: string };
type ChatRow = { id: string; chat_id: string | number; label: string; site_ids: string[]; last_sent_at: string | null; created_at: string };
type LinkRow = { id: string; label: string; site_ids: string[]; expires_at: string; used_at: string | null };

const pushTable = panelTable<PushRow>("panel_push_subscriptions", missing);
const chatTable = panelTable<ChatRow>("panel_telegram_chats", missing);
const linkTable = panelTable<LinkRow>("panel_telegram_links", missing);

/** One destination as the panel lists it. The push endpoint goes out only so the browser can tell which phone is itself. */
export type DestinationView = { kind: "push" | "telegram"; id: string; label: string; siteIds: string[]; lastSentAt: string | null; endpoint?: string };

export const telegramBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const username = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  return token && username && /^\w{5,32}$/.test(username) ? { token, username } : null;
};

/** What the Avisos screen needs: which channels are ready and every destination. */
export async function noticeSetup() {
  const [phones, chats] = await Promise.all([
    pushTable("select=id,endpoint,label,site_ids,last_sent_at,created_at&order=created_at.asc"),
    chatTable("select=id,chat_id,label,site_ids,last_sent_at,created_at&order=created_at.asc"),
  ]);
  const destinations: DestinationView[] = [
    ...phones.map(row => ({ kind: "push" as const, id: row.id, label: row.label, siteIds: row.site_ids ?? [], lastSentAt: row.last_sent_at, endpoint: row.endpoint })),
    ...chats.map(row => ({ kind: "telegram" as const, id: row.id, label: row.label, siteIds: row.site_ids ?? [], lastSentAt: row.last_sent_at })),
  ];
  return { pushKey: vapidKeys()?.publicKey ?? null, telegramBot: telegramBot()?.username ?? null, destinations };
}

/** Saves this phone, or updates it if the browser already had it: the endpoint is its identity. */
export async function savePushSubscription(subscription: { endpoint: string; p256dh: string; auth: string }, label: string, siteIds: string[]) {
  await pushTable("on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth, label, site_ids: siteIds, failures: 0 }),
  });
}

const tableOf = (kind: "push" | "telegram") => (kind === "push" ? pushTable : chatTable);
const UUID = /^[0-9a-f-]{36}$/i;

export async function updateDestination(kind: "push" | "telegram", id: string, label: string, siteIds: string[]) {
  if (!UUID.test(id)) return;
  await tableOf(kind)(`id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ label, site_ids: siteIds }) });
}

export async function removeDestination(kind: "push" | "telegram", id: string) {
  if (!UUID.test(id)) return;
  await tableOf(kind)(`id=eq.${id}`, { method: "DELETE" });
}

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

/** A code to link a chat, and the address that opens the bot with it. Old codes are cleared on the way, so the table stays small. */
export async function createTelegramLink(label: string, siteIds: string[]) {
  const bot = telegramBot();
  if (!bot) return null;
  const now = new Date().toISOString();
  const code = newLinkCode();
  const dayAgo = encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString());
  await linkTable(`created_at=lt.${dayAgo}`, { method: "DELETE" });
  await linkTable("", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ code_hash: hash(code), label, site_ids: siteIds, expires_at: linkExpiry(now) }) });
  return { url: `https://t.me/${bot.username}?start=${code}`, expiresAt: linkExpiry(now) };
}

async function telegram(method: string, body: Record<string, unknown>) {
  const bot = telegramBot();
  if (!bot) return null;
  const response = await fetch(`https://api.telegram.org/bot${bot.token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(5_000),
  });
  return await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
}

const reply = (chatId: number, text: string) => telegram("sendMessage", { chat_id: chatId, text }).catch(() => null);

/** The message for anything that is not a valid link: it says nothing about the panel or its sites. */
const UNKNOWN = "Este bot manda avisos de un panel privado. Para recibirlos, conectá este chat desde la pantalla Avisos del panel.";

type Update = { message?: { text?: unknown; chat?: { id?: unknown; type?: unknown } } };

/**
 * What the bot received. Only "/start <code>" in a private chat does something: the code is checked by its hash, marked as used in the same
 * statement that checks it is unused (so two messages cannot both use it) and the chat is saved with the label and sites chosen in the panel.
 */
export async function handleTelegramUpdate(update: Update) {
  const chatId = update.message?.chat?.id;
  if (typeof chatId !== "number") return;
  if (update.message?.chat?.type !== "private") { await reply(chatId, "Los avisos solo se mandan a un chat privado con el bot."); return; }
  const code = startCode(update.message?.text);
  if (!code) { await reply(chatId, UNKNOWN); return; }
  const now = new Date().toISOString();
  const [link] = await linkTable(`code_hash=eq.${hash(code)}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}`, {
    method: "PATCH", body: JSON.stringify({ used_at: now }),
  });
  if (!link || !linkCodeUsable({ expiresAt: link.expires_at, usedAt: null }, now)) {
    await reply(chatId, "Ese enlace venció o ya se usó. Pedí uno nuevo desde la pantalla Avisos del panel.");
    return;
  }
  await chatTable("on_conflict=chat_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ chat_id: chatId, label: link.label, site_ids: link.site_ids ?? [], failures: 0 }),
  });
  await reply(chatId, "Listo: este chat va a recibir los avisos del panel. Para dejar de recibirlos, quitalo desde la pantalla Avisos.");
}

/** Points the bot at this deployment's webhook. Telegram only calls https addresses, so it fails on a local panel. */
export async function registerTelegramWebhook() {
  const origin = panelOrigin(process.env.PANEL_HOSTS || defaultPanelHosts);
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!origin?.startsWith("https://") || !secret) return { ok: false, description: "Falta TELEGRAM_WEBHOOK_SECRET o el panel no está en https." };
  const answer = await telegram("setWebhook", { url: `${origin}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true });
  return { ok: Boolean(answer?.ok), description: answer?.description ?? "" };
}
