import { percentOf, type Cents } from "../../../platform/money/index.ts";
import type { Instant } from "./booking.ts";
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
  active: boolean;
  updatedAt: string;
};

export type PlanDraft = Omit<Plan, "id" | "updatedAt"> & { id: string | null; updatedAt: string | null };

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

/** What the panel sends. The price arrives in cents: the form converts the pesos. */
export function cleanPlan(input: unknown): PlanDraft {
  const value = record(input);
  const turns = whole(value.turns, PLAN_TURNS.min, PLAN_TURNS.max, `Un plan tiene entre ${PLAN_TURNS.min} y ${PLAN_TURNS.max} turnos.`);
  const priceCents = whole(value.priceCents, turns * 100, 1_000_000_000, `El precio tiene que ser de al menos $${turns}, un peso por turno.`);
  return {
    id: typeof value.id === "string" && UUID.test(value.id) ? value.id : null,
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : null,
    name: text(value.name, 80, "el nombre", true),
    description: text(value.description, 300, "la descripción", false),
    turns,
    priceCents,
    windowDays: whole(value.windowDays, 1, 365, "Los días para usar el plan van de 1 a 365."),
    active: value.active === true,
  };
}

/** An amount split in whole cents, the first part taking what does not divide. The same split as sauna_reserve_plan. */
export function splitCents(total: Cents, parts: number): Cents[] {
  const base = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, index) => base + (index === 0 ? total - base * parts : 0));
}

/** What the person pays now and later. The deposit is the site's percent of the plan's price, rounded as everywhere else. */
export function planQuote(plan: Pick<Plan, "priceCents">, depositPercent: number) {
  const depositCents = percentOf(plan.priceCents, depositPercent);
  return { totalCents: plan.priceCents, depositCents, balanceCents: plan.priceCents - depositCents };
}

const dayNumber = (date: DateText) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

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

/** "4 turnos para usar en 30 días" */
export const planSummary = (plan: Pick<Plan, "turns" | "windowDays">) =>
  `${plan.turns} turnos, uno por día, dentro de ${plan.windowDays === 1 ? "1 día" : `${plan.windowDays} días`}`;
