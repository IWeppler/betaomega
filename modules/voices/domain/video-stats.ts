// Views and likes of the voices' YouTube videos, as the YouTube Data API returns them (videos.list, part=statistics). Pure: the fetch is in data/.

/** What a card shows. A video can hide its likes; then `likes` is missing. */
export type VideoStats = { views?: number; likes?: number };

/** The API takes at most 50 ids a call. */
export const statsBatchSize = 50;

const count = (value: unknown) => {
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) ? number : undefined;
};

/** Reads a videos.list answer into id → stats. Anything unexpected is skipped, never thrown: the badges are optional. */
export function parseVideoStats(body: unknown): Record<string, VideoStats> {
  const items = (body as { items?: unknown } | null)?.items;
  const out: Record<string, VideoStats> = {};
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    const { id, statistics } = (item ?? {}) as { id?: unknown; statistics?: Record<string, unknown> };
    if (typeof id !== "string" || !statistics) continue;
    const views = count(statistics.viewCount);
    const likes = count(statistics.likeCount);
    if (views === undefined && likes === undefined) continue;
    out[id] = { ...(views !== undefined ? { views } : {}), ...(likes !== undefined ? { likes } : {}) };
  }
  return out;
}

/** The ids in groups of 50, without repeats, in a stable order so the same list is the same cache key. */
export function statsBatches(ids: string[]) {
  const unique = [...new Set(ids)].sort();
  const batches: string[][] = [];
  for (let n = 0; n < unique.length; n += statsBatchSize) batches.push(unique.slice(n, n + statsBatchSize));
  return batches;
}

const oneDecimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/**
 * 950 → "950", 1234 → "1,2 mil", 3400000 → "3,4 M": short, the way Argentina writes them. Written by hand because Intl's compact notation says
 * "1,2 K" for es-AR in some runtimes and "1,2 mil" in others, and the server and the browser must agree.
 */
export function shortCount(value: number) {
  if (value < 1000) return oneDecimal.format(value);
  if (value < 1_000_000) return `${oneDecimal.format(Math.floor(value / 100) / 10)} mil`;
  return `${oneDecimal.format(Math.floor(value / 100_000) / 10)} M`;
}
