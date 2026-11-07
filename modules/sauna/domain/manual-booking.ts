import type { Turn } from "./agenda.ts";
import { bookingKinds, type Booking, type BookingKind } from "./booking.ts";
import { cleanArgentineWhatsapp, cleanName, CustomerError } from "./customer.ts";
import { isCents } from "../../../platform/money/index.ts";
import type { Movement } from "./payments.ts";
import { priceFor } from "./pricing.ts";
import { record, SetupError } from "./setup.ts";
import { businessDate, businessTime, isDateText, type DateText } from "./time.ts";

export const turnKey = (turn: Turn): string => `${turn.roomId}|${turn.turnTypeId}|${turn.startsAt}`;

export type ManualBookingDraft = { name: string; whatsapp: string; kind: BookingKind };
export type ManualBookingRequest = ManualBookingDraft & { roomId: string; turnTypeId: string; startsAt: string; requestId: string; expectedPriceCents: number };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** Expected price is a conflict check, never an amount the caller can charge. */
export function cleanManualBookingRequest(input: unknown): ManualBookingRequest {
  const value = record(input);
  const keys = ["roomId", "turnTypeId", "startsAt", "requestId", "kind", "name", "whatsapp", "expectedPriceCents"];
  if (Object.keys(value).some(key => !keys.includes(key)) || !uuid(value.roomId) || !uuid(value.turnTypeId) || !uuid(value.requestId)
    || !bookingKinds.includes(value.kind as BookingKind) || !isCents(value.expectedPriceCents)) throw new SetupError("Revisá los datos del turno antes de confirmar.");
  if (typeof value.startsAt !== "string" || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(value.startsAt)
    || !isDateText(value.startsAt.slice(0, 10)) || !Number.isFinite(Date.parse(value.startsAt))) throw new SetupError("Revisá la fecha y hora del turno.");
  return { roomId: value.roomId, turnTypeId: value.turnTypeId, requestId: value.requestId, startsAt: new Date(value.startsAt).toISOString(), kind: value.kind as BookingKind,
    name: cleanName(value.name), whatsapp: cleanArgentineWhatsapp(value.whatsapp), expectedPriceCents: value.expectedPriceCents };
}
export const emptyManualBookingDraft = (): ManualBookingDraft => ({ name: "", whatsapp: "", kind: "shared" });
export const manualBookingKinds = (turn: Turn): BookingKind[] => [
  ...(turn.priceCents !== null ? ["shared" as const] : []),
  ...(turn.privatePriceCents !== null ? ["private" as const] : []),
];

export function cleanManualBookingDraft(turn: Turn, draft: ManualBookingDraft): ManualBookingDraft {
  if (!manualBookingKinds(turn).includes(draft.kind)) throw new CustomerError("Ese turno no ofrece la modalidad elegida.");
  return { name: cleanName(draft.name), whatsapp: cleanArgentineWhatsapp(draft.whatsapp), kind: draft.kind };
}

/** A preview only: no payment has been recorded, so no deposit is subtracted from the balance. */
export function manualBookingPreview(turn: Turn, kind: BookingKind) {
  const totalCents = priceFor(turn, kind, 1);
  return { durationMinutes: (Date.parse(turn.endsAt) - Date.parse(turn.startsAt)) / 60_000, totalCents, balanceCents: totalCents };
}

export class ManualBookingError extends Error {}

/** A proposed initial state, without identifiers, persistence or an implied acceptance of terms. */
export type ManualBookingPreparation = {
  roomId: string; turnTypeId: string; startsAt: string; endsAt: string;
  customer: Pick<ManualBookingDraft, "name" | "whatsapp">;
  booking: Pick<Booking, "kind" | "seats" | "priceCents" | "discountCents" | "depositCents"> & {
    status: "confirmed"; expiresAt: null; movements: Movement[];
  };
};

/** The future write operation must re-read this turn and check availability under the room's lock. */
export function prepareManualBooking(turn: Turn, draft: ManualBookingDraft, now: string): ManualBookingPreparation {
  const start = Date.parse(turn.startsAt);
  const end = Date.parse(turn.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isInteger(turn.capacity)
    || !manualBookingOptions([turn], businessDate(turn.startsAt), undefined, now).length) {
    throw new ManualBookingError("Ese turno ya no está disponible. Elegí otro.");
  }
  const customer = cleanManualBookingDraft(turn, draft);
  const priceCents = priceFor(turn, customer.kind, 1);
  if (!isCents(priceCents)) throw new ManualBookingError("Revisá el precio del tipo de turno.");
  return {
    roomId: turn.roomId, turnTypeId: turn.turnTypeId, startsAt: turn.startsAt, endsAt: turn.endsAt,
    customer: { name: customer.name, whatsapp: customer.whatsapp },
    booking: {
      kind: customer.kind, seats: customer.kind === "private" ? turn.capacity : 1,
      status: "confirmed", expiresAt: null, priceCents, discountCents: 0, depositCents: 0, movements: [],
    },
  };
}

/** Availability covers the whole turn; an empty calendar cell alone cannot promise it. */
export function manualBookingOptions(turns: readonly Turn[], day: DateText, clock: string | undefined, now: string): Turn[] {
  return turns.filter(turn => businessDate(turn.startsAt) === day
    && (!clock || businessTime(turn.startsAt) === clock)
    && Date.parse(turn.startsAt) > Date.parse(now)
    && turn.bookable && !turn.closed && turn.capacity > 0 && turn.freeSeats === turn.capacity
    && (turn.priceCents !== null || turn.privatePriceCents !== null))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.typeName.localeCompare(b.typeName) || a.roomId.localeCompare(b.roomId));
}
