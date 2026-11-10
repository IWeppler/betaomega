import { listBands, readSettings, listClosures, listRooms } from "../data/setup";
import { cancelBooking, countPublicBookingsSince, listBookingsOfRange, SEARCH_LIMIT, searchBookings, setBookingStatus } from "../data/bookings";
import { bookingViews, groupBookings, pageOf, rowsOf, viewCounts, type BookingView } from "../domain/booking-groups";
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

/**
 * GET ?q=&view=&kind=single|plan&page=: one page of a tab of the list, a plan as one row with its turns, and how many rows every tab holds. The tabs
 * go by each booking's state as it is now (a lapsed hold is lapsed), which the database's status column cannot filter, so they are applied here.
 */
export const getBookings = panelRead(async (request, site) => {
  const params = new URL(request.url).searchParams;
  const view = (params.get("view") || "all") as BookingView;
  const kind = params.get("kind") || null;
  const text = (params.get("q") ?? "").slice(0, 80);
  if (!bookingViews.includes(view)) return fail(400, "Vista inválida.");
  if (kind !== null && kind !== "single" && kind !== "plan") return fail(400, "Tipo inválido.");
  try {
    const [bookings, rooms] = await Promise.all([searchBookings(site.id, text, null, kind), roomNames(site.id)]);
    const now = new Date().toISOString();
    const groups = groupBookings(bookings);
    const { items, page, pages, total } = pageOf(rowsOf(groups, view, now), Number(params.get("page") ?? 1));
    return Response.json({ now, view, groups: items, page, pages, total, counts: viewCounts(groups, now), capped: bookings.length >= SEARCH_LIMIT, rooms }, { headers: noStore });
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

/** What the panel's notices say about a sauna: bookings that came in from the site since the person last opened its panel. */
export async function saunaNotice(siteId: string, since: string) {
  const count = await countPublicBookingsSince(siteId, since);
  return { count, label: count === 1 ? "reserva nueva" : "reservas nuevas" };
}
