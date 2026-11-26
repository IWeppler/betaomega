import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanKeywords, cleanProductList, productApplications, productWords, searchProducts, youtubeEmbed, youtubeId, stampPublished, newestFirst, newestId, youtubeThumbnail } from '../lib/products.ts';
import { findIn, siteForHostIn, seedSites as sites } from '../lib/sites.ts';

const findSite = id => findIn(sites, id);
const siteForHost = host => siteForHostIn(sites, host);

const water = { application: true, descriptionLabel: 'Cómo se obtiene' };
const plain = { application: false, descriptionLabel: 'Descripción' };
const item = (fields = {}) => ({ id: 'a', name: 'Agua de lluvia', description: 'Se junta en el techo.', keywords: ['hidratar'], published: true, ...fields });
const list = (...products) => ({ revision: 3, products });

test('Purificación y Yakuchil son sitios de productos con su propio dominio', () => {
  assert.equal(siteForHost('purificacion.localhost:3000').id, 'purificacion');
  assert.equal(siteForHost('yakuchil.localhost:3000').id, 'yakuchil');
  assert.equal(findSite('purificacion').products.application, true);
  assert.equal(findSite('yakuchil').products.application, false);
  assert.equal(findSite('purificacion').products.icon.any, '/purificacion-icon.png');
  for (const site of sites) assert.equal(site.kind === 'productos', Boolean(site.products), site.id);
});

test('cada sitio nombra lo que publica con su propia palabra', () => {
  const voices = productWords(findSite('yakuchil').products.items);
  assert.equal(voices.Many, 'Voces sagradas');
  assert.equal(voices.new, 'Nueva voz sagrada');
  assert.equal(voices.firstMany, 'las primeras voces sagradas');
  assert.equal(voices.ofThe, 'de la voz sagrada');
  assert.equal(voices.Published, 'Publicada');
  const items = productWords(findSite('purificacion').products.items);
  assert.equal(items.Many, 'Aguas');
  assert.equal(items.new, 'Nueva agua');
  assert.equal(items.ofThe, 'del agua');
  assert.equal(items.PublishedMany, 'Publicadas');
});

test('un agua publicada tiene que decir si se bebe o va en la piel', () => {
  assert.throws(() => cleanProductList(list(item()), water), /para beber o para aplicar en la piel/);
  assert.equal(cleanProductList(list(item({ application: 'piel' })), water).products[0].application, 'piel');
  assert.equal(cleanProductList(list(item({ published: false })), water).products[0].application, undefined, 'un borrador puede esperar');
  assert.throws(() => cleanProductList(list(item({ application: 'tomar' })), water), /para beber o para aplicar/);
  assert.match(productApplications.piel.note, /No beber/);
});

test('un sitio sin uso descarta ese campo', () => {
  assert.equal(cleanProductList(list(item({ application: 'piel' })), plain).products[0].application, undefined);
});

test('para publicar hacen falta descripción y para qué sirve', () => {
  assert.throws(() => cleanProductList(list(item({ description: ' ' })), plain), /completá descripción/);
  assert.throws(() => cleanProductList(list(item({ keywords: [] })), plain), /para qué sirve/);
  assert.equal(cleanProductList(list(item({ description: '', keywords: [], published: false })), plain).products.length, 1);
  assert.throws(() => cleanProductList(list(item({ name: ' ' })), plain), /nombre/);
});

test('valida la imagen y descarta campos desconocidos', () => {
  const name = '0b6f7c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f.webp';
  const [clean] = cleanProductList(list(item({ image: `/api/images/yakuchil/${name}`, extra: 1 })), plain).products;
  assert.equal(clean.image, `/api/images/yakuchil/${name}`);
  assert.equal('extra' in clean, false);
  assert.throws(() => cleanProductList(list(item({ image: 'https://otro.com/x.jpg' })), plain), /Imagen inválida/);
  assert.throws(() => cleanProductList(list(item({ image: '/api/images/../secreto.webp' })), plain), /Imagen inválida/);
});

test('las direcciones son únicas, estables y no pisan rutas del sitio', () => {
  const { products } = cleanProductList(list(item(), item({ id: 'b' }), item({ id: 'c', name: 'Icon' })), plain);
  assert.deepEqual(products.map(p => p.slug), ['agua-de-lluvia', 'agua-de-lluvia-2', 'icon-2']);
  const renamed = cleanProductList(list(item({ name: 'Otro nombre', slug: 'agua-de-lluvia' })), plain);
  assert.equal(renamed.products[0].slug, 'agua-de-lluvia');
  assert.throws(() => cleanProductList(list(item({ slug: 'og' })), plain), /Dirección/);
  assert.throws(() => cleanProductList(list(item({ slug: 'x' }), item({ id: 'b', slug: 'x' })), plain), /misma dirección/);
  assert.throws(() => cleanProductList(list(item(), item()), plain), /identificador/);
});

