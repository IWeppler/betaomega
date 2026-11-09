import { createHmac } from "node:crypto";
import { sameOrigin } from "@/platform/auth/server";
import { getPanelSite, getSite } from "@/platform/sites/server";
import { accessTokenFor, readAccount } from "../data/mercadopago-account";
import { createPreference, fetchPayment, MercadoPagoError, mercadoPagoApp } from "../data/mercadopago";
import { chooseTransfer, confirmPayment, paymentTargetById, paymentTargetByToken, type PaymentTarget } from "../data/payments";
import { choosePlanTransfer, confirmPlanPayment, planPurchaseById, planPurchaseByToken, type PlanPurchase } from "../data/plans";
import { effectiveStatus } from "../domain/booking";
import { approvedPayment, approvedPlanPayment, cleanPaymentId, isSigned, ledgerRaw, preferenceBody } from "../domain/mercadopago";
import { transferOutcomeMessages, transferRejectionMessages, type PaymentOutcome } from "../domain/rejections";
import { businessDate, businessTime, dayLabel } from "../domain/time";
import { after } from "next/server";
import { notify, sendNotice } from "@/platform/notifications/server";
import { fail, failure, readJson, type SiteContext } from "./route-tools";

/** Tells the panel how a payment from Mercado Pago ended. A repeated payment says nothing: it was told the first time. Runs after the response. */
async function notifyPayment(siteId: string, outcome: PaymentOutcome, paid: { bookingId?: string; purchaseId?: string }) {
  if (outcome === "duplicate") return;
  const about = paid.purchaseId
    ? await planPurchaseById(siteId, paid.purchaseId).then(purchase => purchase?.bookings[0] && { customerName: purchase.bookings[0].customerName, startsAt: purchase.bookings[0].startsAt })
    : paid.bookingId ? await paymentTargetById(siteId, paid.bookingId) : null;
  if (!about) return;
  if (outcome === "confirmed" || outcome === "late_confirmed") {
    await sendNotice({ siteId, event: "sauna.payment_confirmed", customerName: about.customerName, startsAt: about.startsAt, late: outcome === "late_confirmed" });
  } else {
    await sendNotice({ siteId, event: "sauna.payment_problem", customerName: about.customerName, outcome });
  }
}

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
    // A turn of a plan is paid with the plan, from the plan's page.
    if (target.planPurchaseId) return notAwaiting();
    const now = new Date().toISOString();
    if (!awaitsPayment(target, now)) return notAwaiting();

    if (method === "transfer") {
      const result = await chooseTransfer(site.id, target.id, PUBLIC_ACTOR);
      if (!result.ok) return fail(409, transferRejectionMessages[result.reason] ?? transferRejectionMessages.invalid_request);
      // Only the first choice is news: choosing again keeps the same hold.
      if (target.status === "held") notify({ siteId: site.id, event: "sauna.transfer_chosen", customerName: target.customerName, startsAt: target.startsAt, amountCents: target.depositCents });
      return Response.json({ ok: true });
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

/** What the deposit of a plan is now: the sum of its turns' deposits, and the hold they share. Null when the plan does not wait for a payment. */
export function planDue(purchase: PlanPurchase, now: string) {
  const statuses = purchase.bookings.map(booking => effectiveStatus(booking, now));
  if (!statuses.length || !statuses.every(status => status === "held" || status === "pending_transfer")) return null;
  const depositCents = purchase.bookings.reduce((sum, booking) => sum + booking.depositCents, 0);
  const holds = purchase.bookings.map(booking => booking.expiresAt).filter((value): value is string => value !== null).sort();
  return depositCents > 0 && holds.length ? { depositCents, expiresAt: holds[0], transfer: statuses.every(status => status === "pending_transfer") } : null;
}

/** POST { token, method } for a plan: the same as postPayment, for every turn at once. */
export async function postPlanPayment(request: Request, context: SiteContext) {
  if (!sameOrigin(request)) return fail(403, "Origen no permitido.");
  const site = await getSite((await context.params).site);
  if (site?.kind !== "sauna") return fail(404, "Sitio no encontrado.");
  try {
    const body = await readJson(request, 500) as { token?: unknown; method?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token : "";
    const method = body?.method;
    if (method !== "transfer" && method !== "mercadopago") return fail(400, transferRejectionMessages.invalid_request);
    const purchase = await planPurchaseByToken(site.id, token);
    if (!purchase) return fail(404, "No encontramos tu plan.");
    const now = new Date().toISOString();
    const due = planDue(purchase, now);
    if (!due) return notAwaiting();

    if (method === "transfer") {
      const result = await choosePlanTransfer(site.id, purchase.id, PUBLIC_ACTOR);
      if (!result.ok) return fail(409, transferRejectionMessages[result.reason] ?? transferRejectionMessages.invalid_request);
      if (!due.transfer) {
        notify({ siteId: site.id, event: "sauna.transfer_chosen", customerName: purchase.bookings[0].customerName, startsAt: purchase.bookings[0].startsAt, amountCents: due.depositCents });
      }
      return Response.json({ ok: true });
    }

    const accessToken = await accessTokenFor(site.id);
    if (!accessToken) return fail(409, "El pago con Mercado Pago no está disponible por ahora. Escribinos por WhatsApp.");
    const origin = request.headers.get("origin") ?? site.url;
    const url = await createPreference(accessToken, preferenceBody({
      bookingId: purchase.id,
      plan: true,
      title: `Seña ${site.name} · ${purchase.name} · ${purchase.turns} turnos`,
      depositCents: due.depositCents,
      expiresAt: due.expiresAt,
      now,
      returnUrl: `${origin}/plan/${token}`,
      notificationUrl: `${site.url}/api/sites/${site.id}/sauna/mercadopago?source_news=webhooks`,
    }));
    return Response.json({ url });
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      console.error("[sauna mercadopago] plan preference failed:", error.message);
      return fail(502, "Mercado Pago no respondió. Probá de nuevo en un momento.");
    }
    return failure(error, "iniciar el pago");
  }
}

/**
 * Asks Mercado Pago for the payment and applies it only if it is approved, in pesos and for a booking or a plan of this site. `only` narrows it to
 * one booking or one plan purchase, for the return from the checkout. Returns whether something was recorded.
 */
async function settle(siteId: string, accessToken: string, paymentId: string, only?: { bookingId?: string; purchaseId?: string }) {
  const payment = await fetchPayment(accessToken, paymentId);
  const approved = approvedPayment(payment);
  const forPlan = approved ? null : approvedPlanPayment(payment);
  if (!approved && !forPlan) return null;
  if (only && (approved ? approved.bookingId !== only.bookingId : forPlan?.purchaseId !== only.purchaseId)) return null;
  const result = approved
    ? await confirmPayment(siteId, { ...approved, method: "mercadopago", actor: PROVIDER_ACTOR, raw: ledgerRaw(payment) })
    : forPlan ? await confirmPlanPayment(siteId, { ...forPlan, method: "mercadopago", actor: PROVIDER_ACTOR, raw: ledgerRaw(payment) }) : null;
  if (!result) return null;
  if (result.ok) {
    const outcome = result.outcome;
    const paid = approved ? { bookingId: approved.bookingId } : { purchaseId: forPlan?.purchaseId };
    after(() => notifyPayment(siteId, outcome, paid).catch(() => undefined));
  }
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
    return accessToken ? await settle(siteId, accessToken, paymentId, { bookingId: target.id }) : null;
  } catch (error) {
    console.error("[sauna mercadopago] return check failed:", error instanceof Error ? error.message.slice(0, 200) : "error");
    return null;
  }
}

