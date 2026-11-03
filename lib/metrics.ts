// Own metrics of the recipe sites: visits, views of each recipe and shares. Pure code: the tracker, the API, the panel and the tests share it.
export const shareChannels = [
  { id: "nativo", label: "Menú de compartir del celular" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "copiar", label: "Copiar link" },
] as const;
export type ShareChannel = (typeof shareChannels)[number]["id"];
export const isShareChannel = (value: unknown): value is ShareChannel => shareChannels.some(c => c.id === value);
export const channelLabel = (id: string) => shareChannels.find(c => c.id === id)?.label ?? id;

/** What the public site reports. A "view" counts the page and, with a recipe, that recipe's view too. */
export type MetricEvent = { kind: "view"; recipeId?: string } | { kind: "share"; recipeId?: string; channel: ShareChannel };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function fail(message: string): never { throw new Error(message); }

/** Checks what the browser sent. Throws on anything unknown, so garbage never reaches the database. */
export function cleanMetric(value: unknown): MetricEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Evento inválido.");
  const data = value as Record<string, unknown>;
  const recipeId = data.recipeId === undefined || data.recipeId === null || data.recipeId === "" ? undefined : typeof data.recipeId === "string" && uuid.test(data.recipeId) ? data.recipeId : fail("Receta inválida.");
  if (data.kind === "view") return { kind: "view", recipeId };
  if (data.kind === "share") return { kind: "share", recipeId, channel: isShareChannel(data.channel) ? data.channel : fail("Canal inválido.") };
  return fail("Evento inválido.");
}

export const reportRanges = [7, 30, 90] as const;
export type ReportRange = (typeof reportRanges)[number];
export type DayRow = { day: string; pageViews: number; recipeViews: number; shares: number };
export type RecipeMetric = { id: string; views: number; shares: number };
/** The answer of the metrics_report function. `daily` only has the days with activity. */
export type MetricsReport = {
  /** Argentina's calendar day of the report, "2026-11-03". */
  today: string;
  days: number;
  totals: { pageViews: number; recipeViews: number; shares: number };
  daily: DayRow[];
  recipes: RecipeMetric[];
  channels: Record<string, number>;
};

/** "2026-11-03" moved by `delta` days. Pure calendar arithmetic (UTC), so time zones and daylight saving do not matter. */
export function shiftDay(day: string, delta: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** One row per day of the range, oldest first, with zeros where nothing happened (the database only returns the days with activity). */
export function fillDays(report: Pick<MetricsReport, "today" | "days" | "daily">): DayRow[] {
  const byDay = new Map(report.daily.map(row => [row.day, row]));
  return Array.from({ length: report.days }, (_, n) => {
    const day = shiftDay(report.today, n - report.days + 1);
    return byDay.get(day) ?? { day, pageViews: 0, recipeViews: 0, shares: 0 };
  });
}

export type RecipeSortKey = "views" | "shares" | "total" | "title";
export type RecipeRow = { id: string; title: string; views: number; shares: number; total: number };
/** Rows by the chosen column, the biggest first (names A to Z); ties fall back to the name so the order never jumps around. */
export function sortRecipeRows(rows: RecipeRow[], key: RecipeSortKey) {
  const byName = (a: RecipeRow, b: RecipeRow) => a.title.localeCompare(b.title, "es", { sensitivity: "base" });
  return [...rows].sort((a, b) => key === "title" ? byName(a, b) : b[key] - a[key] || byName(a, b));
}

/** Compact number for a chart axis: 950, 1.2K, 12K. */
export const compactNumber = (n: number) => (n < 1000 ? String(n) : `${Number((n / 1000).toFixed(n < 10_000 ? 1 : 0))}K`);
/** A round maximum for the y axis (at least 4, so a quiet site does not show a flat scale) and its tick values. */
export function niceScale(max: number, ticks = 4) {
  const raw = Math.max(max, ticks) / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(f => f * magnitude).find(s => s >= raw) ?? raw;
  return { max: step * ticks, ticks: Array.from({ length: ticks + 1 }, (_, n) => step * n) };
}
