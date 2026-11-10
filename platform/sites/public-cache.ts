import "server-only";
import { revalidateTag } from "next/cache";

// Public pages (store, recipe list and recipe pages) are ISR. Every visit after the window starts a background render, so a short window
// costs CPU on Vercel even when nothing changed. The window is long and the panel's writes invalidate what they touch instead.
// The pages' own `export const revalidate` must be a literal, so they repeat this number: keep them in sync.
export const publicRevalidate = 3600;

/** Cache tags of the public reads. unstable_cache takes fixed tags, so they are per kind of data, not per site. */
export const publicTags = {
  sites: "public-sites",
  herbShop: "public-herb-shop",
  recipes: "public-recipes",
  recipeSettings: "public-recipe-settings",
  sauna: "public-sauna",
} as const;

/**
 * After a write from the panel: the next visit renders the page again with fresh data, so the editor sees the change at once.
 * `expire: 0` blocks that one visit instead of serving the old copy; writes are rare, so it costs one render each.
 */
export function refreshPublic(...tags: (typeof publicTags)[keyof typeof publicTags][]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
