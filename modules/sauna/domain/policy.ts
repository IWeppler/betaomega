import { isCents, isPercent, percentOf, type Cents } from "../../../platform/money/index.ts";
import type { Instant } from "./booking.ts";

/** "When cancelled at least `hoursBefore` hours ahead, `refundPercent` % of the deposit comes back." */
export type PolicyRule = { hoursBefore: number; refundPercent: number };

export class PolicyError extends Error {}

/** A policy's tiers, from anything that comes from outside (the panel, a stored snapshot). Sorted from the earliest cancellation down. */
export function cleanRules(value: unknown): PolicyRule[] {
  if (!Array.isArray(value) || value.length === 0) throw new PolicyError("La política necesita al menos un tramo.");
  const rules = value.map(item => {
    const { hoursBefore, refundPercent } = (item ?? {}) as Record<string, unknown>;
    if (typeof hoursBefore !== "number" || !Number.isInteger(hoursBefore) || hoursBefore < 0) throw new PolicyError("Las horas de cada tramo tienen que ser un número entero, 0 o más.");
    if (!isPercent(refundPercent)) throw new PolicyError("El reintegro de cada tramo tiene que ser un porcentaje entero entre 0 y 100.");
    return { hoursBefore, refundPercent };
  });
  if (new Set(rules.map(rule => rule.hoursBefore)).size !== rules.length) throw new PolicyError("Hay dos tramos con las mismas horas.");
  return rules.sort((a, b) => b.hoursBefore - a.hoursBefore);
}

/** The tiers in words, as the person reads them before booking and on their booking page. Most hours first. */
export function describeRules(rules: readonly PolicyRule[]): string[] {
  return [...rules].sort((a, b) => b.hoursBefore - a.hoursBefore).map(({ hoursBefore, refundPercent }) => {
    const when = hoursBefore === 0 ? "Hasta el inicio del turno" : `Con ${hoursBefore === 1 ? "1 hora" : `${hoursBefore} horas`} o más de anticipación`;
    return `${when}: ${refundPercent === 0 ? "no se reintegra la seña" : refundPercent === 100 ? "se reintegra toda la seña" : `se reintegra el ${refundPercent} % de la seña`}.`;
  });
}

const HOUR = 3_600_000;

/** The tier with the most hours that the cancellation still reaches. Once the turn started, or below every tier, nothing comes back. */
export function refundPercentFor(rules: readonly PolicyRule[], startsAt: Instant, now: Instant): number {
  const hoursLeft = (Date.parse(startsAt) - Date.parse(now)) / HOUR;
  if (hoursLeft < 0) return 0;
  const reached = rules.filter(rule => hoursLeft >= rule.hoursBefore);
  return reached.length ? reached.reduce((best, rule) => (rule.hoursBefore > best.hoursBefore ? rule : best)).refundPercent : 0;
}

/** What the panel suggests when cancelling, from the rules saved with the booking. The person attending can enter another amount. */
export function proposeRefund(rules: readonly PolicyRule[], startsAt: Instant, now: Instant, depositPaidCents: Cents): Cents {
  return percentOf(depositPaidCents, refundPercentFor(rules, startsAt, now));
}

/** A pack session is suggested back only when its tier returns everything (docs/SAUNA.md §11). */
export const proposesSessionReturn = (rules: readonly PolicyRule[], startsAt: Instant, now: Instant) => refundPercentFor(rules, startsAt, now) === 100;

/** Null when the amount can be refunded; otherwise the message for the person attending. Partial refunds add up and can never pass what was charged. */
export function refundError(amountCents: Cents, refundableCents: Cents): string | null {
  if (!isCents(amountCents) || amountCents === 0) return "Ingresá un monto mayor a cero.";
  return amountCents > refundableCents ? "El reintegro supera lo que queda por devolver." : null;
}
