import { pushPayload, telegramText, wantsNotice, type Notice } from "./index.ts";

// Sending one notice to every destination that wants it, with the channels passed in: the server entry gives the real ones (web-push and the
// Telegram Bot API) and the tests give fakes. Pure apart from what the channels do. Relative imports, so the tests run it under plain Node.

export type PushDestination = { kind: "push"; id: string; endpoint: string; p256dh: string; auth: string; siteIds: string[]; failures: number };
export type TelegramDestination = { kind: "telegram"; id: string; chatId: string; siteIds: string[]; failures: number };
export type Destination = PushDestination | TelegramDestination;

/** What a channel answered: delivered, the destination no longer exists, or a failure worth trying again next time. */
export type SendResult = "sent" | "gone" | "failed";

export type Channels = {
  /** Null when the channel is not configured (no keys or no bot): its destinations are skipped without counting a failure. */
  push: ((destination: PushDestination, payload: string) => Promise<SendResult>) | null;
  telegram: ((destination: TelegramDestination, text: string, url: string) => Promise<SendResult>) | null;
};

export type Outcome = { destination: Destination; result: SendResult };

/** After this many failures in a row a destination is dropped: a phone that was reset or a chat that changed never answers again. */
export const MAX_FAILURES = 30;

/** web-push's answer: 404 and 410 say the subscription is gone (the person turned it off or reinstalled). */
export const pushResult = (status: number | undefined): SendResult =>
  status !== undefined && status >= 200 && status < 300 ? "sent" : status === 404 || status === 410 ? "gone" : "failed";

/** Telegram's answer: 403 is a blocked bot or a deleted chat, and a 400 that says the chat is not found means the same. */
export function telegramResult(status: number, description = ""): SendResult {
  if (status >= 200 && status < 300) return "sent";
  if (status === 403 || (status === 400 && /chat not found|user is deactivated/i.test(description))) return "gone";
  return "failed";
}

/** Sends to every destination that wants the notice, all at once. A channel that throws counts as a failure; nothing is thrown. */
export async function deliver(notice: Notice, destinations: readonly Destination[], origin: string, channels: Channels): Promise<Outcome[]> {
  const url = `${origin}${notice.path}`;
  const targets = destinations.filter(destination => wantsNotice(destination, notice.siteId, notice.event) && channels[destination.kind] !== null);
  const results = await Promise.allSettled(targets.map(destination => destination.kind === "push"
    ? channels.push!(destination, pushPayload(notice, origin))
    : channels.telegram!(destination, telegramText(notice), url)));
  return targets.map((destination, index) => {
    const settled = results[index];
    return { destination, result: settled.status === "fulfilled" ? settled.value : "failed" };
  });
}

/** What to write back: which destinations to delete, which delivered, and the new failure count of the rest. */
export function bookkeeping(outcomes: readonly Outcome[]) {
  const remove: Destination[] = [];
  const sent: Destination[] = [];
  const failed: { destination: Destination; failures: number }[] = [];
  for (const { destination, result } of outcomes) {
    if (result === "gone" || (result === "failed" && destination.failures + 1 >= MAX_FAILURES)) remove.push(destination);
    else if (result === "sent") sent.push(destination);
    else failed.push({ destination, failures: destination.failures + 1 });
  }
  return { remove, sent, failed };
}
