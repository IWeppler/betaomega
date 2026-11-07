import { mapLocation, trustedMapUrl, type MapLocation } from "../domain/map-location";

const cache = new Map<string, { location: MapLocation | null; expires: number }>();

/** Short Google Maps links are resolved on the server, with every redirect restricted to the allowlist. */
export async function resolveMapLocation(value: string): Promise<MapLocation | null> {
  if (!value) return null;
  const direct = mapLocation(value);
  if (direct) return direct;
  const cached = cache.get(value);
  if (cached && cached.expires > Date.now()) return cached.location;
  let url = trustedMapUrl(value);
  let location: MapLocation | null = null;
  try {
    const signal = AbortSignal.timeout(2500);
    for (let redirects = 0; url && redirects < 3; redirects++) {
      const response = await fetch(url, { redirect: "manual", signal, cache: "no-store" });
      const target = response.headers.get("location");
      await response.body?.cancel();
      if (response.status < 300 || response.status >= 400 || !target) break;
      url = trustedMapUrl(new URL(target, url).href);
      location = url ? mapLocation(url.href) : null;
      if (location) break;
    }
  } catch { /* The directions link remains available when the optional map cannot be resolved. */ }
  if (cache.size >= 30) cache.clear();
  cache.set(value, { location, expires: Date.now() + (location ? 86_400_000 : 60_000) });
  return location;
}
