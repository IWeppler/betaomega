import { formatCents } from "../../../platform/money/index.ts";
import { isCurrent, type BookingStatus, type Instant } from "./booking.ts";
import { codeTypes, type CodeEffect, type CodeType } from "./pricing.ts";
import type { CodeRejection } from "./rejections.ts";
import { record, SetupError, whole } from "./setup.ts";
import { addDays, businessDayStart, isDateText, type DateText } from "./time.ts";

export type DiscountCode = CodeEffect & {
  id: string;
  code: string;
  active: boolean;
  validFrom: Instant | null;
  validUntil: Instant | null;
  /** Always set for a "free" code (docs/SAUNA.md §4); the table enforces it too. */
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  roomId: string | null;
  turnTypeId: string | null;
};

/** What a person types: case and surrounding spaces do not matter. */
export const normalizeCode = (text: string) => text.trim().toUpperCase();

/**
 * Letters without accents, digits and hyphens. Codes are stored in capitals, so a lookup is a plain equality. `_` and `%` are left out because the
 * database reads them as wildcards in a pattern.
 */
export const isCodeText = (text: string) => /^[A-Z0-9-]{3,40}$/.test(text);

/** A code as the panel edits it. `updatedAt` is the version read (pattern 4): saving over a newer one is refused. */
export type CodeDraft = Omit<DiscountCode, "id"> & { id: string | null; note: string; updatedAt: string | null };

const optionalWhole = (value: unknown, label: string): number | null => {
  if (value === null || value === undefined || value === "") return null;
  return whole(value, 1, 100_000, label);
};

/** Validity is entered as whole Buenos Aires days, both included: from the start of the first to the last instant of the last. */
function validity(fromInput: unknown, untilInput: unknown): Pick<DiscountCode, "validFrom" | "validUntil"> {
  const day = (value: unknown, label: string): DateText | null => {
    if (value === null || value === undefined || value === "") return null;
    if (!isDateText(value)) throw new SetupError(`${label} no es una fecha válida.`);
    return value;
  };
  const from = day(fromInput, "El comienzo");
  const until = day(untilInput, "El vencimiento");
  if (from && until && until < from) throw new SetupError("El vencimiento no puede ser anterior al comienzo.");
  return {
    validFrom: from ? businessDayStart(from) : null,
    validUntil: until ? new Date(Date.parse(businessDayStart(addDays(until, 1))) - 1).toISOString() : null,
  };
}

/** Everything the panel sends, checked. A "free" code always has a limit of uses (docs/SAUNA.md §4), and the table enforces the same. */
export function cleanCode(input: unknown, turnTypeIds: readonly string[]): CodeDraft {
  const value = record(input);
  const code = typeof value.code === "string" ? normalizeCode(value.code) : "";
  if (!isCodeText(code)) throw new SetupError("El código tiene de 3 a 40 caracteres: letras sin tilde, números o guiones.");
  const type = value.type as CodeType;
  if (!codeTypes.includes(type)) throw new SetupError("Elegí el tipo de descuento.");
  const amount = type === "percent" ? whole(value.value, 1, 100, "El porcentaje")
    : type === "fixed" ? whole(value.value, 1, 100_000_000_000, "El monto")
    : 0;
  const maxUses = optionalWhole(value.maxUses, "El máximo de usos");
  if (type === "free" && maxUses === null) throw new SetupError("Un código gratis necesita un máximo de usos.");
  const maxUsesPerCustomer = optionalWhole(value.maxUsesPerCustomer, "El máximo por persona");
  const turnTypeId = value.turnTypeId === null || value.turnTypeId === undefined || value.turnTypeId === "" ? null : String(value.turnTypeId);
  if (turnTypeId !== null && !turnTypeIds.includes(turnTypeId)) throw new SetupError("Ese tipo de turno ya no existe. Recargá la página.");
  const note = typeof value.note === "string" ? value.note.trim() : "";
  if (note.length > 200) throw new SetupError("La nota puede tener hasta 200 caracteres.");
  const id = typeof value.id === "string" && /^[0-9a-f-]{36}$/i.test(value.id) ? value.id : null;
  const updatedAt = typeof value.updatedAt === "string" && !Number.isNaN(Date.parse(value.updatedAt)) ? value.updatedAt : null;
  if (id && !updatedAt) throw new SetupError("Datos inválidos.");
  return {
    id, code, type, value: amount, active: value.active !== false, ...validity(value.validFrom, value.validUntil), maxUses, maxUsesPerCustomer,
    roomId: null, turnTypeId, note, updatedAt,
  };
}

/** What a code does, in a few words, for the panel and the booking form. */
export function describeCode({ type, value }: CodeEffect): string {
  switch (type) {
    case "percent": return `${value} % de descuento`;
    case "fixed": return `${formatCents(value)} de descuento`;
    case "no_deposit": return "Reserva sin seña";
    case "free": return "Sesión sin cargo";
  }
}

export type CodeUses = { total: number; byCustomer: number };

/**
 * Uses are counted, never stored: only current bookings count, so an expired or cancelled one gives its use back with no scheduled task.
 * Pass the bookings that carry this code, read under the code's lock. A customer not yet registered has no id and no uses.
 */
export function countUses(
  bookings: readonly { status: BookingStatus; expiresAt: Instant | null; customerId: string; planPurchaseId?: string | null }[],
  customerId: string | null,
  now: Instant,
): CodeUses {
  const current = bookings.filter(booking => isCurrent(booking, now));
  // A plan carries the code on each of its turns and is one use while any of them is current, as sauna_reserve counts it.
  const distinct = (list: typeof current) => new Set(list.map((booking, index) => booking.planPurchaseId ? `plan:${booking.planPurchaseId}` : index)).size;
  return { total: distinct(current), byCustomer: distinct(current.filter(booking => booking.customerId === customerId)) };
}

/** Null when the code applies to this turn and person. Checked when reserving, in the same transaction that takes the seats. */
export function checkCode(code: DiscountCode, turn: { roomId: string; turnTypeId: string }, uses: CodeUses, now: Instant): CodeRejection | null {
  const current = Date.parse(now);
  if (!code.active) return "code_inactive";
  if (code.validFrom !== null && current < Date.parse(code.validFrom)) return "code_not_started";
  if (code.validUntil !== null && current > Date.parse(code.validUntil)) return "code_expired";
  if (code.roomId !== null && code.roomId !== turn.roomId) return "code_wrong_slot";
  if (code.turnTypeId !== null && code.turnTypeId !== turn.turnTypeId) return "code_wrong_slot";
  if (code.maxUses !== null && uses.total >= code.maxUses) return "code_exhausted";
  if (code.maxUsesPerCustomer !== null && uses.byCustomer >= code.maxUsesPerCustomer) return "code_customer_limit";
  return null;
}
