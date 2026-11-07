export class CustomerError extends Error {}

const MAX_NAME_LENGTH = 80;

export function cleanName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new CustomerError("Escribí tu nombre.");
  if (name.length > MAX_NAME_LENGTH) throw new CustomerError(`El nombre puede tener hasta ${MAX_NAME_LENGTH} caracteres.`);
  return name;
}

const invalidNumber = () => new CustomerError("Revisá el número de WhatsApp: tiene que incluir la característica.");

/**
 * The number in the international form wa.me expects, digits only (5491123456789). The same phone written in different ways has to end up
 * the same, because the customer and the per-person limit of a code are looked up by it. Numbers without a country code are Argentine.
 */
export function cleanWhatsapp(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /[^\d\s()+.-]/.test(text)) throw invalidNumber();
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+") && !digits.startsWith("54")) {
    if (digits.length < 8 || digits.length > 15) throw invalidNumber();
    return digits;
  }
  // The trailing 9 is the mobile prefix of the international form, which people also write after a fixed +54.
  const national = digits.replace(/^549?(?=\d{10,12}$)/, "").replace(/^0/, "").replace(/^9(?=\d{10}$)/, "");
  if (national.length === 10) return `549${national}`;
  // Area code (2 to 4 digits) + the old mobile prefix 15 + number: 11 15 2345 6789.
  if (national.length === 12) {
    const prefixAt = [2, 3, 4].find(at => national.startsWith("15", at));
    if (prefixAt !== undefined) return `549${national.slice(0, prefixAt)}${national.slice(prefixAt + 2)}`;
  }
  throw invalidNumber();
}

/** A customer's number: bookings are only for Argentine phones. The site's own contact number, set in the panel, uses cleanWhatsapp. */
export function cleanArgentineWhatsapp(value: unknown): string {
  const number = cleanWhatsapp(value);
  if (!number.startsWith("54")) throw invalidNumber();
  return number;
}
