import type { Cents } from "../../../platform/money/index.ts";
import type { Instant } from "./booking.ts";

// Mercado Pago, Checkout Pro (docs/SAUNA.md §6). Pure rules only: building a preference, checking a notification's signature and reading a payment.

/** What a payment's external_reference says it pays. Packs (phase S4b) will use their own prefix. */
const BOOKING_PREFIX = "booking:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const bookingReference = (bookingId: string) => `${BOOKING_PREFIX}${bookingId}`;

export function bookingOfReference(reference: unknown): string | null {
  if (typeof reference !== "string" || !reference.startsWith(BOOKING_PREFIX)) return null;
  const id = reference.slice(BOOKING_PREFIX.length);
  return UUID.test(id) ? id.toLowerCase() : null;
}

/** The ledger's idempotency key (docs/PATTERNS.md, pattern 12): the same payment notified twice is one row. */
export const paymentRef = (paymentId: string) => `mp:${paymentId}`;

/** Mercado Pago works in pesos with two decimals; the system, in whole cents. Rounding only absorbs the float's binary noise. */
export const centsToAmount = (cents: Cents) => cents / 100;
export const amountToCents = (amount: number): Cents | null => (Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null);

/** Argentina keeps UTC−3 all year. Mercado Pago asks for dates with their offset, so instants go out in that form. */
export function argentineDate(instant: Instant): string {
  const shifted = new Date(Date.parse(instant) - 3 * 3_600_000).toISOString();
  return `${shifted.slice(0, 23)}-03:00`;
}

export type PreferenceInput = {
  bookingId: string;
  title: string;
  depositCents: Cents;
  /** The hold's end: the preference stops accepting payments with it, so a late payment is rare. */
  expiresAt: Instant;
  now: Instant;
  /** The person's own booking page, where Mercado Pago sends them back. */
  returnUrl: string;
  notificationUrl: string;
};

/**
 * The body of POST /checkout/preferences. binary_mode leaves a payment approved or rejected, never pending, and cash and ATM payments are excluded: both
 * would confirm hours after the hold lapsed. One installment, because the deposit is small and the owner absorbs the fee (docs/SAUNA.md §6).
 */
export function preferenceBody(input: PreferenceInput) {
  const secure = input.returnUrl.startsWith("https://");
  return {
    items: [{ id: input.bookingId, title: input.title.slice(0, 120), quantity: 1, unit_price: centsToAmount(input.depositCents), currency_id: "ARS" }],
    external_reference: bookingReference(input.bookingId),
    notification_url: input.notificationUrl,
    back_urls: { success: input.returnUrl, pending: input.returnUrl, failure: input.returnUrl },
    // Mercado Pago refuses auto_return with a return address that is not https, as on a local server.
    ...(secure ? { auto_return: "approved" } : {}),
    binary_mode: true,
    expires: true,
    expiration_date_from: argentineDate(input.now),
    expiration_date_to: argentineDate(input.expiresAt),
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 1 },
  };
}

/** The x-signature header: `ts=…,v1=…`, in any order. */
export function parseSignature(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(header.split(",").map(part => part.split("=").map(text => text.trim())).filter(pair => pair.length === 2));
  return /^\d{1,15}$/.test(parts.ts ?? "") && /^[0-9a-f]{64}$/i.test(parts.v1 ?? "") ? { ts: parts.ts, v1: parts.v1.toLowerCase() } : null;
}

/** The text Mercado Pago signs. A value the notification did not carry is left out, and an alphanumeric id goes in lowercase. */
export function signatureManifest({ dataId, requestId, ts }: { dataId: string | null; requestId: string | null; ts: string }) {
  return `${dataId ? `id:${dataId.toLowerCase()};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
}

/**
 * Whether a notification comes from Mercado Pago. `sign` is HMAC-SHA256 of a text with the site's secret, in hex (api/payments.ts): this file stays free of
 * node:crypto. The comparison looks at every character, so how long it takes says nothing about how much of a forged signature was right.
 */
