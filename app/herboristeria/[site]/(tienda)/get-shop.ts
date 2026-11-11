import { cache } from "react";
import { unstable_cache } from "next/cache";
import { loadHerbalShop } from "@/modules/herbal/server";
import { publicRevalidate, publicTags } from "@/platform/sites/server";

/** One catalogue read per request, shared by the layout and the page. */
export const getShop = cache(unstable_cache(() => loadHerbalShop(), ["public-herb-shop-v2", process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""], { revalidate: publicRevalidate, tags: [publicTags.herbShop] }));
/** "26 de octubre de 2026" in the store's time zone: the day the prices on screen are from. */
export const pricesDate = () => new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
