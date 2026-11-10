import { appIcon, nekurelOgImage, type IconSize } from "@/shared/lib/static-icons";

// Both pre-rendered into public/icons/ by scripts/generate-icons.mjs, so no function draws them.
// Pages that set their own openGraph replace the layout's, so they must repeat this image.
export const ogImage = { url: nekurelOgImage, width: 1200, height: 630, alt: "Ñekurel Herboristería, Tostado, Santa Fe." };

/** Home-screen icon: the Ñekurel logo, whole, on the dark brand green. `maskable` leaves a safe zone for round masks. */
export const herbIcon = (size: IconSize, maskable = false) =>
  appIcon({ any: "/nekurel-app-icon.png", maskable: "/nekurel-app-icon-maskable.png" }, size, maskable) as string;
