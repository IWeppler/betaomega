// Money is whole cents, always. This is the only place that decides how a percentage rounds, and public.sauna_percent_of in
// supabase/schema.sql repeats the same integer formula: a test in modules/sauna/schema.test.ts keeps the two in agreement.

export type Cents = number;

/** Far above any real amount, and low enough that `cents * 100` stays exact in a JavaScript number. */
export const MAX_CENTS = 90_000_000_000_000;

export class MoneyError extends Error {}

export const isCents = (value: unknown): value is Cents =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS;

export const isPercent = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;

/** A percentage of an amount, with exact halves rounded up. Integer arithmetic only, so no float can shift a cent. */
export function percentOf(cents: Cents, percent: number): Cents {
  if (!isCents(cents)) throw new MoneyError(`Monto inválido: ${cents}`);
  if (!isPercent(percent)) throw new MoneyError(`Porcentaje inválido: ${percent}`);
  return Math.floor((cents * percent + 50) / 100);
}

/**
 * What a person types into a price field, in cents, or null when it cannot be read as an amount: "1500", "1.500", "1.500,50", "1500,5", "1500.50".
 * A dot followed by exactly three digits is a thousands separator. Digits only, so no float can shift a cent.
 */
export function centsFromPesos(text: string): Cents | null {
  const value = text.trim().replace(/^\$\s*/, "");
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const cents = Number(match[1].replace(/\./g, "")) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return isCents(cents) ? cents : null;
}

/** The value a price field starts with: the inverse of centsFromPesos, without thousands separators. */
export function pesosFromCents(cents: Cents): string {
  const rest = cents % 100;
  return `${Math.floor(cents / 100)}${rest ? `,${String(rest).padStart(2, "0")}` : ""}`;
}

/** For display only: "$ 1.500" or "$ 1.500,50". Written by hand because Intl output differs between server and browser. */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new MoneyError(`Monto inválido: ${cents}`);
  const whole = Math.floor(Math.abs(cents) / 100);
  const rest = Math.abs(cents) % 100;
  const thousands = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cents < 0 ? "-" : ""}$ ${thousands}${rest ? `,${String(rest).padStart(2, "0")}` : ""}`;
}
