import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { optimizeImage, targetBytes } from '../lib/image-optimizer.ts';
import { imageFormat } from '../lib/images.ts';

// Photo-like noise: incompressible enough to weigh megabytes as a JPG.
const noisy = async (width, height, format) => {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (Math.sin(i * 0.37) * 127 + 128 + Math.random() * 90) & 255;
  const image = sharp(raw, { raw: { width, height, channels: 3 } });
  return new Uint8Array(await (format === 'png' ? image.png() : image.jpeg({ quality: 95 })).toBuffer());
};

test('una foto pesada sale como WebP de a lo sumo 1 MB', async () => {
  const jpg = await noisy(4000, 3000, 'jpg');
  assert.ok(jpg.length > targetBytes * 2, `la prueba necesita una foto grande (${jpg.length} bytes)`);
  const out = await optimizeImage(jpg);
  assert.equal(imageFormat(out), 'webp');
  assert.ok(out.length <= targetBytes, `pesa ${out.length}`);
  const meta = await sharp(out).metadata();
  assert.ok(Math.max(meta.width, meta.height) <= 1920);
});

test('un PNG también termina en WebP y una foto chica no se agranda', async () => {
  const png = await noisy(300, 200, 'png');
  const out = await optimizeImage(png);
  assert.equal(imageFormat(out), 'webp');
  const meta = await sharp(out).metadata();
  assert.deepEqual([meta.width, meta.height], [300, 200]);
});

test('se aplica la rotación de la cámara y se quitan los metadatos', async () => {
  const tagged = new Uint8Array(await sharp({ create: { width: 200, height: 100, channels: 3, background: '#c33' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer());
  const out = await optimizeImage(tagged);
  const meta = await sharp(out).metadata();
  assert.deepEqual([meta.width, meta.height], [100, 200]);
  assert.equal(meta.exif, undefined);
});

test('lo que no es una imagen se rechaza', async () => {
  await assert.rejects(() => optimizeImage(new Uint8Array(500).fill(7)));
});

test('con un límite imposible reduce las dimensiones hasta cumplirlo', async () => {
  const jpg = await noisy(1500, 1000, 'jpg');
  const out = await optimizeImage(jpg, 150_000);
  assert.ok(out.length <= 150_000, `pesa ${out.length}`);
});
