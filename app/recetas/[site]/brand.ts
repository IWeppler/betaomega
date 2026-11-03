import { cache } from "react";
import { listPublishedRecipes } from "@/lib/recipe-store";
import { effectiveSettings, recipeSiteDefaults } from "@/lib/site-settings";
import { readSiteSettings } from "@/lib/site-store";
import { findSite } from "@/lib/sites";

// The recipe template's brand. It lives in code until themes are edited from the panel (fase 4).
export const brand = {
  // Tagline and description are the defaults: the panel can override them (getSettings).
  ...recipeSiteDefaults,
  background: "#fffefe",
  accent: "#ed6300",
  ink: "#231a14",
  // Poster of the site, cropped to a square by the header.
  logo: "/comidasdelcielo-logo.webp",
};

// Public path (/og): a file convention would point at the internal /recetas/... tree.
export const ogImage = (name: string, tagline: string = brand.tagline, slug?: string) => ({
  url: slug ? `/og?receta=${encodeURIComponent(slug)}` : "/og",
  width: 1200,
  height: 630,
  alt: `${name}. ${tagline}.`,
});

/** One read per request, shared by generateMetadata and the page. */
export const getRecipes = cache((siteId: string) =>
  listPublishedRecipes(siteId),
);

/** The site's editable data (tagline, description, Instagram, contact), read once per request. If the read fails, the site keeps working with the template's text. */
export const getSettings = cache(async (siteId: string) => {
  try { return effectiveSettings(await readSiteSettings(siteId)); } catch (error) {
    console.warn("[recetas] no se pudieron leer los datos del sitio:", error);
    return effectiveSettings(null);
  }
});

/** The site of a recipe route, or undefined when the id is unknown or belongs to another kind of site. */
export const recipeSite = async (params: Promise<{ site: string }>) => {
  const site = findSite((await params).site);
  return site?.kind === "recetas" ? site : undefined;
};
