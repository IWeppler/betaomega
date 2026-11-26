import "server-only";
import { unstable_cache } from "next/cache";
import { siteDocument } from "@/platform/db";
import { publicRevalidate, publicTags } from "@/platform/sites/server";
import { adviceCard, adviceCount, cleanAdviceBook, type AdviceBook, type AdviceCard } from "../domain/advice";

// The book is the `advice:<site>` document of app_data. The public pages read it through a cache of the public window; the panel's saves
// invalidate it (api/advice-book.ts), and a change made straight in the base shows within the hour.

/** Thrown when somebody saved the book after it was read. */
export class AdviceConflictError extends Error {}

/** The book as it is now, for the panel. A site without one gets an empty book named after its option. */
export async function readAdviceBook(siteId: string, chapterName: string): Promise<AdviceBook> {
  const data = await siteDocument("advice", siteId).read();
  return data === null ? { revision: 0, chapterName, chapters: [] } : cleanAdviceBook(data);
}

/** Saves the whole book over the version that was read; the answer is the stored book with its new revision. */
export async function saveAdviceBook(siteId: string, book: AdviceBook): Promise<AdviceBook> {
  const next = { ...book, revision: book.revision + 1 };
  if (!await siteDocument("advice", siteId).save(next, book.revision)) throw new AdviceConflictError("Otra persona hizo cambios en los consejos. Recargá la página antes de guardar.");
  return next;
}

const readPublicBook = unstable_cache(async (siteId: string): Promise<AdviceBook | null> => {
  const data = await siteDocument("advice", siteId).read();
  return data === null ? null : cleanAdviceBook(data);
}, ["public-advice", process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""], { revalidate: publicRevalidate, tags: [publicTags.advice] });

let warned = 0;

/** One advice at random, or null when the site has no book. A failed read never breaks the page: it is logged at most once an hour. */
export async function drawAdvice(siteId: string, random = Math.random): Promise<AdviceCard | null> {
  try {
    const book = await readPublicBook(siteId);
    if (!book) return null;
    const count = adviceCount(book);
    return count ? adviceCard(book, Math.floor(random() * count)) : null;
  } catch (error) {
    if (Date.now() - warned > 3_600_000) {
      warned = Date.now();
      console.warn(`[advice] no se pudo leer el libro de consejos de ${siteId}:`, error instanceof Error ? error.message : error);
    }
    return null;
  }
}

/**
 * Several different advices at random, for the list beside the home page; fewer when the book has fewer, none without a book. Like
 * drawAdvice, a failed read leaves the page without them.
 */
export async function drawAdvices(siteId: string, count: number, random = Math.random): Promise<AdviceCard[]> {
  try {
    const book = await readPublicBook(siteId);
    if (!book) return [];
    const total = adviceCount(book);
    const picked = new Set<number>();
    while (picked.size < Math.min(count, total)) picked.add(Math.floor(random() * total));
    return [...picked].map(index => adviceCard(book, index)).filter(card => card !== null);
  } catch (error) {
    console.warn(`[advice] no se pudieron sortear consejos de ${siteId}:`, error instanceof Error ? error.message : error);
    return [];
  }
}
