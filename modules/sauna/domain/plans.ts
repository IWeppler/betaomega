import { percentOf, type Cents } from "../../../platform/money/index.ts";
import type { Instant } from "./booking.ts";
import { discountFor, type CodeEffect } from "./pricing.ts";
import type { PlanRejection } from "./rejections.ts";
import { SetupError, record } from "./setup.ts";
import { businessDate, type DateText } from "./time.ts";

// Plans (docs/SAUNA.md §11): a fixed price for a number of turns chosen at once, one per day and all within a window of days.
// public.sauna_reserve_plan applies the same rules again: what is here is for the panel's form and the booking screen.

export type Plan = {
  id: string;
  name: string;
  description: string;
  turns: number;
  priceCents: Cents;
  /** The first and the last turn fall within this many days, counting the first one. */
  windowDays: number;
  /** How long each turn lasts: only turn types of this length are offered. Null, for plans saved before it was asked, takes any length. */
  durationMinutes: number | null;
  /** Whether a discount code applies to the plan's price. */
  allowsCodes: boolean;
  active: boolean;
  updatedAt: string;
};

export type PlanDraft = Omit<Plan, "id" | "updatedAt" | "durationMinutes"> & { id: string | null; updatedAt: string | null; durationMinutes: number };

export const PLAN_TURNS = { min: 2, max: 12 } as const;

const UUID = /^[0-9a-f-]{36}$/i;

const text = (value: unknown, max: number, label: string, required: boolean) => {
  const clean = typeof value === "string" ? value.trim() : "";
  if (required && !clean) throw new SetupError(`Falta ${label}.`);
  if (clean.length > max) throw new SetupError(`${label[0].toUpperCase()}${label.slice(1)} puede tener hasta ${max} caracteres.`);
  return clean;
};

const whole = (value: unknown, min: number, max: number, message: string) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new SetupError(message);
  return value;
};

/**
 * What the panel sends. The price arrives in cents: the form converts the pesos. `durations` are the lengths of the site's turn types: a plan of
 * another length could never be booked.
 */
export function cleanPlan(input: unknown, durations: readonly number[]): PlanDraft {
  const value = record(input);
  const turns = whole(value.turns, PLAN_TURNS.min, PLAN_TURNS.max, `Un plan tiene entre ${PLAN_TURNS.min} y ${PLAN_TURNS.max} turnos.`);
  const priceCents = whole(value.priceCents, turns * 100, 1_000_000_000, `El precio tiene que ser de al menos $${turns}, un peso por turno.`);
  const durationMinutes = whole(value.durationMinutes, 5, 600, "Elegí cuánto dura cada turno del plan.");
  if (!durations.includes(durationMinutes)) throw new SetupError("Ningún tipo de turno dura eso. Elegí una de las duraciones de la lista.");
  return {
    id: typeof value.id === "string" && UUID.test(value.id) ? value.id : null,
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : null,
    name: text(value.name, 80, "el nombre", true),
    description: text(value.description, 300, "la descripción", false),
    turns,
    priceCents,
    windowDays: whole(value.windowDays, 1, 365, "Los días para usar el plan van de 1 a 365."),
    durationMinutes,
    allowsCodes: value.allowsCodes === true,
    active: value.active === true,
  };
}

export type PlanShare = { priceCents: Cents; discountCents: Cents; depositCents: Cents };

/**
 * A purchase's amounts split across its turns in whole cents, as sauna_reserve_plan splits them. The price evenly, the first turn taking what does
 * not divide; the discount in proportion to each price and the deposit to what each turn costs after it, both by running totals rounded down. So
 * every part adds up to its total and no turn takes a discount above its price or a deposit above what it costs.
 */
export function splitPlan(priceCents: Cents, discountCents: Cents, depositCents: Cents, turns: number): PlanShare[] {
  const net = priceCents - discountCents;
  const shares: PlanShare[] = [];
  let before = { price: 0, discount: 0, deposit: 0 };
  for (let index = 1; index <= turns; index++) {
    const price = Math.floor(priceCents / turns) * index + (priceCents % turns);
    const discount = Math.floor((discountCents * price) / priceCents);
    const deposit = net === 0 ? 0 : Math.floor((depositCents * (price - discount)) / net);
    shares.push({ priceCents: price - before.price, discountCents: discount - before.discount, depositCents: deposit - before.deposit });
    before = { price, discount, deposit };
  }
  return shares;
}

/**
 * What the person pays now and later. As for a single booking (pricing.ts), the code comes first and the deposit is the site's percent of the
 * discounted price; "no_deposit" keeps the price and charges nothing now.
 */
export function planQuote(plan: Pick<Plan, "priceCents">, depositPercent: number, code: CodeEffect | null = null) {
  const discountCents = discountFor(code, plan.priceCents);
  const totalCents = plan.priceCents - discountCents;
  const depositCents = code?.type === "no_deposit" ? 0 : percentOf(totalCents, depositPercent);
  return { priceCents: plan.priceCents, discountCents, totalCents, depositCents, balanceCents: totalCents - depositCents };
}

const dayNumber = (date: DateText) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

/** Whether a turn has the plan's length. */
export const fitsPlan = (turn: { startsAt: Instant; endsAt: Instant }, plan: Pick<Plan, "durationMinutes">) =>
  plan.durationMinutes === null || Date.parse(turn.endsAt) - Date.parse(turn.startsAt) === plan.durationMinutes * 60_000;

/** Why a set of turns does not fit the plan, or null. `complete` also asks for exactly the plan's number of turns. */
export function planProblem(starts: readonly Instant[], plan: Pick<Plan, "turns" | "windowDays">, complete: boolean): PlanRejection | null {
  if (starts.length > plan.turns || (complete && starts.length !== plan.turns)) return "plan_turn_count";
  const days = starts.map(businessDate);
  if (new Set(days).size !== days.length) return "plan_same_day";
  if (days.length > 1) {
    const numbers = days.map(dayNumber);
    if (Math.max(...numbers) - Math.min(...numbers) >= plan.windowDays) return "plan_window";
  }
  return null;
}

/** "90 minutos", "1 hora", "1 h 30 min". */
export function durationText(minutes: number) {
  if (minutes < 60) return `${minutes} minutos`;
  if (minutes % 60 === 0) return minutes === 60 ? "1 hora" : `${minutes / 60} horas`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** "4 turnos de 1 hora, uno por día, dentro de 30 días" */
export const planSummary = (plan: Pick<Plan, "turns" | "windowDays" | "durationMinutes">) =>
  `${plan.turns} turnos${plan.durationMinutes === null ? "" : ` de ${durationText(plan.durationMinutes)}`}, uno por día, dentro de ${plan.windowDays === 1 ? "1 día" : `${plan.windowDays} días`}`;
