import { isCents, isPercent, type Cents } from "../../../platform/money/index.ts";
import { record, SetupError, whole } from "./setup.ts";
import { weekdayName } from "./time.ts";

// What the panel configures about when and how much. A turn type is what is sold (45 minutes at one price, 60 at another); a time band is when the sauna is open on a day
// and which types it offers then. Turns are not stored: they follow from those two, one per start and type (public.sauna_availability).

export type TurnType = {
  /** Null until it is saved. */
  id: string | null;
  name: string;
  durationMinutes: number;
  /** Null means this type does not offer that kind of booking. */
  priceCents: Cents | null;
  privatePriceCents: Cents | null;
  /** Null means the site's value. */
  depositPercent: number | null;
  active: boolean;
  revision: number;
};

export type TimeBand = {
  /** 0 is Sunday, like extract(dow from …) in SQL. */
  weekday: number;
  /** HH:mm in Buenos Aires. */
  from: string;
  to: string;
  typeIds: string[];
};

export type WeekRequest = { bands: TimeBand[]; capacity: number; stepMinutes: number; revision: number };

export const offersShared = (type: { priceCents: Cents | null }) => type.priceCents !== null;
export const offersPrivate = (type: { privatePriceCents: Cents | null }) => type.privatePriceCents !== null;

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const isClock = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** What the hour selectors offer. */
export const clockOptions = Array.from({ length: 48 }, (_, index) => toClock(index * 30));

/** The starts of a type in a band: every `stepMinutes` from opening, while the turn still fits whole. Same rule as public.sauna_availability and public.sauna_reserve. */
export function turnStarts({ from, to }: Pick<TimeBand, "from" | "to">, durationMinutes: number, stepMinutes: number): string[] {
  const starts: string[] = [];
  for (let start = toMinutes(from); start + durationMinutes <= toMinutes(to); start += stepMinutes) starts.push(toClock(start));
  return starts;
}

export const bandsOfDay = (bands: readonly TimeBand[], weekday: number) => bands.filter(band => band.weekday === weekday).sort((a, b) => toMinutes(a.from) - toMinutes(b.from));

export function startsExample(types: readonly TurnType[], bands: readonly TimeBand[], stepMinutes: number): string {
  const type = [...types].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const band = [...bands].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.from.localeCompare(b.from)).find(band => band.typeIds.includes(type?.id ?? ""));
  if (!type || !band || stepMinutes <= 0) return "";
  const starts = turnStarts(band, type.durationMinutes, stepMinutes).slice(0, 3);
  return starts.length ? `Con ${type.name} desde las ${band.from}: ${starts.join(", ")}…` : "";
}

export const turnsOverlap = (types: readonly TurnType[], stepMinutes: number): boolean => types.some(type => type.durationMinutes > stepMinutes);

function price(value: unknown): Cents | null {
  if (value === null || value === undefined) return null;
  if (!isCents(value)) throw new SetupError("Revisá los precios: tienen que ser un monto en pesos.");
  return value;
}

export function cleanTurnType(input: unknown): TurnType {
  const value = record(input);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || name.length > 40) throw new SetupError("El nombre del tipo de turno tiene que tener entre 1 y 40 caracteres.");
  const priceCents = price(value.priceCents);
  const privatePriceCents = price(value.privatePriceCents);
  if (priceCents === null && privatePriceCents === null) throw new SetupError(`"${name}" necesita un precio individual o grupal.`);
  const deposit = value.depositPercent ?? null;
  if (deposit !== null && !isPercent(deposit)) throw new SetupError(`La seña de "${name}" tiene que ser un porcentaje entero entre 0 y 100.`);
  return {
    id: typeof value.id === "string" && /^[0-9a-f-]{36}$/i.test(value.id) ? value.id : null,
    name,
    durationMinutes: whole(value.durationMinutes, 5, 600, `La duración de "${name}"`),
    priceCents,
    privatePriceCents,
    depositPercent: deposit as number | null,
    active: value.active !== false,
    revision: typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision >= 1 ? value.revision : 1,
  };
}

/** The week as it will be saved. The messages name the day, because there can be many bands on screen. */
export function cleanWeek(input: unknown, types: readonly TurnType[]): WeekRequest {
  const value = record(input);
  const capacity = whole(value.capacity, 1, 200, "Los lugares");
  const stepMinutes = whole(value.stepMinutes, 5, 240, "El inicio de los turnos");
  const revision = whole(value.revision, 1, Number.MAX_SAFE_INTEGER, "La revisión");
  if (!Array.isArray(value.bands)) throw new SetupError("Datos inválidos.");
  const bands = value.bands.map((item: unknown): TimeBand => {
    const band = record(item);
    const weekday = whole(band.weekday, 0, 6, "El día");
    const day = weekdayName(weekday);
    if (!isClock(band.from) || !isClock(band.to)) throw new SetupError(`Revisá las horas del ${day}.`);
    if (toMinutes(band.to) <= toMinutes(band.from)) throw new SetupError(`El ${day} hay una franja que termina antes de empezar.`);
    const typeIds = Array.isArray(band.typeIds) ? [...new Set(band.typeIds.map(String))] : [];
    if (!typeIds.length) throw new SetupError(`El ${day}, la franja de ${band.from} a ${band.to} no tiene ningún tipo de turno.`);
    for (const id of typeIds) {
      const type = types.find(item => item.id === id && item.active);
      if (!type) throw new SetupError("Ese tipo de turno ya no existe. Recargá la página.");
      if (!turnStarts({ from: band.from, to: band.to }, type.durationMinutes, stepMinutes).length) throw new SetupError(`El ${day}, en la franja de ${band.from} a ${band.to} no entra "${type.name}".`);
    }
    return { weekday, from: band.from, to: band.to, typeIds };
  });
  for (let weekday = 0; weekday < 7; weekday++) {
    const day = bandsOfDay(bands, weekday);
    day.forEach((band, index) => {
      if (index > 0 && toMinutes(band.from) < toMinutes(day[index - 1].to)) throw new SetupError(`El ${weekdayName(weekday)} hay dos franjas que se pisan.`);
    });
  }
  return { bands, capacity, stepMinutes, revision };
}
