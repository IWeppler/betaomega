// App icons are pre-rendered into public/icons/ by scripts/generate-icons.mjs, so no function resizes images at runtime (Active CPU on Vercel).
// The routes that used to draw them (/icon, /pwa-icon) now redirect here; manifests and metadata point here directly.

/** Every size a page or manifest asks for: tab (32, 64), Apple (180), Android and install (192, 512). */
export const iconSizes = [32, 64, 180, 192, 512] as const;
export type IconSize = (typeof iconSizes)[number];

/** Sources in public/ that get resized. The Ñekurel app icon is composed (logo on the brand green), see the script. */
export const iconSources = [
  "/fropexio-icon.png", "/fropexio-icon-maskable.png",
  "/comidasdelcielo-icon.png", "/comidasdelcielo-icon-maskable.png",
  "/purificacion-icon.png", "/purificacion-icon-maskable.png",
  "/nekurel-app-icon.png", "/nekurel-app-icon-maskable.png",
] as const;

/** The Ñekurel social card, 1200 × 630, also pre-rendered. */
export const nekurelOgImage = "/icons/nekurel-og.jpg";

const baseName = (source: string) => source.replace(/^.*\//, "").replace(/\.png$/, "");

/** The pre-rendered file for a source at a size, or undefined when that source is not pre-rendered (a site added from the database later). */
export function staticIcon(source: string, size: number): string | undefined {
  if (!(iconSources as readonly string[]).includes(source) || !(iconSizes as readonly number[]).includes(size)) return undefined;
  return `/icons/${baseName(source)}-${size}.png`;
}

/** The size asked in ?size=, or the default 64 when it is missing or not one of iconSizes. */
export function askedIconSize(value: string | null): IconSize {
  const asked = Number(value);
  return (iconSizes as readonly number[]).includes(asked) ? (asked as IconSize) : 64;
}

/**
 * The old generator routes answer with this: a redirect the CDN keeps, so an installed app or a cached page with the old URL costs no rendering.
 * The Location is relative on purpose: behind proxy.ts the request URL may carry an internal host, and the browser resolves it against the public one.
 */
export function redirectToStatic(path: string) {
  return new Response(null, { status: 308, headers: { Location: path, "Cache-Control": "public, max-age=86400, s-maxage=31536000" } });
}

/** A site's two icon sources: with transparent corners, and full bleed for Android's masks and Apple (which rounds and blackens transparency itself). */
export type IconPair = { any: string; maskable: string };

/** The pre-rendered icon of a pair; `square` picks the full-bleed one. Undefined when the pair is not pre-rendered. */
export const appIcon = (pair: IconPair, size: number, square = false) => staticIcon(square ? pair.maskable : pair.any, size);
