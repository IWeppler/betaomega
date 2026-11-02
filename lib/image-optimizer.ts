import sharp from "sharp";

// Server-only. Every uploaded photo goes through here: whatever the person uploads (JPG, PNG or WebP, even a 5 MB phone photo),
// what gets stored is a WebP of at most `targetBytes`, with the camera's rotation applied and its metadata (GPS included) removed.
export const targetBytes = 1024 * 1024;
export const maxSide = 1920;
const qualities = [82, 74, 66, 58, 50, 42];

/** Returns the optimized WebP. Shrinks quality first and then the dimensions until it fits; throws if the bytes are not a readable image. */
export async function optimizeImage(input: Uint8Array, limit = targetBytes, side = maxSide): Promise<Uint8Array> {
  // limitInputPixels guards against decompression bombs (a tiny file that expands to gigapixels).
  const base = sharp(input, { limitInputPixels: 80_000_000, failOn: "error" }).rotate();
  let width = side;
  for (let round = 0; round < 6; round++) {
    const resized = base.clone().resize({ width, height: width, fit: "inside", withoutEnlargement: true });
    for (const quality of qualities) {
      const output = await resized.clone().webp({ quality, effort: 4 }).toBuffer();
      if (output.length <= limit) return new Uint8Array(output.buffer, output.byteOffset, output.length);
    }
    width = Math.round(width * 0.8);
  }
  throw new Error("No se pudo reducir la imagen a 1 MB.");
}
