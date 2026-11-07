import { equal } from "@/platform/auth/server";
import { rpc, siteTable } from "@/platform/db";
import type { AgendaBooking, Turn } from "../domain/agenda";
import type { BookingKind, BookingStatus } from "../domain/booking";
import type { Movement } from "../domain/payments";
import type { PolicyRule } from "../domain/policy";
import type { ReserveRejection } from "../domain/rejections";
import { addDays, businessDayStart, type DateText } from "../domain/time";

const missing = "Falta la tabla de reservas: corré supabase/schema.sql.";

type TurnRow = {
  room_id: string; turn_type_id: string; type_name: string; starts_at: string; ends_at: string; capacity: number; free_seats: number;
  price_cents: number | null; private_price_cents: number | null; deposit_percent: number; closed: boolean; bookable: boolean;
};

type BookingRow = {
  id: string; token: string; status: BookingStatus; kind: BookingKind; seats: number; price_cents: number; discount_cents: number; deposit_cents: number;
  expires_at: string | null; needs_refund: boolean; created_at: string; policy_snapshot: { rules?: PolicyRule[] };
  customers: { name: string; whatsapp: string | null };
  sauna_slots: { room_id: string; starts_at: string; ends_at: string; sauna_turn_types: { name: string } | null };
  payments: { kind: Movement["kind"]; amount_cents: number }[];
};

const fullBooking = "select=id,token,status,kind,seats,price_cents,discount_cents,deposit_cents,expires_at,needs_refund,created_at,policy_snapshot,customers!inner(name,whatsapp),sauna_slots!inner(room_id,starts_at,ends_at,sauna_turn_types(name)),payments(kind,amount_cents)";
const bookings = (siteId: string) => siteTable<BookingRow>("sauna_bookings", siteId, missing);

const agendaBooking = (row: BookingRow): AgendaBooking => ({
  id: row.id, token: row.token, status: row.status, kind: row.kind, seats: row.seats, priceCents: row.price_cents, discountCents: row.discount_cents, depositCents: row.deposit_cents,
  expiresAt: row.expires_at, needsRefund: row.needs_refund, createdAt: row.created_at, customerName: row.customers.name, customerWhatsapp: row.customers.whatsapp,
  roomId: row.sauna_slots.room_id, startsAt: row.sauna_slots.starts_at, endsAt: row.sauna_slots.ends_at, typeName: row.sauna_slots.sauna_turn_types?.name ?? "",
  movements: row.payments.map(payment => ({ kind: payment.kind, amountCents: payment.amount_cents })),
});

/** Turns of a range of Buenos Aires days, from the template and the turns that already exist. */
export async function listTurns(siteId: string, from: DateText, to: DateText, manual = false): Promise<Turn[]> {
  const rows = await rpc<TurnRow[]>(manual ? "sauna_manual_availability" : "sauna_availability", { p_site: siteId, p_from: from, p_to: to });
  return rows.map(row => ({
    roomId: row.room_id, turnTypeId: row.turn_type_id, typeName: row.type_name, startsAt: row.starts_at, endsAt: row.ends_at, capacity: row.capacity, freeSeats: row.free_seats,
    priceCents: row.price_cents, privatePriceCents: row.private_price_cents, depositPercent: row.deposit_percent, closed: row.closed, bookable: row.bookable,
  }));
}

/** Every booking whose turn falls in a range of Buenos Aires days. */
export async function listBookingsOfRange(siteId: string, from: DateText, to: DateText): Promise<AgendaBooking[]> {
  const start = encodeURIComponent(businessDayStart(from));
  const end = encodeURIComponent(businessDayStart(addDays(to, 1)));
  const rows = await bookings(siteId)(`${fullBooking}&sauna_slots.starts_at=gte.${start}&sauna_slots.starts_at=lt.${end}&limit=2000`);
  return rows.map(agendaBooking);
}

