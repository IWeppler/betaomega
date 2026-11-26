// Own metrics of the voces sagradas sites: visits, views of each voice and what people search. Pure: the tracker, the API, the panel and the tests.

/** What the public site reports. A view counts the page and, with a voice, that voice's view too. A search reports the words, normalized. */
export type MetricEvent = { kind: "view"; voiceId?: string } | { kind: "search"; term: string };

export const minSearchLength = 3;
export const maxSearchLength = 60;

function fail(message: string): never {
  throw new Error(message);
}

/**
 * The form a search is counted under: lower case, without accents or punctuation, single spaces. "  Protección,  FAMILIA " and "proteccion familia"
 * count as one. Empty when too short to mean anything.
 */
export function searchTerm(text: string) {
  const term = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, maxSearchLength).trim();
  return term.length >= minSearchLength ? term : "";
}

/** Checks what the browser sent. Throws on anything unknown, so garbage never reaches the database. */
export function cleanMetric(value: unknown): MetricEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Evento inválido.");
  const data = value as Record<string, unknown>;
  if (data.kind === "view") {
    if (data.voiceId === undefined || data.voiceId === null || data.voiceId === "") return { kind: "view" };
    if (typeof data.voiceId !== "string" || !/^[\w-]{1,100}$/.test(data.voiceId)) fail("Voz inválida.");
    return { kind: "view", voiceId: data.voiceId };
  }
  if (data.kind === "search") {
    const term = typeof data.term === "string" ? searchTerm(data.term) : "";
    if (!term) fail("Búsqueda inválida.");
    return { kind: "search", term };
  }
  return fail("Evento inválido.");
}

/** Crawlers and link previews are not readers. */
export const looksLikeBot = (userAgent: string | null) => !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|headless/i.test(userAgent);

export const reportRanges = [7, 30, 90] as const;
export type ReportRange = (typeof reportRanges)[number];
export type DayRow = { day: string; pageViews: number; voiceViews: number; searches: number };
/** The answer of voice_metrics_report. `daily` only has the days with activity. */
export type MetricsReport = {
  today: string;
  days: number;
  totals: { pageViews: number; voiceViews: number; searches: number };
  daily: DayRow[];
  voices: { id: string; views: number }[];
  searches: { term: string; count: number }[];
};

/** "2026-11-03" moved by `delta` days, as calendar arithmetic (UTC), so time zones do not matter. */
export function shiftDay(day: string, delta: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** One row per day of the range, oldest first, with zeros where nothing happened. */
export function fillDays(report: Pick<MetricsReport, "today" | "days" | "daily">): DayRow[] {
  const byDay = new Map(report.daily.map(row => [row.day, row]));
  return Array.from({ length: report.days }, (_, n) => {
    const day = shiftDay(report.today, n - report.days + 1);
    return byDay.get(day) ?? { day, pageViews: 0, voiceViews: 0, searches: 0 };
  });
}
