import { cache } from "react";
import { listPublishedProducts } from "@/lib/product-store";
import { defaultDonation, effectiveSettings } from "@/lib/site-settings";
import { readSiteSettings } from "@/lib/site-store";
import { getSite } from "@/lib/site-registry";
import type { Site } from "@/lib/sites";
import { appIcon, type IconSize } from "@/shared/lib/static-icons";

/** The site of a product route, or undefined when the id is unknown or belongs to another kind of site. */
export const productSite = async (params: Promise<{ site: string }>) => {
  const site = await getSite((await params).site);
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

/**
 * The site's icon: the pre-rendered file (public/icons/) when its icon files are in scripts/generate-icons.mjs, otherwise /icon, which draws it.
 * The Apple icon (180) has no transparency, iOS rounds it itself, so it uses the square version too.
 */
export function productIcon(site: Site, size: IconSize, maskable = false) {
  const icon = site.products?.icon;
  return (icon && appIcon(icon, size, maskable || size === 180)) || `/icon?size=${size}${maskable ? "&maskable=1" : ""}`;
}

export const siteDescription = (site: Site) => `${site.name}. Buscá ${site.products?.items.many} por nombre o para qué sirve.`;
