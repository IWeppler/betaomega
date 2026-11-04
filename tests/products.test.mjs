import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanKeywords, cleanProductList, productApplications, searchProducts } from '../lib/products.ts';
import { findSite, siteForHost, sites } from '../lib/sites.ts';

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
  assert.deepEqual(products.map(p => p.slug), ['agua-de-lluvia', 'agua-de-lluvia-2', 'icon-producto']);
  const renamed = cleanProductList(list(item({ name: 'Otro nombre', slug: 'agua-de-lluvia' })), plain);
  assert.equal(renamed.products[0].slug, 'agua-de-lluvia');
  assert.throws(() => cleanProductList(list(item({ slug: 'og' })), plain), /Dirección/);
  assert.throws(() => cleanProductList(list(item({ slug: 'x' }), item({ id: 'b', slug: 'x' })), plain), /misma dirección/);
  assert.throws(() => cleanProductList(list(item(), item()), plain), /identificador/);
});

test('para qué sirve: sin repetidos ni vacíos', () => {
  assert.deepEqual(cleanKeywords([' Dolor  de cabeza ', 'dolor de cabéza', '', 'Sed']), ['Dolor de cabeza', 'Sed']);
  assert.throws(() => cleanKeywords(Array.from({ length: 41 }, (_, n) => `frase ${n}`)), /hasta 40/);
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
