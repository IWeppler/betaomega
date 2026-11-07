import { randomUUID } from "node:crypto";
import { profileFrom, type AccountProfile, type ProviderPayment } from "../domain/mercadopago";

// Mercado Pago's REST API. Two kinds of credentials:
// - The application (one for the whole platform), in environment variables: MERCADOPAGO_CLIENT_ID, MERCADOPAGO_CLIENT_SECRET,
//   MERCADOPAGO_WEBHOOK_SECRET and, optionally, MERCADOPAGO_REDIRECT_URL (docs/ARCHITECTURE.md §9).
// - The account each site charges into, connected from the panel (mercadopago-account.ts). Its access token is what charges and reads payments.

const API = "https://api.mercadopago.com";
const TIMEOUT_MS = 10_000;

export class MercadoPagoError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export type MercadoPagoApp = { clientId: string; clientSecret: string; webhookSecret: string };

/** Null until the three are set: without the webhook secret no notification can be trusted, so charging would leave payments unconfirmed. */
export function mercadoPagoApp(): MercadoPagoApp | null {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID?.trim();
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET?.trim();
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  return clientId && clientSecret && webhookSecret ? { clientId, clientSecret, webhookSecret } : null;
}

async function call(path: string, init: RequestInit = {}, accessToken?: string): Promise<unknown> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) }).catch((error: unknown) => {
    throw new MercadoPagoError(`no answer (${error instanceof Error ? error.name : "error"})`);
  });
  // The body of an error can quote the payer or a token: only the status goes to the log.
  if (!response.ok) throw new MercadoPagoError(`${init.method ?? "GET"} ${path.split("/").slice(0, 3).join("/")} answered ${response.status}`, response.status);
  return response.json();
}

/** Returns where to send the person to pay. A new preference each time is harmless: an unpaid one simply expires with the hold. */
export async function createPreference(accessToken: string, body: unknown): Promise<string> {
  const answer = await call("/checkout/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": randomUUID() },
    body: JSON.stringify(body),
  }, accessToken) as { init_point?: unknown };
  if (typeof answer.init_point !== "string" || !answer.init_point.startsWith("https://")) throw new MercadoPagoError("preference without init_point");
  return answer.init_point;
}

/** The payment as Mercado Pago has it now. A notification's body is never trusted (docs/PATTERNS.md, pattern 12): this is what decides. */
export const fetchPayment = (accessToken: string, paymentId: string) => call(`/v1/payments/${paymentId}`, {}, accessToken) as Promise<ProviderPayment>;

const tokenRequest = (body: Record<string, string>) =>
  call("/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** The code Mercado Pago sent back after the person authorized, exchanged for the account's tokens. Valid for 10 minutes and once. */
export const exchangeCode = (app: MercadoPagoApp, code: string, redirectUri: string, verifier: string) =>
  tokenRequest({ client_id: app.clientId, client_secret: app.clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier });

export const refreshTokens = (app: MercadoPagoApp, refreshToken: string) =>
  tokenRequest({ client_id: app.clientId, client_secret: app.clientSecret, grant_type: "refresh_token", refresh_token: refreshToken });

/** The connected account's public name and country: the panel shows the name, and the country decides whether it can charge here. */
export async function accountProfile(accessToken: string): Promise<AccountProfile> {
  const profile = profileFrom(await call("/users/me", {}, accessToken));
  if (!profile) throw new MercadoPagoError("users/me without site_id");
  return profile;
}
