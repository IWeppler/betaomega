import "server-only";
import { unstable_cache } from "next/cache";
import { parseVideoStats, statsBatches, type VideoStats } from "../domain/video-stats";

// Views and likes from the YouTube Data API (videos.list, part=statistics: 1 unit of the 10,000 a day per call of up to 50 videos). They
// change slowly and only decorate the cards, so each batch is cached for six hours, shared by every visit.
const statsWindow = 6 * 60 * 60;

const fetchBatch = unstable_cache(async (ids: string[]): Promise<Record<string, VideoStats>> => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return {};
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.map(encodeURIComponent).join(",")}&key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  // A failure throws, so it is not cached: the next visit asks again. The key never reaches the log.
  if (!response.ok) throw new Error(`YouTube respondió ${response.status}`);
  return parseVideoStats(await response.json());
}, ["voices-video-stats"], { revalidate: statsWindow });

let warned = 0;

/** id → views and likes for these videos. Without YOUTUBE_API_KEY, or if YouTube fails, nothing: the cards go without badges. */
export async function videoStats(ids: string[]): Promise<Record<string, VideoStats>> {
  if (!process.env.YOUTUBE_API_KEY || !ids.length) return {};
  try {
    return Object.assign({}, ...await Promise.all(statsBatches(ids).map(fetchBatch)));
  } catch (error) {
    if (Date.now() - warned > 3_600_000) {
      warned = Date.now();
      console.warn("[voices] no se pudieron leer las estadísticas de YouTube:", error instanceof Error ? error.message : error);
    }
    return {};
  }
}
