// Editable data of a recipe site (tagline, search description, Instagram, contact). Pure code: the panel, the API, the public site and the tests share it.
// It is stored as the app_data document `site:<id>`; without one, the site uses the defaults below.
export type SiteSettings = {
  tagline: string;
  /** For search engines and link previews. */
  description: string;
  /** Instagram handle without "@". */
  instagram: string;
  /** An email, or a WhatsApp number as digits only (country code included). */
  contact: string;
  /** Mercado Pago alias or payment link for the donation button. Undefined: never set (the default applies); empty: no button. */
  donation?: string;
  /** Increases on every save; a save names the revision it started from. 0: nothing stored yet. */
  revision: number;
};

/** What the recipe template says when nothing was edited. */
export const recipeSiteDefaults = {
  tagline: "Comidas del Cielo",
  description: "Comidas del Cielo. Buscá por plato, tipo o ingrediente.",
};

/** Mercado Pago payment link of the site's owner, used until the panel sets another one (or empties it to hide the button). */
export const defaultDonation = "https://link.mercadopago.com.ar/betayomega";

export const settingsKey = (siteId: string) => `site:${siteId}`;
export const blankSettings = (): SiteSettings => ({
  tagline: "",
  description: "",
  instagram: "",
  contact: "",
  revision: 0,
});

function fail(message: string): never {
  throw new Error(message);
}
const text = (value: unknown, label: string, max: number) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") fail(`${label} inválido.`);
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length > max)
    fail(`${label} es demasiado largo (máximo ${max} caracteres).`);
  return clean;
};

/** "@mi.cocina", "mi.cocina" or "https://www.instagram.com/mi.cocina/" → "mi.cocina". */
export function cleanInstagram(value: string) {
  const handle = value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  if (!handle) return "";
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle))
    fail("Instagram: escribí solo el usuario, por ejemplo @comidasdelcielo.");
  return handle;
}

/**
 * A Mercado Pago alias ("ignacioweppler.mp") or an https payment link. Empty hides the button.
 * A link pasted without the protocol ("link.mercadopago.com.ar/betayomega") gets https:// in front.
 */
export function cleanDonation(value: string) {
  let clean = value.trim();
  if (!clean) return "";
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(clean)) clean = `https://${clean}`;
  if (clean.toLowerCase().startsWith("https://")) {
    try {
      return new URL(clean).toString();
    } catch {
      fail("Donaciones: el enlace no es válido.");
    }
  }
  if (!/^[A-Za-z0-9.-]{6,20}$/.test(clean))
    fail(
      "Donaciones: escribí tu alias de Mercado Pago (6 a 20 letras, números, puntos o guiones) o un enlace https.",
    );
  return clean.toLowerCase();
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** An email (lowercased) or a phone number reduced to digits: "+54 9 11 5555-1234" → "5491155551234". */
export function cleanContact(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  if (clean.includes("@")) {
    if (!emailPattern.test(clean)) fail("Contacto: el mail no es válido.");
    return clean.toLowerCase();
  }
  if (!/^\+?[\d\s().-]+$/.test(clean))
    fail(
      "Contacto: escribí un mail o un número de WhatsApp con código de país.",
    );
  const digits = clean.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15)
    fail(
      "Contacto: el número de WhatsApp tiene que incluir el código de país (por ejemplo +54 9 11 5555 1234).",
    );
  return digits;
}

/** Checks what the panel sent and returns a clean copy with only the known fields. Throws a message for the person. */
export function cleanSettings(value: unknown): SiteSettings {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Datos inválidos.");
  const data = value as Record<string, unknown>;
  const revision =
    typeof data.revision === "number" &&
    Number.isInteger(data.revision) &&
    data.revision >= 0
      ? data.revision
      : fail("Datos inválidos.");
  return {
    revision,
    tagline: text(data.tagline, "El lema", 60),
    description: text(data.description, "La descripción", 300),
    instagram: cleanInstagram(text(data.instagram, "Instagram", 120)),
    contact: cleanContact(text(data.contact, "El contacto", 120)),
    ...(data.donation === undefined
      ? {}
      : { donation: cleanDonation(text(data.donation, "Donaciones", 300)) }),
  };
}

/** What the public site uses: each field the person left empty falls back to the template's text. Instagram and contact stay optional. */
export function effectiveSettings(stored: SiteSettings | null) {
  return {
    tagline: stored?.tagline || recipeSiteDefaults.tagline,
    description: stored?.description || recipeSiteDefaults.description,
    instagram: stored?.instagram ?? "",
    contact: stored?.contact ?? "",
    donation: stored?.donation ?? defaultDonation,
  };
}

/** Footer links for the stored values. */
export function socialLinks(settings: { instagram: string; contact: string }) {
  const links: { label: string; href: string }[] = [];
  if (settings.instagram)
    links.push({
      label: `@${settings.instagram}`,
      href: `https://www.instagram.com/${settings.instagram}`,
    });
  if (settings.contact.includes("@"))
    links.push({ label: settings.contact, href: `mailto:${settings.contact}` });
  else if (settings.contact)
    links.push({
      label: "WhatsApp",
      href: `https://wa.me/${settings.contact}`,
    });
  return links;
}
