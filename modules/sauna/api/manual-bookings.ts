import { listTurns } from "../data/bookings";
import { reserveManual } from "../data/manual-bookings";
import { cleanManualBookingRequest } from "../domain/manual-booking";
import { rejectionMessages } from "../domain/rejections";
import { addDays, isDateText } from "../domain/time";
import { fail, failure, noStore, panelRead, panelWrite, readJson } from "./route-tools";

export const getManualAvailability = panelRead(async (request, site) => {
  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!isDateText(from) || !isDateText(to) || to < from || to > addDays(from, 31)) return fail(400, "Rango de fechas inválido.");
  try { return Response.json(await listTurns(site.id, from, to, true), { headers: noStore }); }
  catch (error) { return failure(error, "leer los turnos del panel"); }
});

export const postManualBooking = panelWrite(async (request, site) => {
  try {
    const body = cleanManualBookingRequest(await readJson(request, 3000));
    const result = await reserveManual(site.id, body);
    if (!result.ok) return fail(409, result.reason === "invalid_request" ? "El turno o su precio cambió. Volvé a elegirlo y revisá los datos." : result.reason === "too_soon" ? "Ese turno ya empezó. Elegí otro." : rejectionMessages[result.reason]);
    if (result.booking.status !== "confirmed" || result.booking.origin !== "panel" || result.booking.terms_accepted_at !== null || result.booking.price_cents !== body.expectedPriceCents) throw new Error("Unexpected manual booking result");
    return Response.json({ id: result.booking.id, status: result.booking.status, priceCents: result.booking.price_cents, termsPending: result.booking.terms_accepted_at === null }, { headers: noStore });
  } catch (error) { return failure(error, "crear la reserva manual"); }
});