/** The return from the checkout of a plan: the same as settleReturnedPayment, for the plan's payment. */
export async function settleReturnedPlanPayment(siteId: string, purchaseId: string, rawPaymentId: unknown) {
  const paymentId = cleanPaymentId(rawPaymentId);
  if (!paymentId) return null;
  try {
    const accessToken = await accessTokenFor(siteId);
    return accessToken ? await settle(siteId, accessToken, paymentId, { purchaseId }) : null;
  } catch (error) {
    console.error("[sauna mercadopago] plan return check failed:", error instanceof Error ? error.message.slice(0, 200) : "error");
    return null;
  }
}

/** A transfer for a plan pays all its turns: the amount is the sum of their deposits. */
async function recordPlanTransfer(siteId: string, purchaseId: string, actor: string) {
  const purchase = await planPurchaseById(siteId, purchaseId);
  if (!purchase) return { ok: false as const, status: 404, error: "No encontramos ese plan." };
  if (!purchase.bookings.every(booking => booking.status === "pending_transfer")) return { ok: false as const, status: 409, error: "El plan no está esperando una transferencia. Recargá la página." };
  const amountCents = purchase.bookings.reduce((sum, booking) => sum + booking.depositCents, 0);
  const result = await confirmPlanPayment(siteId, { purchaseId, ref: `transfer:plan:${purchaseId}`, amountCents, method: "transfer", actor, raw: null });
  if (!result.ok) return { ok: false as const, status: 409, error: "No se pudo registrar la transferencia. Recargá la página." };
  return { ok: true as const, outcome: result.outcome, message: `Plan ${purchase.name}: ${transferOutcomeMessages[result.outcome]}` };
}

/** The panel recorded the transfer it saw in the account: the amount is the booking's deposit, and repeating it records nothing more. */
export async function recordTransfer(siteId: string, bookingId: string, actor: string) {
  const target = await paymentTargetById(siteId, bookingId);
  if (!target) return { ok: false as const, status: 404, error: "No encontramos esa reserva." };
  if (target.planPurchaseId) return recordPlanTransfer(siteId, target.planPurchaseId, actor);
  if (target.status !== "pending_transfer" || target.depositCents < 1) return { ok: false as const, status: 409, error: "La reserva no está esperando una transferencia. Recargá la página." };
  const result = await confirmPayment(siteId, { bookingId, ref: `transfer:${bookingId}`, amountCents: target.depositCents, method: "transfer", actor, raw: null });
  if (!result.ok) return { ok: false as const, status: 409, error: "No se pudo registrar la transferencia. Recargá la página." };
  return { ok: true as const, outcome: result.outcome, message: transferOutcomeMessages[result.outcome] };
}

/** Whether the public site offers Mercado Pago: the application is set up and the site has an account connected. */
export const paymentOptionsOf = async (siteId: string) => ({ mercadopago: mercadoPagoApp() !== null && await readAccount(siteId) !== null });
