import { cache } from "react";
import { listPublishedProducts } from "@/lib/product-store";
import { defaultDonation, effectiveSettings } from "@/lib/site-settings";
import { readSiteSettings } from "@/lib/site-store";
import { findSite, type Site } from "@/lib/sites";

/** The site of a product route, or undefined when the id is unknown or belongs to another kind of site. */
export const productSite = async (params: Promise<{ site: string }>) => {
  const site = findSite((await params).site);
  return site?.kind === "productos" ? site : undefined;
};

/** One read per request, shared by generateMetadata and the page. */
export const getProducts = cache((site: Site) => listPublishedProducts(site));

/** The donation link or alias set in the panel, or the default one. If the read fails, the site keeps working with the default. */
export const getDonation = cache(async (siteId: string) => {
  try { return effectiveSettings(await readSiteSettings(siteId)).donation; } catch (error) {
    console.warn("[productos] no se pudieron leer los datos del sitio:", error);
    return defaultDonation;
  }
});

export const siteDescription = (name: string) => `${name}. Buscá productos por nombre o para qué sirve.`;
