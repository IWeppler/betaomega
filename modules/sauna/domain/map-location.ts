export type MapLocation = { longitude: number; latitude: number };

export function trustedMapUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && ["maps.app.goo.gl", "goo.gl", "www.google.com", "google.com", "maps.google.com"].includes(url.hostname) ? url : null;
  } catch { return null; }
}

/** Prefer the place marker over the camera coordinates, which may be offset from the business. */
export function mapLocation(value: string): MapLocation | null {
  const url = trustedMapUrl(value);
  if (!url) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(url.href); } catch { return null; }
  const marker = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const query = [url.searchParams.get("q"), url.searchParams.get("query"), url.searchParams.get("ll")]
    .find(text => text && /^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(text));
  const coordinates = marker ? [Number(marker[1]), Number(marker[2])] : query?.split(",").map(Number);
  if (!coordinates) return null;
  const [latitude, longitude] = coordinates;
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}
