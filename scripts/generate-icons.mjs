// Pre-renders the app icons and the Ñekurel social card into public/icons/ (see shared/lib/static-icons.ts).
// Run after changing a source image: npm run icons. The output is committed, so builds and functions never resize at runtime.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { iconSizes, iconSources, nekurelOgImage, staticIcon } from "../shared/lib/static-icons.ts";

const root = join(import.meta.dirname, "..", "public");
const NEKUREL_GREEN = "#102b20";
const png = (image) => image.png({ compressionLevel: 9 });

/** The Ñekurel logo (5:4) centred on the brand green; `maskable` keeps it inside the central 80% and drops the rounded corners. */
async function nekurelIcon(size, maskable) {
  const width = Math.round(size * (maskable ? 0.8 : 1));
  const logo = await sharp(join(root, "nekurel-logo.png")).resize(width, Math.round(width * 0.8), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${NEKUREL_GREEN}"/></svg>`);
  return png(sharp(background).composite([{ input: logo, gravity: "center" }]));
}

async function nekurelOg() {
  const logo = await sharp(join(root, "nekurel-logo.png")).resize(788, 630, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: 1200, height: 630, channels: 3, background: NEKUREL_GREEN } }).composite([{ input: logo, gravity: "center" }]).jpeg({ quality: 86, mozjpeg: true });
}

await mkdir(join(root, "icons"), { recursive: true });
for (const source of iconSources) {
  const composed = source.startsWith("/nekurel-app-icon");
  for (const size of iconSizes) {
    const image = composed ? await nekurelIcon(size, source.endsWith("-maskable.png")) : png(sharp(join(root, source)).resize(size, size));
    await image.toFile(join(root, staticIcon(source, size)));
  }
}
await (await nekurelOg()).toFile(join(root, nekurelOgImage));
console.log(`${iconSources.length * iconSizes.length + 1} images in public/icons/`);
