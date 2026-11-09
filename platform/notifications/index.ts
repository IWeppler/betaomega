import { formatCents, type Cents } from "../money/index.ts";

// Notices of the panel (docs/tareas-notificaciones.md): what happened in a site, told to a phone by push or by Telegram. Pure rules only: the events,
// their text and link, who wants them and the Telegram link codes. Sending lives in the server entry. It is in platform/ and not in a module because
// both a module (the sauna) and the existing code (recipes) raise notices, and neither may import a module.
// Imports are relative with their extension, like platform/money: the tests run it under plain Node.

export const noticeEvents = ["sauna.booking_new", "sauna.transfer_chosen", "sauna.payment_confirmed", "sauna.payment_problem", "recetas.comment_new", "panel.test"] as const;
export type NoticeEvent = (typeof noticeEvents)[number];

type Site = { siteId: string; siteName: string };

/** What a site reports. Only what the text needs: never the person's WhatsApp, and the name is cut to its first word before it is written. */
export type NoticeInput = Site & (
  | { event: "sauna.booking_new"; customerName: string; startsAt: string; depositDueCents: Cents; plan: { name: string; turns: number } | null }
  | { event: "sauna.transfer_chosen"; customerName: string; startsAt: string; amountCents: Cents }
  | { event: "sauna.payment_confirmed"; customerName: string; startsAt: string; late: boolean }
  | { event: "sauna.payment_problem"; customerName: string; outcome: "no_seat" | "amount_mismatch" | "unapplied" }
  | { event: "recetas.comment_new"; recipeTitle: string }
  /** The panel's "Probar" button: reaches every destination, whatever sites it chose. */
  | { event: "panel.test"; destinationLabel: string }
);

/** One notice, ready for any channel. `path` is the panel page it opens; `tag` groups notices that replace each other on the phone. */
export type Notice = { event: NoticeEvent; siteId: string; title: string; body: string; path: string; tag: string };

/** The longest body a phone shows whole; longer texts are cut with an ellipsis. */
export const BODY_MAX = 180;
/** Telegram refuses messages over 4096 characters. */
export const TELEGRAM_MAX = 4096;

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** The first word of a name, or a neutral word for an anonymized person. */
export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first ? clip(first, 40) : "Alguien";
}

const weekdays = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** "sáb 14/11 19:00", in Buenos Aires time. The weekday is written by hand: Intl's Spanish output differs between runtimes. */
export function shortWhen(instant: string): string {
  const values = Object.fromEntries(parts.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  const weekday = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day))).getUTCDay();
  return `${weekdays[weekday]} ${values.day}/${values.month} ${values.hour}:${values.minute}`;
}

const problems: Record<Extract<NoticeInput, { event: "sauna.payment_problem" }>["outcome"], string> = {
  no_seat: "pagó cuando el turno ya no estaba libre",
  amount_mismatch: "pagó un monto que no coincide con la seña",
  unapplied: "pagó una reserva que ya no esperaba el pago",
};

/** The text and the link of an event. */
export function buildNotice(input: NoticeInput): Notice {
  const base = { event: input.event, siteId: input.siteId, title: clip(input.siteName, 60) };
  const page = (section: string) => `/${input.siteId}/${section}`;
  let body: string;
  let path: string;
  let tag: string;
  switch (input.event) {
    case "sauna.booking_new": {
      const what = input.plan ? `Nuevo ${input.plan.name} (${input.plan.turns} turnos)` : "Nueva reserva";
      const from = input.plan ? `desde el ${shortWhen(input.startsAt)}` : shortWhen(input.startsAt);
      body = `${what}: ${firstName(input.customerName)}, ${from}.${input.depositDueCents > 0 ? ` Falta la seña de ${formatCents(input.depositDueCents)}.` : " Confirmada."}`;
      path = page("reservas");
      tag = `${input.event}:${input.siteId}:${input.startsAt}`;
      break;
    }
    case "sauna.transfer_chosen":
      body = `${firstName(input.customerName)} va a transferir ${formatCents(input.amountCents)} por el ${shortWhen(input.startsAt)}. Revisá la cuenta y confirmala.`;
      path = page("reservas");
      tag = `${input.event}:${input.siteId}:${input.startsAt}`;
      break;
    case "sauna.payment_confirmed":
      body = `Seña pagada: ${firstName(input.customerName)}, ${shortWhen(input.startsAt)}. ${input.late ? "Llegó tarde, pero el turno seguía libre: confirmada." : "Reserva confirmada."}`;
      path = page("agenda");
      tag = `${input.event}:${input.siteId}:${input.startsAt}`;
      break;
    case "sauna.payment_problem":
      body = `Pago para devolver: ${firstName(input.customerName)} ${problems[input.outcome]}. Revisalo en el panel.`;
      path = page("");
      tag = `${input.event}:${input.siteId}`;
      break;
    case "recetas.comment_new":
      body = `Comentario por aprobar en "${clip(input.recipeTitle.trim() || "una receta", 80)}".`;
      path = page("comentarios");
      // One notice per site: a new comment replaces the previous one on the phone instead of stacking.
      tag = `${input.event}:${input.siteId}`;
      break;
    case "panel.test":
      body = `Prueba${input.destinationLabel ? ` desde ${clip(input.destinationLabel, 60)}` : ""}: los avisos llegan bien.`;
      path = page("avisos");
      tag = input.event;
      break;
  }
  return { ...base, body: clip(body, BODY_MAX), path: path.replace(/\/$/, ""), tag };
}

