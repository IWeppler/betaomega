import { createHmac } from "node:crypto";
import { sameOrigin } from "@/platform/auth/server";
import { getPanelSite, getSite } from "@/platform/sites/server";
import { accessTokenFor, readAccount } from "../data/mercadopago-account";
import { createPreference, fetchPayment, MercadoPagoError, mercadoPagoApp } from "../data/mercadopago";
import { chooseTransfer, confirmPayment, paymentTargetById, paymentTargetByToken, type PaymentTarget } from "../data/payments";
import { effectiveStatus } from "../domain/booking";
import { approvedPayment, cleanPaymentId, isSigned, ledgerRaw, preferenceBody } from "../domain/mercadopago";
import { transferOutcomeMessages, transferRejectionMessages } from "../domain/rejections";
import { businessDate, businessTime, dayLabel } from "../domain/time";
import { fail, failure, readJson, type SiteContext } from "./route-tools";

// Paying the deposit (docs/SAUNA.md §6). The browser only says which booking and how; the amount is the deposit stored in the booking.

const PUBLIC_ACTOR = "cliente";
const PROVIDER_ACTOR = "mercadopago";

const awaitsPayment = (target: PaymentTarget, now: string) => {
  const status = effectiveStatus(target, now);
  return (status === "held" || status === "pending_transfer") && target.depositCents > 0;
};

const notAwaiting = () => fail(409, transferRejectionMessages.invalid_status);

/** POST { token, method }: a transfer keeps the seat for longer; Mercado Pago answers where to go to pay. */
export async function postPayment(request: Request, context: SiteContext) {
  if (!sameOrigin(request)) return fail(403, "Origen no permitido.");
  const site = await getSite((await context.params).site);
  if (site?.kind !== "sauna") return fail(404, "Sitio no encontrado.");
  try {
    const body = await readJson(request, 500) as { token?: unknown; method?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token : "";
    const method = body?.method;
    if (method !== "transfer" && method !== "mercadopago") return fail(400, transferRejectionMessages.invalid_request);
    const target = await paymentTargetByToken(site.id, token);
    if (!target) return fail(404, transferRejectionMessages.not_found);
    const now = new Date().toISOString();
    if (!awaitsPayment(target, now)) return notAwaiting();

    if (method === "transfer") {
      const result = await chooseTransfer(site.id, target.id, PUBLIC_ACTOR);
      return result.ok ? Response.json({ ok: true }) : fail(409, transferRejectionMessages[result.reason] ?? transferRejectionMessages.invalid_request);
    }

    const accessToken = await accessTokenFor(site.id);
    if (!accessToken || !target.expiresAt) return fail(409, "El pago con Mercado Pago no está disponible por ahora. Escribinos por WhatsApp.");
    // sameOrigin guarantees the Origin header is this site's host: the person comes back to the address they are on.
    const origin = request.headers.get("origin") ?? site.url;
    const url = await createPreference(accessToken, preferenceBody({
      bookingId: target.id,
      title: `Seña ${site.name} · ${target.typeName ? `${target.typeName} · ` : ""}${dayLabel(businessDate(target.startsAt))} ${businessTime(target.startsAt)}`,
      depositCents: target.depositCents,
      expiresAt: target.expiresAt,
      now,
      returnUrl: `${origin}/reserva/${target.token}`,
      notificationUrl: `${site.url}/api/sites/${site.id}/sauna/mercadopago?source_news=webhooks`,
    }));
    return Response.json({ url });
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      console.error("[sauna mercadopago] preference failed:", error.message);
      return fail(502, "Mercado Pago no respondió. Probá de nuevo en un momento.");
    }
    return failure(error, "iniciar el pago");
  }
}

/**
 * Asks Mercado Pago for the payment and applies it only if it is approved, in pesos and for a booking of this site. `onlyBooking` narrows it to one
 * booking, for the return from the checkout. Returns whether something was recorded.
 */
async function settle(siteId: string, accessToken: string, paymentId: string, onlyBooking?: string) {
  const payment = await fetchPayment(accessToken, paymentId);
  const approved = approvedPayment(payment);
  if (!approved || (onlyBooking && approved.bookingId !== onlyBooking)) return null;
  const result = await confirmPayment(siteId, { ...approved, method: "mercadopago", actor: PROVIDER_ACTOR, raw: ledgerRaw(payment) });
  if (!result.ok) {
    // not_found: a payment of the same account for something else. Nothing to apply, and retrying would not change it.
    console.error("[sauna mercadopago] payment not applied:", result.reason);
    return null;
  }
  if (result.outcome !== "confirmed" && result.outcome !== "duplicate") console.error("[sauna mercadopago] payment outcome:", result.outcome);
  return result.outcome;
}

