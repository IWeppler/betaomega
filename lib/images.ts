export const maxImageBytes = 5 * 1024 * 1024;
export function imageFormat(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}
export const imageTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const validImageName = (name: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(name);
/** Older photos live at the bucket's root; newer ones under the site's id ("comidasdelcielo/<uuid>.jpg"). */
export const validImagePath = (path: string[]) => (path.length === 1 && validImageName(path[0])) || (path.length === 2 && /^[a-z0-9-]+$/.test(path[0]) && validImageName(path[1]));
