import { isAdmin, sameOrigin } from "@/platform/auth/server";
import { getPanelSite, getSite } from "@/platform/sites/server";
import type { Site } from "@/platform/sites";
import { bookingByToken, bookingsFromOrigin, listTurns, markOrigin, readDefaultPolicy, reserve } from "../data/bookings";
import { readPage } from "../data/page";
import { resolveMapLocation } from "../data/map-location";
import { listBands, listRooms, listTurnTypes, readSettings } from "../data/setup";
import { bookingKinds, type BookingKind } from "../domain/booking";
import { cleanArgentineWhatsapp, cleanName } from "../domain/customer";
import { whatsappLink } from "../domain/messages";
import { hoursSummary } from "../domain/page";
import { rejectionMessages } from "../domain/rejections";
import { addDays, businessDate, isDateText } from "../domain/time";
import { paymentTargetByToken } from "../data/payments";
import { ledgerOf } from "../domain/payments";
import { firstBookableDay, transferAccount } from "../domain/setup";
import { publicPlans } from "./plans";
import { paymentOptionsOf, settleReturnedPayment } from "./payments";
import { recordFailedAttempt } from "../data/codes";
import { isCodeText, normalizeCode } from "../domain/codes";
import { CODE_ATTEMPTS_MESSAGE, tooManyCodeAttempts } from "./codes";
import { fail, failure, noStore, originHash, readJson, type SiteContext } from "./route-tools";

// What the public site reaches. Only an active site answers, and nothing here returns another person's data.

const MAX_RANGE_DAYS = 31;
const MAX_BOOKINGS_PER_HOUR = 10;

const activeSauna = async (context: SiteContext): Promise<Site | undefined> => {
  const site = await getSite((await context.params).site);
  return site?.kind === "sauna" ? site : undefined;
};

export async function getAvailability(request: Request, context: SiteContext) {
  // Whoever holds a panel session also sees the turns of a site being prepared, for its preview. Only this read: a reservation still needs an active site.
  const id = (await context.params).site;
  const found = await activeSauna(context) ?? (await isAdmin() ? await getPanelSite(id) : undefined);
  const site = found?.kind === "sauna" ? found : undefined;
  if (!site) return fail(404, "Sitio no encontrado.");
  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!isDateText(from) || !isDateText(to) || to < from || to > addDays(from, MAX_RANGE_DAYS)) return fail(400, "Rango de fechas inválido.");
  try {
    return Response.json(await listTurns(site.id, from, to), { headers: noStore });
  } catch (error) { return failure(error, "leer los turnos"); }
}

/**
 * The browser says what it wants: which turn, which kind, who and, optionally, a code. An individual booking is always one person; the price, the discount
 * and the seats are decided in sauna_reserve. A code it refuses counts as a failed attempt, as in the code check, so reserving is no way around that limit.
 */
export async function postReservation(request: Request, context: SiteContext) {
  if (!sameOrigin(request)) return fail(403, "Origen no permitido.");
  const site = await activeSauna(context);
  if (!site) return fail(404, "Sitio no encontrado.");
  try {
    const body = await readJson(request, 2_000) as Record<string, unknown> | null;
    const roomId = typeof body?.roomId === "string" && /^[0-9a-f-]{36}$/i.test(body.roomId) ? body.roomId : null;
    const turnTypeId = typeof body?.turnTypeId === "string" && /^[0-9a-f-]{36}$/i.test(body.turnTypeId) ? body.turnTypeId : null;
    const startsAt = typeof body?.startsAt === "string" && !Number.isNaN(Date.parse(body.startsAt)) ? body.startsAt : null;
    const kind = bookingKinds.includes(body?.kind as BookingKind) ? (body?.kind as BookingKind) : null;
    if (!roomId || !turnTypeId || !startsAt || !kind) return fail(400, rejectionMessages.invalid_request);
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

    const result = await reserve(site.id, { roomId, turnTypeId, startsAt, kind, seats: 1, name, whatsapp, code, termsAccepted: body?.termsAccepted === true });
    if (!result.ok) {
      if (result.reason.startsWith("code_")) await recordFailedAttempt(site.id, origin);
      return Response.json({ error: rejectionMessages[result.reason], reason: result.reason }, { status: 409 });
    }
    // Outside sauna_reserve on purpose: losing this mark only weakens a limit, and it must not undo a booking already taken.
    await markOrigin(site.id, result.booking.id, origin).catch((error: unknown) => console.error("[sauna] origin mark failed:", error instanceof Error ? error.name : "error"));
    return Response.json({ token: result.booking.token });
  } catch (error) { return failure(error, "hacer la reserva"); }
}

/** The image for link previews: the brand image as it is, portrait. */
export const SITE_IMAGE = { url: "/fropexio.jpeg", width: 1024, height: 1536 };

/** The home page's texts, for the pages that only need those. */
export const publicPage = (siteId: string) => readPage(siteId);

/** What the home page needs before the first turn is asked for. Null when the site has no sauna configuration yet. */
export async function publicHome(siteId: string, { termsHref = "/terminos", preview = false }: { termsHref?: string; preview?: boolean } = {}) {
  // Plans degrade to none (pattern 3): the home page must not depend on them, for instance before schema.sql runs again.
  const [settings, types, bands, rules, page, plans] = await Promise.all([readSettings(siteId), listTurnTypes(siteId), listBands(siteId), readDefaultPolicy(siteId), readPage(siteId),
    publicPlans(siteId).catch((error: unknown) => { console.error("[sauna] plans unavailable:", error instanceof Error ? error.message.slice(0, 120) : "error"); return []; })]);
  if (!settings) return null;
  const today = businessDate(new Date().toISOString());
  return {
    booking: {
      siteId, today, firstDay: firstBookableDay(today, settings.opensOn), rules, maxAdvanceDays: settings.maxAdvanceDays, termsHref, preview,
      plans, depositPercent: settings.depositPercent,
    },
    page,
    location: await resolveMapLocation(page.mapUrl),
    types,
    depositPercent: settings.depositPercent,
    rules,
    hours: hoursSummary(bands),
    contactLink: settings.contactWhatsapp ? whatsappLink(settings.contactWhatsapp, "Hola, tengo una consulta.") : null,
  };
}

/**
 * Everything the page of a booking shows, or null for a link that leads nowhere. `returnedPaymentId` is what Mercado Pago adds to the address when the
 * person comes back from paying: that payment is checked with Mercado Pago before reading the booking, so the page already shows it confirmed.
 */
export async function publicReservation(siteId: string, token: string, returnedPaymentId?: unknown) {
  const target = returnedPaymentId ? await paymentTargetByToken(siteId, token) : null;
  if (target && ledgerOf(target.movements).depositPaidCents === 0) await settleReturnedPayment(siteId, target, returnedPaymentId);
  const booking = await bookingByToken(siteId, token);
  if (!booking) return null;
  const [settings, rooms, options] = await Promise.all([readSettings(siteId), listRooms(siteId), paymentOptionsOf(siteId)]);
  return {
    booking,
    now: new Date().toISOString(),
    contactWhatsapp: settings?.contactWhatsapp ?? null,
    roomName: rooms.find(room => room.id === booking.roomId)?.name ?? "",
    showRoom: rooms.filter(room => room.active).length > 1,
    payment: { ...options, transfer: settings ? transferAccount(settings) : null, returned: Boolean(returnedPaymentId) },
  };
}
