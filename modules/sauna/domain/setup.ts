import type { Instant } from "./booking.ts";
import { cleanWhatsapp, CustomerError } from "./customer.ts";
import { addDays, businessDayStart, isDateText, type DateText } from "./time.ts";

// What the panel configures. Everything comes from outside, so each `clean*` function validates it and its message goes to the person as it is.

export class SetupError extends Error {}

export type Settings = {
  depositPercent: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  mpHoldMinutes: number;
  transferHoldHours: number;
  contactWhatsapp: string | null;
  /** How often a turn can begin within a band, in minutes. */
  startStepMinutes: number;
  revision: number;
};

export type Room = { id: string | null; name: string; capacity: number; active: boolean; revision: number };

export type ClosureEntry = { id: string; roomId: string | null; startsAt: Instant; endsAt: Instant; reason: string };
export type NewClosure = Omit<ClosureEntry, "id">;

export const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new SetupError("Datos inválidos.");
  return value as Record<string, unknown>;
};

export function whole(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new SetupError(`${label} tiene que ser un número entero entre ${min} y ${max}.`);
  return value;
}

const revisionOf = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : 1);

export function cleanSettings(input: unknown): Settings {
  const value = record(input);
  let contactWhatsapp: string | null = null;
  if (value.contactWhatsapp !== null && value.contactWhatsapp !== undefined && value.contactWhatsapp !== "") {
    try { contactWhatsapp = cleanWhatsapp(value.contactWhatsapp); } catch (error) {
      throw error instanceof CustomerError ? new SetupError(error.message) : error;
    }
  }
  return {
    depositPercent: whole(value.depositPercent, 0, 100, "La seña"),
    minLeadMinutes: whole(value.minLeadMinutes, 0, 10_080, "La anticipación mínima"),
    maxAdvanceDays: whole(value.maxAdvanceDays, 1, 365, "El horizonte"),
    mpHoldMinutes: whole(value.mpHoldMinutes, 1, 1_440, "La retención de Mercado Pago"),
    transferHoldHours: whole(value.transferHoldHours, 1, 168, "La retención de transferencia"),
    contactWhatsapp,
    startStepMinutes: whole(value.startStepMinutes, 5, 240, "El inicio de los turnos"),
    revision: revisionOf(value.revision),
  };
}

/** Closures entered from the panel are whole Buenos Aires days, both included. */
export function closureFromDays(input: unknown): NewClosure {
  const value = record(input);
  const from: DateText = value.from as DateText;
  const to: DateText = value.to as DateText;
  if (!isDateText(from) || !isDateText(to)) throw new SetupError("Ingresá las fechas del cierre.");
  if (to < from) throw new SetupError("La fecha final no puede ser anterior a la inicial.");
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (reason.length > 200) throw new SetupError("El motivo puede tener hasta 200 caracteres.");
  return { roomId: null, startsAt: businessDayStart(from), endsAt: businessDayStart(addDays(to, 1)), reason };
}

/** Explicit instants require an offset: browser-local timestamps are ambiguous. */
export function closureFromRange(input: unknown, now: Instant = new Date().toISOString()): NewClosure {
  const value = record(input);
  const instant = (raw: unknown) => {
    if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(raw) || !isDateText(raw.slice(0, 10)) || !Number.isFinite(Date.parse(raw))) throw new SetupError("Ingresá fechas y horas válidas.");
    return new Date(raw).toISOString();
  };
  const startsAt = instant(value.startsAt);
  const endsAt = instant(value.endsAt);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new SetupError("El fin tiene que ser posterior al inicio.");
  if (Date.parse(endsAt) <= Date.parse(now)) throw new SetupError("Ese horario ya terminó.");
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (reason.length > 200) throw new SetupError("El motivo puede tener hasta 200 caracteres.");
  return { roomId: null, startsAt, endsAt, reason };
}
