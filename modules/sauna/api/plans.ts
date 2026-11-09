import { sameOrigin } from "@/platform/auth/server";
import { getSite } from "@/platform/sites/server";
import { bookingsFromOrigin, markOrigin } from "../data/bookings";
import { listPlans, planPurchaseByToken, reservePlan, savePlan, type PlanTurnRequest } from "../data/plans";
import { listRooms, readSettings } from "../data/setup";
import { cleanArgentineWhatsapp, cleanName } from "../domain/customer";
import { ledgerOf } from "../domain/payments";
import { cleanPlan, PLAN_TURNS } from "../domain/plans";
import { planRejectionMessages, rejectionMessages, type PlanRejection, type ReserveRejection } from "../domain/rejections";
import { transferAccount } from "../domain/setup";
import { paymentOptionsOf, settleReturnedPlanPayment } from "./payments";
import { notify } from "@/platform/notifications/server";
import { fail, failure, noStore, originHash, panelRead, panelWrite, readJson, type SiteContext } from "./route-tools";

// Plans (docs/SAUNA.md §11): their management in the panel, booking one from the public site and the page of a purchase.

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_BOOKINGS_PER_HOUR = 10;

export const getPlans = panelRead(async (_request, site) => {
  try {
    const [plans, settings] = await Promise.all([listPlans(site.id), readSettings(site.id)]);
    return Response.json({ plans, depositPercent: settings?.depositPercent ?? 0 }, { headers: noStore });
  } catch (error) { return failure(error, "leer los planes"); }
});

/** Creates a plan, or saves one over the version that was read. */
export const postPlan = panelWrite(async (request, site) => {
  try {
    await savePlan(site.id, cleanPlan(await readJson(request, 2_000)));
    return Response.json({ ok: true });
  } catch (error) { return failure(error, "guardar el plan"); }
});

const messageOf = (reason: PlanRejection | ReserveRejection) =>
  (planRejectionMessages as Record<string, string>)[reason] ?? (rejectionMessages as Record<string, string>)[reason] ?? rejectionMessages.invalid_request;

/**
 * POST { planId, turns: [{ roomId, turnTypeId, startsAt }], name, whatsapp, termsAccepted }. The browser only says which plan and which turns:
 * sauna_reserve_plan checks every turn again, under the same locks as a single booking, and decides the price and the deposit.
 */
export async function postPlanReservation(request: Request, context: SiteContext) {
  if (!sameOrigin(request)) return fail(403, "Origen no permitido.");
  const site = await getSite((await context.params).site);
  if (site?.kind !== "sauna") return fail(404, "Sitio no encontrado.");
  try {
    const body = await readJson(request, 4_000) as Record<string, unknown> | null;
    const planId = typeof body?.planId === "string" && UUID.test(body.planId) ? body.planId : null;
    const raw = Array.isArray(body?.turns) ? body.turns : [];
    if (!planId || raw.length < PLAN_TURNS.min || raw.length > PLAN_TURNS.max) return fail(400, rejectionMessages.invalid_request);
    const turns: PlanTurnRequest[] = [];
    for (const item of raw as Record<string, unknown>[]) {
      const roomId = typeof item?.roomId === "string" && UUID.test(item.roomId) ? item.roomId : null;
      const turnTypeId = typeof item?.turnTypeId === "string" && UUID.test(item.turnTypeId) ? item.turnTypeId : null;
      const startsAt = typeof item?.startsAt === "string" && !Number.isNaN(Date.parse(item.startsAt)) ? new Date(item.startsAt).toISOString() : null;
      if (!roomId || !turnTypeId || !startsAt) return fail(400, rejectionMessages.invalid_request);
      turns.push({ roomId, turnTypeId, startsAt });
    }
    const name = cleanName(body?.name);
    const whatsapp = cleanArgentineWhatsapp(body?.whatsapp);
    const origin = originHash(request);
    if (await bookingsFromOrigin(site.id, origin) >= MAX_BOOKINGS_PER_HOUR) return fail(429, "Hiciste muchas reservas seguidas. Probá de nuevo en un rato o escribinos por WhatsApp.");

    const result = await reservePlan(site.id, { planId, turns, name, whatsapp, termsAccepted: body?.termsAccepted === true });
    if (!result.ok) return Response.json({ error: messageOf(result.reason), reason: result.reason }, { status: 409 });
    // As with a single booking, the origin mark is outside the function: losing it only weakens a limit.
    const purchase = await planPurchaseByToken(site.id, result.token);
    await Promise.all((purchase?.bookings ?? []).map(booking => markOrigin(site.id, booking.id, origin)))
      .catch((error: unknown) => console.error("[sauna] origin mark failed:", error instanceof Error ? error.name : "error"));
    if (purchase?.bookings.length) {
      notify({
        siteId: site.id, event: "sauna.booking_new", customerName: name, startsAt: purchase.bookings[0].startsAt,
        depositDueCents: purchase.bookings.reduce((sum, booking) => sum + booking.depositCents, 0), plan: { name: purchase.name, turns: purchase.turns },
      });
    }
    return Response.json({ token: result.token });
  } catch (error) { return failure(error, "reservar el plan"); }
}

/** Everything the page of a plan shows, or null for a link that leads nowhere. A return from Mercado Pago is checked first, as for a booking. */
export async function publicPlan(siteId: string, token: string, returnedPaymentId?: unknown) {
  let purchase = await planPurchaseByToken(siteId, token);
  if (!purchase) return null;
  if (returnedPaymentId && purchase.bookings.every(booking => ledgerOf(booking.movements).depositPaidCents === 0)) {
    if (await settleReturnedPlanPayment(siteId, purchase.id, returnedPaymentId)) purchase = await planPurchaseByToken(siteId, token) ?? purchase;
  }
  const [settings, rooms, options] = await Promise.all([readSettings(siteId), listRooms(siteId), paymentOptionsOf(siteId)]);
  const showRoom = rooms.filter(room => room.active).length > 1;
  return {
    plan: {
      name: purchase.name, turns: purchase.turns, priceCents: purchase.priceCents, rules: purchase.rules,
      customerName: purchase.bookings[0]?.customerName ?? "",
      // Only what the person's page needs: no ids, no tokens of the single bookings.
      bookings: purchase.bookings.map(booking => ({
        status: booking.status, expiresAt: booking.expiresAt, depositCents: booking.depositCents, priceCents: booking.priceCents, discountCents: booking.discountCents,
        startsAt: booking.startsAt, endsAt: booking.endsAt, typeName: booking.typeName, movements: booking.movements,
        roomName: showRoom ? rooms.find(room => room.id === booking.roomId)?.name ?? "" : "",
      })),
    },
    now: new Date().toISOString(),
    contactWhatsapp: settings?.contactWhatsapp ?? null,
    payment: { ...options, transfer: settings ? transferAccount(settings) : null, returned: Boolean(returnedPaymentId) },
  };
}

/** The active plans and what the site charges as deposit, for the booking screen. */
export async function publicPlans(siteId: string) {
  return (await listPlans(siteId, { activeOnly: true })).map(({ id, name, description, turns, priceCents, windowDays }) => ({ id, name, description, turns, priceCents, windowDays }));
}
