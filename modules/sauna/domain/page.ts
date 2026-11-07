import type { TimeBand } from "./hours.ts";
import { record, SetupError } from "./setup.ts";
import { weekdayName } from "./time.ts";

// What the public home page says, edited from the panel. A section with nothing to say is not shown. The starting texts are general and promise no health benefit;
// they still have to be reviewed before the site goes public (docs/SAUNA.md §12).

export type PageContent = {
  headline: string;
  intro: string;
  /** For search engines and link previews. */
  description: string;
  includes: string[];
  bring: string[];
  recommendations: string[];
  indications: string[];
  contraindications: string[];
  address: string;
  /** A link to the place on a map. */
  mapUrl: string;
  /** Paragraphs separated by a blank line. */
  terms: string;
  /** Increases on every save; a save names the revision it started from. 0: nothing stored yet. */
  revision: number;
};

export const DEFAULT_TERMS = `Al reservar aceptás estas condiciones y declarás tener 18 años o más.

Reserva y seña. Tu lugar queda retenido por un tiempo limitado hasta que se confirma. El saldo se paga en el lugar. El precio que vale es el que ves al reservar.

Cancelación. Las cancelaciones se piden por WhatsApp desde el enlace de tu reserva. Lo que se reintegra depende de la anticipación, según la política que ves al reservar y en tu reserva.

Salud. El uso del sauna es bajo tu responsabilidad. Si tenés alguna condición de salud, o estás cursando un embarazo, consultá antes con un profesional.

Datos personales. Guardamos tu nombre y tu WhatsApp solo para atender tu reserva. No guardamos datos de salud. Podés pedir que borremos tus datos en cualquier momento: conservamos las reservas y los pagos sin identificarte.`;

export const pageDefaults = (): PageContent => ({
  headline: "Afuera, el mundo. Adentro, la calma.",
  intro: "El calor abraza. El tiempo se detiene. Una sesión de sauna para hacer una pausa.",
  description: "Sauna con reserva online, individual o grupal. Elegí día y horario, y guardá tu turno.",
  includes: ["Uso del sauna durante todo el turno", "Vestuario y ducha", "Agua fresca"],
  bring: ["Dos toallas: una para sentarte y otra para secarte", "Malla", "Ojotas", "Una botella de agua"],
  recommendations: [
    "Tomá agua antes, durante y después.",
    "Comé liviano: no vengas en ayunas ni recién comido.",
    "Duchate antes de entrar.",
    "Empezá por el banco más bajo y andá a tu ritmo.",
    "Salí a refrescarte cada vez que lo necesites.",
    "Al terminar, descansá unos minutos antes de irte.",
  ],
  indications: [
    "Llegá 10 minutos antes de tu turno.",
    "Sacate relojes, anillos y cadenas: el metal se calienta.",
    "Sentate o acostate siempre sobre tu toalla.",
    "Dejá el celular afuera.",
    "Si te sentís mareado o con malestar, salí enseguida y avisanos.",
    "No se puede entrar bajo los efectos del alcohol o de otras sustancias.",
  ],
  contraindications: [
    "Embarazo",
    "Problemas del corazón",
    "Presión alta o baja sin controlar",
    "Epilepsia",
    "Fiebre o una infección en curso",
    "Heridas abiertas o afecciones de la piel",
    "Medicación que afecte la circulación o la sudoración",
  ],
  address: "",
  mapUrl: "",
  terms: DEFAULT_TERMS,
  revision: 0,
});

function text(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new SetupError(`${label}: formato inválido.`);
  const clean = value.trim();
  if (clean.length > max) throw new SetupError(`${label} puede tener hasta ${max} caracteres.`);
  return clean;
}

const MAX_ITEMS = 12;

/** One item per line, in the panel. Empty lines do not count. */
function list(value: unknown, label: string): string[] {
  const items = (Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : []).map(item => text(item, label, 200)).filter(Boolean);
  if (items.length > MAX_ITEMS) throw new SetupError(`${label} puede tener hasta ${MAX_ITEMS} líneas.`);
  return items;
}

export function cleanPage(input: unknown): PageContent {
  const value = record(input);
  const headline = text(value.headline, "El título", 70);
  if (!headline) throw new SetupError("Escribí el título de la portada.");
  const mapUrl = text(value.mapUrl, "El enlace al mapa", 500);
  if (mapUrl && !/^https:\/\/\S+$/.test(mapUrl)) throw new SetupError("El enlace al mapa tiene que empezar con https://.");
  return {
    headline,
    intro: text(value.intro, "La presentación", 200),
    description: text(value.description, "La descripción para buscadores", 200),
    includes: list(value.includes, "Qué incluye"),
    bring: list(value.bring, "Qué traer"),
    recommendations: list(value.recommendations, "Recomendaciones"),
    indications: list(value.indications, "Indicaciones"),
    contraindications: list(value.contraindications, "Contraindicaciones"),
    address: text(value.address, "La dirección", 200),
    mapUrl,
    terms: text(value.terms, "Los términos", 8000),
    revision: typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
  };
}

/** Opening hours in words, Monday first, joining consecutive days with the same hours: "Lunes a viernes: 10:00 a 19:45". */
export function hoursSummary(bands: readonly TimeBand[]): string[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const hoursOf = (weekday: number) => bands.filter(band => band.weekday === weekday).sort((a, b) => a.from.localeCompare(b.from)).map(band => `${band.from} a ${band.to}`).join(" y ");
  const groups: { first: number; last: number; hours: string }[] = [];
  for (const weekday of order) {
    const hours = hoursOf(weekday);
    const previous = groups.at(-1);
    if (!hours) continue;
    if (previous && previous.hours === hours && order.indexOf(previous.last) === order.indexOf(weekday) - 1) previous.last = weekday;
    else groups.push({ first: weekday, last: weekday, hours });
  }
  return groups.map(({ first, last, hours }) => {
    const span = order.indexOf(last) - order.indexOf(first);
    const days = span === 0 ? weekdayName(first) : `${weekdayName(first)} ${span === 1 ? "y" : "a"} ${weekdayName(last)}`;
    return `${days[0].toUpperCase()}${days.slice(1)}: ${hours}`;
  });
}
