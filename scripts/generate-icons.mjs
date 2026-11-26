// Pre-renders the app icons and the social cards into public/icons/ (see shared/lib/static-icons.ts).
// Run after changing a source image: npm run icons. The output is committed, so builds and functions never resize at runtime.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { iconSizes, iconSources, nekurelOgImage, staticIcon, yakuchilOgImage } from "../shared/lib/static-icons.ts";

const root = join(import.meta.dirname, "..", "public");
const NEKUREL_GREEN = "#102b20";
const png = (image) => image.png({ compressionLevel: 9 });
const jpeg = (image) => image.jpeg({ quality: 86, mozjpeg: true });

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
  return jpeg(sharp({ create: { width: 1200, height: 630, channels: 3, background: NEKUREL_GREEN } }).composite([{ input: logo, gravity: "center" }]));
}

// Yakuchil's logo is a 900 × 1600 poster: the emblem in its glowing halo on top, the name and the motto below.
const YAKUCHIL_LOGO = join(root, "yakuchil-logo.jpeg");
/** The emblem cut out of the poster. `maskable` takes more of the halo around it, so Android's shapes never clip the emblem. */
const YAKUCHIL_EMBLEM = { any: { left: 150, top: 100, width: 600, height: 600 }, maskable: { left: 100, top: 60, width: 700, height: 700 } };

async function yakuchilIcon(size, maskable) {
  const emblem = sharp(YAKUCHIL_LOGO).extract(maskable ? YAKUCHIL_EMBLEM.maskable : YAKUCHIL_EMBLEM.any).resize(size, size);
  if (maskable) return png(emblem);
  const corners = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}"/></svg>`);
  return png(sharp(await emblem.toBuffer()).composite([{ input: corners, blend: "dest-in" }]));
}

/** The whole poster, centred on a blurred and darkened copy of itself that fills the 1200 × 630 card. */
async function yakuchilOg() {
  const backdrop = await sharp(YAKUCHIL_LOGO).resize(1200, 630, { fit: "cover" }).blur(40).modulate({ brightness: 0.45 }).toBuffer();
  const poster = await sharp(YAKUCHIL_LOGO).resize({ height: 630 }).toBuffer();
  return jpeg(sharp(backdrop).composite([{ input: poster, gravity: "center" }]));
}

const composed = { "/nekurel-app-icon": nekurelIcon, "/yakuchil-icon": yakuchilIcon };

await mkdir(join(root, "icons"), { recursive: true });
for (const source of iconSources) {
  const compose = composed[source.replace(/(-maskable)?\.png$/, "")];
  for (const size of iconSizes) {
    const image = compose ? await compose(size, source.endsWith("-maskable.png")) : png(sharp(join(root, source)).resize(size, size));
    await image.toFile(join(root, staticIcon(source, size)));
  }
}
await (await nekurelOg()).toFile(join(root, nekurelOgImage));
await (await yakuchilOg()).toFile(join(root, yakuchilOgImage));
console.log(`${iconSources.length * iconSizes.length + 2} images in public/icons/`);