/**
 * The webhook. Its body is not trusted (docs/PATTERNS.md, pattern 12): the signature proves it comes from Mercado Pago, and the payment is asked again by its id.
 * 200 tells Mercado Pago to stop; a 500 makes it retry, which is what an unanswered query or a database failure needs.
 */
export async function postMercadoPagoNotice(request: Request, context: SiteContext) {
  // An inactive site still receives the payments that were started while it was open.
  const site = await getPanelSite((await context.params).site);
  if (site?.kind !== "sauna") return fail(404, "Sitio no encontrado.");
  const app = mercadoPagoApp();
  if (!app) return fail(404, "Sin Mercado Pago.");
  const params = new URL(request.url).searchParams;
  const dataId = params.get("data.id");
  const sign = (manifest: string) => createHmac("sha256", app.webhookSecret).update(manifest).digest("hex");
  if (!isSigned({ signature: request.headers.get("x-signature"), dataId, requestId: request.headers.get("x-request-id") }, sign)) {
    return fail(401, "Firma inválida.");
  }
  const body = await readJson(request, 10_000).catch(() => null) as { type?: unknown } | null;
  const type = params.get("type") ?? body?.type;
  const paymentId = cleanPaymentId(dataId);
  if (type !== "payment" || !paymentId) return new Response(null, { status: 200 });
  try {
    const accessToken = await accessTokenFor(site.id);
    // Without a usable account there is nothing to ask with: retrying would not change it until someone connects one, and the payment is still in Mercado Pago.
    if (!accessToken) {
      console.error("[sauna mercadopago] notice without a connected account");
      return new Response(null, { status: 200 });
    }
    await settle(site.id, accessToken, paymentId);
    return new Response(null, { status: 200 });
  } catch (error) {
    // 401, 403 or 404: a payment of an account that is no longer the connected one. Retrying would only repeat the answer.
    if (error instanceof MercadoPagoError && error.status !== undefined && [401, 403, 404].includes(error.status)) {
      console.error("[sauna mercadopago] notice not readable with the connected account:", error.status);
      return new Response(null, { status: 200 });
    }
    console.error("[sauna mercadopago] notice failed:", error instanceof Error ? error.message.slice(0, 200) : "error");
    return fail(500, "Reintentar.");
  }
}

/**
 * The person came back from the checkout with a payment id. It is asked to Mercado Pago as the webhook does, so the page does not depend on the notice
 * arriving first, and it only counts for this booking. A failure here is not the person's problem: the webhook still applies it.
 */
export async function settleReturnedPayment(siteId: string, target: PaymentTarget, rawPaymentId: unknown) {
  const paymentId = cleanPaymentId(rawPaymentId);
  if (!paymentId) return null;
  try {
    const accessToken = await accessTokenFor(siteId);
    return accessToken ? await settle(siteId, accessToken, paymentId, target.id) : null;
  } catch (error) {
    console.error("[sauna mercadopago] return check failed:", error instanceof Error ? error.message.slice(0, 200) : "error");
    return null;
  }
}

/** The panel recorded the transfer it saw in the account: the amount is the booking's deposit, and repeating it records nothing more. */
export async function recordTransfer(siteId: string, bookingId: string, actor: string) {
  const target = await paymentTargetById(siteId, bookingId);
  if (!target) return { ok: false as const, status: 404, error: "No encontramos esa reserva." };
  if (target.status !== "pending_transfer" || target.depositCents < 1) return { ok: false as const, status: 409, error: "La reserva no está esperando una transferencia. Recargá la página." };
  const result = await confirmPayment(siteId, { bookingId, ref: `transfer:${bookingId}`, amountCents: target.depositCents, method: "transfer", actor, raw: null });
  if (!result.ok) return { ok: false as const, status: 409, error: "No se pudo registrar la transferencia. Recargá la página." };
  return { ok: true as const, outcome: result.outcome, message: transferOutcomeMessages[result.outcome] };
}

/** Whether the public site offers Mercado Pago: the application is set up and the site has an account connected. */
export const paymentOptionsOf = async (siteId: string) => ({ mercadopago: mercadoPagoApp() !== null && await readAccount(siteId) !== null });
