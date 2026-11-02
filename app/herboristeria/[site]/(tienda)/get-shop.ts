import { cache } from "react";
import { loadShop } from "@/lib/shop";

/** One catalogue read per request, shared by the layout and the page. */
export const getShop = cache(() => loadShop());
/** "26 de octubre de 2026" in the store's time zone: the day the prices on screen are from. */
export const pricesDate = () => new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
