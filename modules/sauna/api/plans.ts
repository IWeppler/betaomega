import { sameOrigin } from "@/platform/auth/server";
import { listSaunaHerbs } from "../data/herbs";
import { selectedHerb } from "../domain/herbs";
import { BodyError } from "./route-tools";
import { getSite } from "@/platform/sites/server";
import { bookingsFromOrigin, markOrigin } from "../data/bookings";
import { deleteUnusedPlan, listPlans, planPurchaseByToken, reservePlan, savePlan, type PlanTurnRequest } from "../data/plans";
import { recordFailedAttempt } from "../data/codes";
import { readPage } from "../data/page";
import { listRooms, listTurnTypes, readSettings } from "../data/setup";
import { isCodeText, normalizeCode } from "../domain/codes";
import { cleanArgentineWhatsapp, cleanName } from "../domain/customer";
import { ledgerOf } from "../domain/payments";
import { cleanPlan, PLAN_TURNS } from "../domain/plans";
import { planRejectionMessages, rejectionMessages, type PlanRejection, type ReserveRejection } from "../domain/rejections";
import { transferAccount } from "../domain/setup";
import { CODE_ATTEMPTS_MESSAGE, tooManyCodeAttempts } from "./codes";
import { paymentOptionsOf, settleReturnedPlanPayment } from "./payments";
import { notify } from "@/platform/notifications/server";
import { fail, failure, noStore, originHash, homeWrite, panelRead, readJson, type SiteContext } from "./route-tools";

// Plans (docs/SAUNA.md §11): their management in the panel, booking one from the public site and the page of a purchase.

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_BOOKINGS_PER_HOUR = 10;

/** The lengths of the active turn types, shortest first: what a plan can ask for. */
const turnDurations = async (siteId: string) => [...new Set((await listTurnTypes(siteId)).map(type => type.durationMinutes))].sort((a, b) => a - b);

export const getPlans = panelRead(async (_request, site) => {
  try {
    const [plans, settings, durations] = await Promise.all([listPlans(site.id), readSettings(site.id), turnDurations(site.id)]);
    return Response.json({ plans, depositPercent: settings?.depositPercent ?? 0, durations }, { headers: noStore });
  } catch (error) { return failure(error, "leer los planes"); }
});

/** Creates a plan, or saves one over the version that was read. */
export const postPlan = homeWrite(async (request, site) => {
  try {
    const id = await savePlan(site.id, cleanPlan(await readJson(request, 2_000), await turnDurations(site.id)));
    return Response.json({ ok: true, id });
  } catch (error) { return failure(error, "guardar el plan"); }
});

/** DELETE ?id=: undoes creating a plan. One that was already bought is deactivated instead, and the answer says so. */
export const deletePlan = homeWrite(async (request, site) => {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return fail(400, "Plan inválido.");
  try {
    return Response.json(await deleteUnusedPlan(site.id, id) ? { ok: true } : { ok: true, message: "Alguien ya reservó ese plan: quedó desactivado en vez de borrado." });
  } catch (error) { return failure(error, "borrar el plan"); }
});

const messageOf = (reason: PlanRejection | ReserveRejection) =>
  (planRejectionMessages as Record<string, string>)[reason] ?? (rejectionMessages as Record<string, string>)[reason] ?? rejectionMessages.invalid_request;

/**
 * POST { planId, turns: [{ roomId, turnTypeId, startsAt }], name, whatsapp, termsAccepted, code? }. The browser only says which plan, which turns and
 * which code: sauna_reserve_plan checks every turn again, under the same locks as a single booking, and decides the price, the discount and the
 * deposit. A code it refuses counts as a failed attempt, as for a single booking.
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
    const herbs = raw.some(item => item && typeof item === "object" && "herbId" in item && item.herbId) ? await listSaunaHerbs(site.id) : [];
    for (const item of raw as Record<string, unknown>[]) {
      const roomId = typeof item?.roomId === "string" && UUID.test(item.roomId) ? item.roomId : null;
      const turnTypeId = typeof item?.turnTypeId === "string" && UUID.test(item.turnTypeId) ? item.turnTypeId : null;
      const startsAt = typeof item?.startsAt === "string" && !Number.isNaN(Date.parse(item.startsAt)) ? new Date(item.startsAt).toISOString() : null;
      if (!roomId || !turnTypeId || !startsAt) return fail(400, rejectionMessages.invalid_request);
      let herb;
      try { herb = selectedHerb(herbs, item?.herbId); } catch (error) { throw new BodyError(409, (error as Error).message); }
      turns.push({ roomId, turnTypeId, startsAt, herb });
    }
    const name = cleanName(body?.name);
    const whatsapp = cleanArgentineWhatsapp(body?.whatsapp);
    const code = typeof body?.code === "string" && body.code.trim() ? normalizeCode(body.code.slice(0, 60)) : null;
    const origin = originHash(request);
    if (await bookingsFromOrigin(site.id, origin) >= MAX_BOOKINGS_PER_HOUR) return fail(429, "Hiciste muchas reservas seguidas. Probá de nuevo en un rato o escribinos por WhatsApp.");
    if (code !== null) {
      if (await tooManyCodeAttempts(site.id, origin)) return fail(429, CODE_ATTEMPTS_MESSAGE);
      if (!isCodeText(code)) {
        await recordFailedAttempt(site.id, origin);
        return Response.json({ error: rejectionMessages.code_not_found, reason: "code_not_found" }, { status: 409 });
      }
    }

    const result = await reservePlan(site.id, { planId, turns, name, whatsapp, termsAccepted: body?.termsAccepted === true, code });
    if (!result.ok) {
      if (result.reason.startsWith("code_")) await recordFailedAttempt(site.id, origin);
      return Response.json({ error: messageOf(result.reason), reason: result.reason }, { status: 409 });
    }
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
  const [settings, rooms, options, page] = await Promise.all([readSettings(siteId), listRooms(siteId), paymentOptionsOf(siteId), readPage(siteId)]);
  const showRoom = rooms.filter(room => room.active).length > 1;
  return {
    plan: {
      // What the plan costs in the end, after a code.
      name: purchase.name, turns: purchase.turns, priceCents: purchase.priceCents - purchase.discountCents, rules: purchase.rules,
      customerName: purchase.bookings[0]?.customerName ?? "",
      // Only what the person's page needs: no ids, no tokens of the single bookings.
      bookings: purchase.bookings.map(booking => ({
        status: booking.status, expiresAt: booking.expiresAt, depositCents: booking.depositCents, priceCents: booking.priceCents, discountCents: booking.discountCents,
        herbName: booking.herbName, startsAt: booking.startsAt, endsAt: booking.endsAt, typeName: booking.typeName, movements: booking.movements,
        roomName: showRoom ? rooms.find(room => room.id === booking.roomId)?.name ?? "" : "",
      })),
    },
    now: new Date().toISOString(),
    address: page.address,
    contactWhatsapp: settings?.contactWhatsapp ?? null,
    payment: { ...options, transfer: settings ? transferAccount(settings) : null, returned: Boolean(returnedPaymentId) },
  };
}

/** The active plans and what the site charges as deposit, for the booking screen. */
export async function publicPlans(siteId: string) {
  return (await listPlans(siteId, { activeOnly: true })).map(({ id, name, description, turns, priceCents, windowDays, durationMinutes, allowsCodes }) =>
    ({ id, name, description, turns, priceCents, windowDays, durationMinutes, allowsCodes }));
}
