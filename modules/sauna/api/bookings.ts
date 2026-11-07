import { listBands, readSettings, listClosures, listRooms } from "../data/setup";
import { cancelBooking, listBookingsOfRange, searchBookings, setBookingStatus } from "../data/bookings";
import { bookingStatuses, type BookingStatus } from "../domain/booking";
import { isDateText } from "../domain/time";
import { recordTransfer } from "./payments";
import { fail, failure, noStore, panelRead, panelWrite, readJson } from "./route-tools";

/** The session is one shared password for now: phase P2 replaces this with the person's name. */
const ACTOR = "panel";
const MAX_RANGE_DAYS = 93;

const roomNames = async (siteId: string) => Object.fromEntries((await listRooms(siteId)).map(room => [room.id, room.name]));

export const getAgenda = panelRead(async (request, site) => {
  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!isDateText(from) || !isDateText(to) || to < from || Date.parse(to) - Date.parse(from) > MAX_RANGE_DAYS * 86_400_000) return fail(400, "Rango de fechas inválido.");
  try {
    const [closures, bookings, rooms, bands, settings] = await Promise.all([listClosures(site.id), listBookingsOfRange(site.id, from, to), roomNames(site.id), listBands(site.id), readSettings(site.id)]);
    return Response.json({ now: new Date().toISOString(), closures, bookings, rooms, bands, stepMinutes: settings?.startStepMinutes ?? 30 }, { headers: noStore });
  } catch (error) { return failure(error, "leer la agenda"); }
});

export const getBookings = panelRead(async (request, site) => {
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const text = (params.get("q") ?? "").slice(0, 80);
  if (status && !bookingStatuses.includes(status as BookingStatus)) return fail(400, "Estado inválido.");
  try {
    const [bookings, rooms] = await Promise.all([searchBookings(site.id, text, (status as BookingStatus) || null), roomNames(site.id)]);
    return Response.json({ now: new Date().toISOString(), bookings, rooms }, { headers: noStore });
  } catch (error) { return failure(error, "buscar las reservas"); }
});

const refusals: Record<string, string> = {
  invalid_status: "La reserva cambió de estado. Recargá la página.",
  not_started: "La asistencia se marca cuando el turno ya empezó.",
  not_found: "No encontramos esa reserva.",
};

export const patchBooking = panelWrite<{ params: Promise<{ site: string; id: string }> }>(async (request, site, context) => {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "No encontramos esa reserva.");
  try {
    const body = await readJson(request, 2_000) as { action?: unknown; note?: unknown } | null;
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
    const action = body?.action;
    if (action === "transfer") {
      const recorded = await recordTransfer(site.id, id, ACTOR);
      return recorded.ok ? Response.json({ ok: true, outcome: recorded.outcome, message: recorded.message }) : fail(recorded.status, recorded.error);
    }
    if (action !== "confirm" && action !== "complete" && action !== "no_show" && action !== "cancel") return fail(400, "Acción inválida.");
    const result = action === "cancel"
      ? await cancelBooking(site.id, id, note, ACTOR)
      : await setBookingStatus(site.id, id, action === "confirm" ? "confirmed" : action === "complete" ? "completed" : "no_show", note, ACTOR);
    if (!result.ok) return fail(409, refusals[result.reason] ?? "No se pudo cambiar la reserva.");
    return Response.json({ ok: true });
  } catch (error) { return failure(error, "cambiar la reserva"); }
});