/** A destination with no sites chosen wants every site. A test reaches everyone. */
export const wantsNotice = (destination: { siteIds: readonly string[] }, siteId: string, event?: NoticeEvent) =>
  event === "panel.test" || destination.siteIds.length === 0 || destination.siteIds.includes(siteId);

/** A push subscription as the browser gives it (PushSubscription.toJSON()), or null if it is not one. Only https push services. */
export function cleanSubscription(value: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  const key = /^[A-Za-z0-9_-]+=*$/;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) return null;
  if (typeof p256dh !== "string" || !key.test(p256dh) || p256dh.length > 200 || typeof auth !== "string" || !key.test(auth) || auth.length > 100) return null;
  try { new URL(endpoint); } catch { return null; }
  return { endpoint, p256dh, auth };
}

/** The VAPID public key in the form PushManager.subscribe asks for. */
export function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** Where the panel answers: the first of PANEL_HOSTS, over https except on a local host. */
export function panelOrigin(hosts: string | undefined): string | null {
  const host = (hosts ?? "").split(",").map(item => item.trim()).find(Boolean);
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return null;
  const local = /(^|\.)localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

/** What the service worker receives. Small on purpose: push services refuse payloads over about 4 KB. */
export const pushPayload = (notice: Notice, origin: string) =>
  JSON.stringify({ title: notice.title, body: notice.body, url: `${origin}${notice.path}`, tag: notice.tag });

/** Telegram's HTML mode only needs these three escaped. */
export const escapeTelegram = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The message body for Telegram's sendMessage with parse_mode HTML. */
export const telegramText = (notice: Notice) => clip(`<b>${escapeTelegram(notice.title)}</b>\n${escapeTelegram(notice.body)}`, TELEGRAM_MAX);

// Linking a Telegram chat: the panel creates a code, the person opens t.me/<bot>?start=<code> and the bot receives "/start <code>". The database only
// keeps the code's hash; a code lasts 10 minutes and works once.

export const LINK_CODE_TTL_MS = 10 * 60_000;
/** Telegram's start parameter allows up to 64 of these characters. */
const LINK_CODE = /^[A-Za-z0-9_-]{32,64}$/;

export const isLinkCode = (value: unknown): value is string => typeof value === "string" && LINK_CODE.test(value);

/** 32 random bytes as base64url: 43 characters, inside what Telegram accepts. */
export function newLinkCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The code of "/start <code>", or null for any other message. */
export function startCode(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const match = /^\/start(?:@\w+)?\s+(\S+)\s*$/.exec(text.trim());
  return match && isLinkCode(match[1]) ? match[1] : null;
}

/** A stored code can be used if it was not used yet and has not expired. */
export const linkCodeUsable = (link: { expiresAt: string; usedAt: string | null }, now: string) =>
  link.usedAt === null && Date.parse(link.expiresAt) > Date.parse(now);

export const linkExpiry = (now: string) => new Date(Date.parse(now) + LINK_CODE_TTL_MS).toISOString();

/** The sites a destination chose, kept to known ids. Empty means every site. */
export function cleanSiteIds(value: unknown, known: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && known.includes(item)))];
}

/** The name a person gives a phone ("Celular de Ana"), trimmed and short. */
export const cleanLabel = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 60) : "");