test('para qué sirve: sin repetidos ni vacíos', () => {
  assert.deepEqual(cleanKeywords([' Dolor  de cabeza ', 'dolor de cabéza', '', 'Sed']), ['Dolor de cabeza', 'Sed']);
  assert.throws(() => cleanKeywords(Array.from({ length: 61 }, (_, n) => `frase ${n}`)), /hasta 60/);
});

test('la búsqueda mira el nombre y para qué sirve, sin importar tildes', () => {
  const products = [
    { name: 'Agua de lluvia', keywords: ['hidratar'] },
    { name: 'Agua termal', keywords: ['Piel irritada', 'descanso de los pies'] },
    { name: 'Yerba', keywords: ['digestión lenta'] },
  ];
  const names = query => searchProducts(products, query).map(p => p.name);
  assert.deepEqual(names(''), ['Agua de lluvia', 'Agua termal', 'Yerba']);
  assert.deepEqual(names('PIEL'), ['Agua termal']);
  assert.deepEqual(names('digestion'), ['Yerba']);
  assert.deepEqual(names('para la digestión lenta'), ['Yerba']);
  assert.deepEqual(names('lluvia'), ['Agua de lluvia']);
  assert.deepEqual(names('nada que ver'), []);
});

test('el video acepta los links de YouTube de siempre y guarda uno solo', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=42s`, `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`, `youtu.be/${id}`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`, `https://music.youtube.com/watch?v=${id}&list=x`,
  ]) assert.equal(youtubeId(link), id, link);
  for (const link of ['https://vimeo.com/123', `https://youtube.com.evil.example/watch?v=${id}`, 'https://www.youtube.com/watch?v=corto', 'no es un link', '']) assert.equal(youtubeId(link), null, link);
  assert.equal(youtubeEmbed(`https://www.youtube.com/watch?v=${id}`), `https://www.youtube-nocookie.com/embed/${id}`);
});

test('el video se guarda normalizado, se puede dejar vacío y uno que no es de YouTube se rechaza', () => {
  const base = { id: 'a', slug: '', name: 'Voz sagrada 074', description: 'Texto.', keywords: [], published: false };
  const saved = (video) => cleanProductList({ revision: 0, products: [{ ...base, video }] }, plain).products[0];
  assert.equal(saved('https://youtu.be/dQw4w9WgXcQ?si=x').video, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal('video' in saved(''), false);
  assert.equal('video' in saved(undefined), false);
  assert.throws(() => saved('https://vimeo.com/123'), /no es de YouTube/);
});

test('la fecha de publicación la pone el servidor la primera vez y no la cambia el panel', () => {
  const now = new Date('2026-11-26T15:00:00Z');
  const item = (id, published, publishedAt) => ({ id, slug: id, name: id, description: 'x', keywords: ['y'], published, ...(publishedAt ? { publishedAt } : {}) });
  const stored = [item('vieja', true, '2026-01-01T00:00:00.000Z'), item('borrador', false)];
  const next = [item('vieja', true, '2030-01-01T00:00:00.000Z'), item('borrador', true), item('nueva', false, '2020-01-01T00:00:00.000Z')];
  const [vieja, borrador, nueva] = stampPublished(stored, next, now);
  assert.equal(vieja.publishedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(borrador.publishedAt, now.toISOString());
  assert.equal('publishedAt' in nueva, false);
  const oculta = stampPublished([item('vieja', true, '2026-01-01T00:00:00.000Z')], [item('vieja', false)], now)[0];
  assert.equal(oculta.publishedAt, '2026-01-01T00:00:00.000Z');
});

test('la última publicada va primero y es la única nueva; las que no tienen fecha van al final por nombre', () => {
  const list = [{ id: 'b', name: 'B' }, { id: 'x', name: 'X', publishedAt: '2026-02-01T00:00:00Z' }, { id: 'a', name: 'A' }, { id: 'y', name: 'Y', publishedAt: '2026-03-01T00:00:00Z' }];
  assert.deepEqual(newestFirst(list).map(p => p.id), ['y', 'x', 'a', 'b']);
  assert.equal(newestId(list), 'y');
  assert.equal(newestId([{ id: 'a', name: 'A' }]), undefined);
  assert.equal(youtubeThumbnail('https://youtu.be/dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(youtubeThumbnail('https://youtu.be/dQw4w9WgXcQ', 'max'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  assert.equal(youtubeThumbnail('https://vimeo.com/1'), null);
});
