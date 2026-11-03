"use client";

import { useEffect } from "react";
import { trackView } from "./track";

/** Counts the visit to the page it sits in (and to the recipe, when it has one). Draws nothing. */
export function PageView({ siteId, recipeId }: { siteId: string; recipeId?: string }) {
  useEffect(() => { trackView(siteId, recipeId); }, [siteId, recipeId]);
  return null;
}
