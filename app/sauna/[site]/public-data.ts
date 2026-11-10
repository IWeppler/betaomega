import { unstable_cache } from "next/cache";
import { publicHome, publicPage } from "@/modules/sauna/server";
import { getSite, publicRevalidate, publicTags } from "@/platform/sites/server";

// The home page is ISR (one hour): its reads are cached and tagged, and the panel's writes that change what it shows refresh it (homeWrite).
// Bookable turns are not here: the browser asks /availability, so a cached page never offers a turn that is already taken.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const cachedSite = unstable_cache(getSite, ["public-sauna-site", supabaseKey], { revalidate: publicRevalidate, tags: [publicTags.sites] });
export const cachedPage = unstable_cache(publicPage, ["public-sauna-page", supabaseKey], { revalidate: publicRevalidate, tags: [publicTags.sauna] });
export const cachedHome = unstable_cache((siteId: string) => publicHome(siteId), ["public-sauna-home", supabaseKey], { revalidate: publicRevalidate, tags: [publicTags.sauna] });