export function isSigned(notice: { signature: string | null; dataId: string | null; requestId: string | null }, sign: (manifest: string) => string): boolean {
  const parsed = parseSignature(notice.signature);
  if (!parsed) return false;
  const expected = sign(signatureManifest({ dataId: notice.dataId, requestId: notice.requestId, ts: parsed.ts })).toLowerCase();
  if (expected.length !== parsed.v1.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ parsed.v1.charCodeAt(index);
  return difference === 0;
}

/** What GET /v1/payments/{id} answers, only the fields read. */
export type ProviderPayment = {
  id?: unknown; status?: unknown; status_detail?: unknown; currency_id?: unknown; transaction_amount?: unknown; external_reference?: unknown;
  payment_method_id?: unknown; payment_type_id?: unknown; date_approved?: unknown;
};

/** What the ledger keeps of a payment, for an audit. Nothing about the payer: their name, email and document stay with Mercado Pago. */
export const ledgerRaw = ({ id, status, status_detail, payment_method_id, payment_type_id, date_approved, transaction_amount, currency_id }: ProviderPayment) =>
  ({ id, status, status_detail, payment_method_id, payment_type_id, date_approved, transaction_amount, currency_id });

export type ApprovedPayment = { bookingId: string; ref: string; amountCents: Cents };

/** Only an approved payment in pesos for a booking moves anything. Everything else (pending, rejected, another app's payment) is ignored. */
export function approvedPayment(payment: ProviderPayment): ApprovedPayment | null {
  if (payment.status !== "approved" || payment.currency_id !== "ARS") return null;
  const id = typeof payment.id === "number" || typeof payment.id === "string" ? String(payment.id) : "";
  const bookingId = bookingOfReference(payment.external_reference);
  const amountCents = typeof payment.transaction_amount === "number" ? amountToCents(payment.transaction_amount) : null;
  if (!/^\d{1,20}$/.test(id) || !bookingId || amountCents === null) return null;
  return { bookingId, ref: paymentRef(id), amountCents };
}

/** A payment id as it comes in a notification or a return address. Anything else never reaches Mercado Pago's API. */
export const cleanPaymentId = (value: unknown): string | null => (typeof value === "string" && /^\d{1,20}$/.test(value) ? value : null);

// Connecting the owner's account (OAuth, authorization code with PKCE). The panel sends the person to Mercado Pago, they authorize the application, and
// Mercado Pago comes back with a code that the server exchanges for the account's tokens. The access token lasts 180 days and is renewed before that.

export const AUTHORIZATION_URL = "https://auth.mercadopago.com/authorization";

/** Where the panel sends the person to authorize. `state` ties the answer to this browser; `challenge` is the PKCE hash of a verifier kept on the server side. */
export function authorizationUrl({ clientId, redirectUri, state, challenge }: { clientId: string; redirectUri: string; state: string; challenge: string }) {
  const params = new URLSearchParams({
    client_id: clientId, response_type: "code", platform_id: "mp", state, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: "S256",
  });
  return `${AUTHORIZATION_URL}?${params}`;
}

export type AccountTokens = { accessToken: string; refreshToken: string; userId: string; expiresAt: Instant; liveMode: boolean };

/** What POST /oauth/token answers, checked. Null when something is missing: nothing half-connected is saved. */
export function tokensFrom(answer: unknown, now: Instant): AccountTokens | null {
  if (typeof answer !== "object" || answer === null) return null;
  const value = answer as Record<string, unknown>;
  const userId = typeof value.user_id === "number" || typeof value.user_id === "string" ? String(value.user_id) : "";
  const expiresIn = typeof value.expires_in === "number" && value.expires_in > 0 ? value.expires_in : null;
  if (typeof value.access_token !== "string" || !value.access_token || typeof value.refresh_token !== "string" || !value.refresh_token) return null;
  if (!/^\d{1,20}$/.test(userId) || expiresIn === null) return null;
  return {
    accessToken: value.access_token, refreshToken: value.refresh_token, userId,
    expiresAt: new Date(Date.parse(now) + expiresIn * 1000).toISOString(), liveMode: value.live_mode !== false,
  };
}

/** Renewed a week before it lapses, so a quiet week never leaves the site unable to charge. */
export const needsRefresh = (expiresAt: Instant, now: Instant) => Date.parse(expiresAt) - Date.parse(now) < 7 * 86_400_000;

/**
 * The one return address for every site. Mercado Pago only accepts a static redirect_uri, exactly one of those registered in the application, so the site
 * does not go in it: it travels in the start's cookie, next to the `state` that proves it.
 */
export const OAUTH_CALLBACK_PATH = "/api/mercadopago/oauth";

/**
 * The redirect_uri: MERCADOPAGO_REDIRECT_URL when it is set (the same text registered in the application), or this panel's own address otherwise, which
 * is enough locally. Null when the configured one is not a web address or lives on another host: the start's cookie would not reach it.
 */
export function oauthRedirect(configured: string | undefined, panelOrigin: string): string | null {
  if (!configured) return `${panelOrigin}${OAUTH_CALLBACK_PATH}`;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin === panelOrigin ? url.href : null;
  } catch { return null; }
}

const SITE_ID = "[a-z0-9][a-z0-9-]{1,38}";

/** The site, the `state` and the PKCE verifier travel together in one cookie: `<site>.<state>.<verifier>`, all URL-safe and without dots. */
export const oauthCookieValue = (siteId: string, state: string, verifier: string) => `${siteId}.${state}.${verifier}`;

export function readOauthCookie(value: string | undefined): { siteId: string; state: string; verifier: string } | null {
  const match = new RegExp(`^(${SITE_ID})\\.([A-Za-z0-9_-]{32,128})\\.([A-Za-z0-9_-]{43,128})$`).exec(value ?? "");
  return match ? { siteId: match[1], state: match[2], verifier: match[3] } : null;
}

/** Charges are in pesos and payments are only applied in ARS, so only an account of Mercado Pago Argentina can be connected. */
export const ARGENTINA = "MLA";

export type AccountProfile = { nickname: string; siteId: string };

/** What GET /users/me answers, only the name to show and the country of the account. Null when the country is missing. */
export function profileFrom(answer: unknown): AccountProfile | null {
  if (typeof answer !== "object" || answer === null) return null;
  const value = answer as Record<string, unknown>;
  if (typeof value.site_id !== "string" || !/^[A-Z]{3}$/.test(value.site_id)) return null;
  return { nickname: typeof value.nickname === "string" ? value.nickname.slice(0, 120) : "", siteId: value.site_id };
}