/** The panel's search, newest first. Digits look in the number, anything else in the name. */
export async function searchBookings(siteId: string, text: string, status: BookingStatus | null): Promise<AgendaBooking[]> {
  // PostgREST reads `*` as the wildcard and these characters as syntax, so they cannot come from the person.
  const clean = text.replace(/[*,()"\\%]/g, " ").trim();
  const digits = clean.replace(/\D/g, "");
  const filter = !clean ? "" : digits.length >= 3 && !/\p{L}/u.test(clean)
    ? `&customers.whatsapp=ilike.*${digits}*`
    : `&customers.name=ilike.*${encodeURIComponent(clean)}*`;
  const rows = await bookings(siteId)(`${fullBooking}${filter}${status ? `&status=eq.${status}` : ""}&order=created_at.desc&limit=100`);
  return rows.map(agendaBooking);
}

export type ReserveRequest = { roomId: string; turnTypeId: string; startsAt: string; kind: BookingKind; seats: number; name: string; whatsapp: string; code: string | null; termsAccepted: boolean };
type ReserveResult = { ok: true; booking: { id: string; token: string } } | { ok: false; reason: ReserveRejection };

export function reserve(siteId: string, request: ReserveRequest): Promise<ReserveResult> {
  return rpc<ReserveResult>("sauna_reserve", {
    p_site: siteId, p_room: request.roomId, p_starts_at: request.startsAt, p_turn_type: request.turnTypeId, p_kind: request.kind, p_seats: request.seats, p_name: request.name, p_whatsapp: request.whatsapp,
    p_code: request.code, p_pack_token: null, p_terms_accepted: request.termsAccepted,
  });
}

/** How many bookings an origin made in the last hour. */
export async function bookingsFromOrigin(siteId: string, originHash: string): Promise<number> {
  const since = encodeURIComponent(new Date(Date.now() - 3_600_000).toISOString());
  return (await bookings(siteId)(`origin_hash=eq.${originHash}&created_at=gte.${since}&select=id&limit=50`)).length;
}

export async function markOrigin(siteId: string, bookingId: string, originHash: string) {
  await bookings(siteId)(`id=eq.${bookingId}`, { method: "PATCH", body: JSON.stringify({ origin_hash: originHash }) });
}

export type ChangeResult = { ok: true } | { ok: false; reason: string };

export const setBookingStatus = (siteId: string, bookingId: string, to: "confirmed" | "completed" | "no_show", note: string, actor: string) =>
  rpc<ChangeResult>("sauna_set_status", { p_site: siteId, p_booking: bookingId, p_to: to, p_note: note, p_actor: actor });

/** Phase S5 adds the refund and the session of a pack. */
export const cancelBooking = (siteId: string, bookingId: string, note: string, actor: string) =>
  rpc<ChangeResult>("sauna_cancel", { p_site: siteId, p_booking: bookingId, p_refund_cents: 0, p_refund_method: null, p_return_session: false, p_note: note, p_actor: actor });

export type PublicBooking = {
  status: BookingStatus;
  kind: BookingKind;
  seats: number;
  priceCents: number;
  discountCents: number;
  depositCents: number;
  expiresAt: string | null;
  customerName: string;
  roomId: string;
  typeName: string;
  startsAt: string;
  endsAt: string;
  movements: Movement[];
  rules: PolicyRule[];
};

/** A booking from its secret link. The format is checked first so nothing else reaches the query, and the comparison runs in constant time. */
export async function bookingByToken(siteId: string, token: string): Promise<PublicBooking | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const [row] = await bookings(siteId)(`token=eq.${token}&${fullBooking}`);
  if (!row || !equal(row.token, token)) return null;
  return {
    status: row.status, kind: row.kind, seats: row.seats, priceCents: row.price_cents, discountCents: row.discount_cents, depositCents: row.deposit_cents, expiresAt: row.expires_at,
    customerName: row.customers.name, roomId: row.sauna_slots.room_id, typeName: row.sauna_slots.sauna_turn_types?.name ?? "", startsAt: row.sauna_slots.starts_at, endsAt: row.sauna_slots.ends_at,
    movements: row.payments.map(payment => ({ kind: payment.kind, amountCents: payment.amount_cents })),
    rules: row.policy_snapshot.rules ?? [],
  };
}

/** The tiers a new booking would get, to show them before reserving. */
export async function readDefaultPolicy(siteId: string): Promise<PolicyRule[]> {
  const [row] = await siteTable<{ rules: PolicyRule[] }>("cancellation_policies", siteId, missing)("is_default=is.true&active=is.true&select=rules");
  return row?.rules ?? [];
}
