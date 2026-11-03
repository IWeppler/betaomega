import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSettings, blankSettings, cleanInstagram, cleanContact, effectiveSettings, socialLinks, recipeSiteDefaults, cleanDonation } from '../lib/site-settings.ts';
import { isScheduled, looksLikeBot, mostViewed, maxExtraImages, blankRecipe, recipeShareInfo, duplicateRecipe, parseIngredientLines, parseStepLines, canonicalCategory, categoryKey, categoryUsage, cleanRecipe, normalizeCategories, renameCategory, formatMinutes, isoDuration, matchesRecipe, recipeCategories, recipeGaps, recipeJsonLd, relatedRecipes, slugify, toRecipeCard, totalMinutes } from '../lib/recipes.ts';
import { validImagePath } from '../lib/images.ts';
import { findSite, siteForHost } from '../lib/sites.ts';

const id = '0b6f7c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f';
const draft = (patch = {}) => ({ ...blankRecipe(), id, title: 'Empanadas salteñas', ...patch });

test('Comidas del cielo es un sitio de recetas con su propio dominio', () => {
  assert.equal(findSite('comidasdelcielo').kind, 'recetas');
  assert.equal(siteForHost('comidasdelcielo.localhost:3000').id, 'comidasdelcielo');
  assert.equal(siteForHost('www.comidasdelcielo.vercel.app').id, 'comidasdelcielo');
});

test('la dirección sale del nombre, sin tildes ni signos', () => {
  assert.equal(slugify('¡Ñoquis del 29, con salsa!'), 'noquis-del-29-con-salsa');
  assert.equal(cleanRecipe(draft()).slug, 'empanadas-saltenas');
  assert.equal(cleanRecipe(draft({ slug: 'mis-empanadas' })).slug, 'mis-empanadas');
  assert.throws(() => cleanRecipe(draft({ slug: 'Con Espacios' })), /letras sin tilde/);
});

test('un borrador puede estar incompleto; para publicar hacen falta ingredientes y pasos', () => {
  assert.equal(cleanRecipe(draft()).published, false);
  assert.throws(() => cleanRecipe(draft({ published: true })), /ingrediente/);
  assert.throws(() => cleanRecipe(draft({ published: true, ingredients: [{ amount: '1 kg', name: 'Carne' }] })), /paso/);
  const ok = cleanRecipe(draft({ published: true, ingredients: [{ amount: ' 1 kg ', name: ' Carne ' }], steps: [' Picar. '] }));
  assert.deepEqual(ok.ingredients, [{ amount: '1 kg', name: 'Carne' }]);
  assert.deepEqual(ok.steps, ['Picar.']);
});

test('rechaza datos inválidos y descarta campos desconocidos', () => {
  assert.throws(() => cleanRecipe(draft({ title: '  ' })), /nombre/);
  assert.throws(() => cleanRecipe(draft({ id: 'x' })), /inválida/);
  assert.throws(() => cleanRecipe(draft({ revision: -1 })), /inválida/);
  assert.throws(() => cleanRecipe(draft({ prepMinutes: 2.5 })), /minutos/);
  assert.throws(() => cleanRecipe(draft({ image: 'https://otro.com/foto.jpg' })), /Imagen/);
  assert.throws(() => cleanRecipe(draft({ ingredients: [{ amount: '1', name: '' }] })), /ingrediente 1/);
  const clean = cleanRecipe(draft({ siteId: 'nekurel', extra: true, categories: ['Salado', 'Salado', ' '] }));
  assert.equal('siteId' in clean, false);
  assert.equal('extra' in clean, false);
  assert.deepEqual(clean.categories, ['SALADO']);
});

test('fotos en la carpeta del sitio y en la raíz', () => {
  const name = `${id}.jpg`;
  assert.equal(cleanRecipe(draft({ image: `/api/images/comidasdelcielo/${name}` })).image, `/api/images/comidasdelcielo/${name}`);
  assert.equal(validImagePath([name]), true);
  assert.equal(validImagePath(['comidasdelcielo', name]), true);
  assert.equal(validImagePath(['..', name]), false);
  assert.equal(validImagePath(['a', 'b', name]), false);
});

test('tiempos y faltantes', () => {
  assert.equal(formatMinutes(75), '1 h 15 min');
  assert.equal(formatMinutes(40), '40 min');
  assert.equal(formatMinutes(undefined), '');
  assert.equal(totalMinutes({}), undefined);
  assert.deepEqual(recipeGaps({ ...draft(), siteId: 'x', prepMinutes: 10 }), ['foto', 'descripción', 'tipo', 'momento', 'complejidad']);
});

test('las direcciones que usa el sitio no se pueden tomar', () => {
  assert.throws(() => cleanRecipe(draft({ slug: 'og' })), /la usa el sitio/);
  assert.equal(cleanRecipe(draft({ slug: 'og-casero' })).slug, 'og-casero');
});

test('la búsqueda del sitio ignora tildes y busca por ingrediente', () => {
  const card = toRecipeCard({ ...draft({ summary: 'Clásicas del norte', categories: ['Salados'], ingredients: [{ amount: '1 kg', name: 'Carne picada' }], steps: ['Hornear'] }), siteId: 'comidasdelcielo', slug: 'empanadas-saltenas' });
  assert.ok(matchesRecipe(card, 'EMPANADAS'));
  assert.ok(matchesRecipe(card, 'saltenas carne'));
  assert.ok(matchesRecipe(card, 'salteñas'));
  assert.ok(!matchesRecipe(card, 'pollo'));
  assert.ok(matchesRecipe(card, '  '));
});

test('categorías del sitio: las más usadas primero, sin repetir dentro de una receta', () => {
  const list = recipeCategories([{ categories: ['Postres', 'Postres'] }, { categories: ['Salados'] }, { categories: ['Postres', 'Al horno'] }]);
  assert.deepEqual(list, [{ label: 'Postres', count: 2 }, { label: 'Al horno', count: 1 }, { label: 'Salados', count: 1 }]);
});

test('recetas relacionadas: primero las que comparten categorías, sin la propia', () => {
  const a = { slug: 'a', categories: ['Postres', 'Frío'] }, b = { slug: 'b', categories: ['Salados'] }, c = { slug: 'c', categories: ['Postres', 'Frío'] }, d = { slug: 'd', categories: ['Postres'] };
  assert.deepEqual(relatedRecipes(a, [a, b, d, c], 2).map(r => r.slug), ['c', 'd']);
});

test('datos estructurados de la receta para los buscadores', () => {
  assert.equal(isoDuration(75), 'PT1H15M');
  assert.equal(isoDuration(45), 'PT45M');
  assert.equal(isoDuration(120), 'PT2H');
  assert.equal(isoDuration(undefined), undefined);
  const recipe = { ...draft({ slug: 'flan', title: 'Flan', image: '/api/images/comidasdelcielo/0b6f7c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f.jpg', prepMinutes: 15, cookMinutes: 60, ingredients: [{ amount: '4', name: 'huevos' }, { amount: '', name: 'azúcar' }], steps: ['Batir', 'Hornear'] }), siteId: 'comidasdelcielo' };
  const data = recipeJsonLd(recipe, 'https://comidasdelcielo.vercel.app', 'Comidas del cielo');
  assert.equal(data.url, 'https://comidasdelcielo.vercel.app/flan');
  assert.equal(data.image[0], 'https://comidasdelcielo.vercel.app/api/images/comidasdelcielo/0b6f7c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f.jpg');
  assert.equal(data.totalTime, 'PT1H15M');
  assert.deepEqual(data.recipeIngredient, ['4 huevos', 'azúcar']);
  assert.equal(data.recipeInstructions[1].position, 2);
});

test('la vista previa de un borrador solo se abre con la firma de esa receta', async () => {
  process.env.ANKORA_SESSION_SECRET = 'secreto-de-prueba';
  const { previewToken, validPreview } = await import('../lib/preview.ts');
  const other = '9c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5';
  const token = previewToken('comidasdelcielo', id);
  assert.equal(token.length, 32);
  assert.ok(validPreview('comidasdelcielo', id, token));
  assert.ok(!validPreview('comidasdelcielo', other, token));
  assert.ok(!validPreview('otrositio', id, token));
  assert.ok(!validPreview('comidasdelcielo', id, token.slice(0, 31) + (token.endsWith('0') ? '1' : '0')));
  assert.ok(!validPreview('comidasdelcielo', id, ['x']));
  delete process.env.ANKORA_SESSION_SECRET;
  assert.ok(!validPreview('comidasdelcielo', id, token));
});

test('las categorías que solo difieren en mayúsculas o tildes son la misma', () => {
  assert.equal(categoryKey('  Póstres  '), categoryKey('postres'));
  assert.equal(canonicalCategory('postres', ['Sin TACC', 'Postres']), 'POSTRES');
  assert.equal(canonicalCategory('  Para   el mate ', ['Postres']), 'PARA EL MATE');
  assert.deepEqual(normalizeCategories(['postres', 'Sin TACC', 'POSTRES', ' '], ['Postres']), ['POSTRES', 'SIN TACC']);
  assert.deepEqual(cleanRecipe(draft({ categories: ['Postres', 'postres', 'Póstres', 'Dulce'] })).categories, ['POSTRES', 'DULCE']);
});

test('renombrar una categoría conserva el orden y no repite', () => {
  const recipe = { categories: ['Cena', 'Postre', 'Dulce'] };
  assert.deepEqual(renameCategory(recipe, 'Postre', 'Postres').categories, ['Cena', 'Postres', 'Dulce']);
  assert.deepEqual(renameCategory(recipe, 'Postre', 'Dulce').categories, ['Cena', 'Dulce']);
  assert.deepEqual(renameCategory(recipe, 'Dulce', 'Cena').categories, ['Cena', 'Postre']);
  assert.equal(renameCategory(recipe, 'Otra', 'X'), recipe);
  assert.deepEqual(recipe.categories, ['Cena', 'Postre', 'Dulce']);
});

test('uso de categorías: publicadas y borradores', () => {
  const usage = categoryUsage([
    { categories: ['Postres', 'Dulce'], published: true },
    { categories: ['Postres'], published: false },
    { categories: ['Cena'], published: true },
  ]);
  assert.deepEqual(usage, [
    { label: 'Postres', published: 1, drafts: 1 },
    { label: 'Cena', published: 1, drafts: 0 },
    { label: 'Dulce', published: 1, drafts: 0 },
  ]);
});

test('pegar ingredientes: separa cantidad y nombre', () => {
  const rows = parseIngredientLines(`Ingredientes:
- 1 kg carne picada
• 200 g de harina
✅ 1/2 taza de leche
3 huevos

½ taza de aceite
1 1/2 cucharadas de azúcar
200g manteca
2 a 3 cebollas
1 pizca de sal
sal a gusto
pimienta c/n
1,5 l de agua`);
  assert.deepEqual(rows, [
    { amount: '1 kg', name: 'carne picada' },
    { amount: '200 g', name: 'harina' },
    { amount: '1/2 taza', name: 'leche' },
    { amount: '3', name: 'huevos' },
    { amount: '1/2 taza', name: 'aceite' },
    { amount: '1 1/2 cucharadas', name: 'azúcar' },
    { amount: '200 g', name: 'manteca' },
    { amount: '2 a 3', name: 'cebollas' },
    { amount: '1 pizca', name: 'sal' },
    { amount: '', name: 'sal a gusto' },
    { amount: '', name: 'pimienta c/n' },
    { amount: '1,5 l', name: 'agua' },
  ]);
  assert.deepEqual(parseIngredientLines('  \n\n'), []);
  // Un nombre que empieza como una unidad no se confunde con ella.
  assert.deepEqual(parseIngredientLines('2 limones'), [{ amount: '2', name: 'limones' }]);
});

test('pegar pasos: un paso por renglón sin numeración', () => {
  assert.deepEqual(parseStepLines('1. Mezclar todo\n2) Llevar al horno\nPaso 3: Servir\n- Disfrutar\n✅ Repetir\n4️⃣ Final'), ['Mezclar todo', 'Llevar al horno', 'Servir', 'Disfrutar', 'Repetir', 'Final']);
  assert.deepEqual(parseStepLines('Cocinar 1.5 horas\n\n\n1-2 minutos más'), ['Cocinar 1.5 horas', '1-2 minutos más']);
  assert.deepEqual(parseStepLines(''), []);
});

test('pegar pasos: los párrafos con renglones cortados se unen', () => {
  const text = 'Primero se mezclan la harina\ny la sal en un bol.\n\nDespués se amasa\nhasta que quede lisa.\n\n3. Dejar descansar';
  assert.deepEqual(parseStepLines(text), ['Primero se mezclan la harina y la sal en un bol.', 'Después se amasa hasta que quede lisa.', 'Dejar descansar']);
});

test('duplicar una receta no toca la original', () => {
  const original = { ...draft({ slug: 'empanadas', published: true, revision: 4, categories: ['Salado'], ingredients: [{ amount: '1', name: 'masa' }], steps: ['Hornear'] }) };
  const copy = duplicateRecipe(original);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.revision, 0);
  assert.equal(copy.published, false);
  assert.equal(copy.slug, '');
  assert.equal(copy.title, 'Empanadas salteñas (copia)');
  assert.deepEqual(copy.ingredients, original.ingredients);
  copy.ingredients[0].name = 'otra';
  copy.steps.push('x');
  assert.equal(original.ingredients[0].name, 'masa');
  assert.deepEqual(original.steps, ['Hornear']);
  assert.equal(original.published, true);
});

test('lo que se comparte: una sola fuente para la página y el panel', () => {
  const full = recipeShareInfo({ title: 'Flan casero', slug: 'flan-casero', summary: 'Cremoso y simple.', image: '/api/images/comidasdelcielo/' + id + '.jpg' }, 'Comidas del cielo');
  assert.equal(full.pageTitle, 'Flan casero | Comidas del cielo');
  assert.equal(full.path, '/flan-casero');
  assert.equal(full.description, 'Cremoso y simple.');
  assert.ok(full.image);
  assert.deepEqual(full.warnings, []);
  const bare = recipeShareInfo({ title: ' Flan ', slug: 'flan', summary: '  ', image: undefined }, 'X');
  assert.equal(bare.description, 'Receta de Flan: ingredientes y preparación paso a paso.');
  assert.equal(bare.image, undefined);
  assert.equal(bare.warnings.length, 2);
  assert.match(bare.warnings[0], /imagen general/);
  const long = recipeShareInfo({ title: 'A', slug: 'a', summary: 'x'.repeat(300), image: undefined }, 'X');
  assert.equal(long.description.length, 200);
  assert.ok(long.warnings.some(w => w.includes('300 caracteres')));
  assert.equal(recipeShareInfo({ title: '', slug: '', summary: 'ok', image: '/api/images/' + id + '.png' }, 'X').title, 'Sin nombre');
});

test('datos del sitio: validación y normalización', () => {
  const clean = cleanSettings({ revision: 2, tagline: '  Recetas   de casa ', description: 'Cocina simple.', instagram: 'https://www.instagram.com/comidas.del.cielo/', contact: '+54 9 11 5555-1234', extra: 'x' });
  assert.deepEqual(clean, { revision: 2, tagline: 'Recetas de casa', description: 'Cocina simple.', instagram: 'comidas.del.cielo', contact: '5491155551234' });
  assert.equal(cleanInstagram('@Mi_cocina'), 'Mi_cocina');
  assert.equal(cleanInstagram(''), '');
  assert.throws(() => cleanInstagram('con espacios'), /Instagram/);
  assert.equal(cleanContact('Hola@Correo.com'), 'hola@correo.com');
  assert.equal(cleanContact(''), '');
  assert.throws(() => cleanContact('no es un mail@'), /mail/);
  assert.throws(() => cleanContact('123'), /código de país/);
  assert.throws(() => cleanContact('llamame'), /mail o un número/);
  assert.throws(() => cleanSettings({ tagline: 'x' }), /inválidos/);
  assert.throws(() => cleanSettings({ revision: 0, tagline: 'x'.repeat(61) }), /demasiado largo/);
  assert.equal(cleanSettings({ revision: 1, donation: ' Ignacioweppler.MP ' }).donation, 'ignacioweppler.mp');
  assert.equal(cleanSettings({ revision: 1, donation: '' }).donation, '');
  assert.equal(cleanDonation('https://link.mercadopago.com.ar/abc'), 'https://link.mercadopago.com.ar/abc');
  assert.throws(() => cleanDonation('hola que tal'), /Donaciones/);
  assert.throws(() => cleanDonation('http://x.com'), /Donaciones/);
  assert.equal(cleanDonation('link.mercadopago.com.ar/betayomega'), 'https://link.mercadopago.com.ar/betayomega');
  assert.equal(effectiveSettings(null).donation, 'https://link.mercadopago.com.ar/betayomega');
  assert.equal(effectiveSettings({ ...blankSettings(), donation: '' }).donation, '');
  assert.deepEqual(cleanSettings({ revision: 0 }), { revision: 0, tagline: '', description: '', instagram: '', contact: '' });
});

test('datos del sitio: sin documento se ve igual que hoy', () => {
  assert.deepEqual(effectiveSettings(null), { ...recipeSiteDefaults, instagram: '', contact: '', donation: 'https://link.mercadopago.com.ar/betayomega' });
  assert.equal(effectiveSettings(cleanSettings({ revision: 1, tagline: 'Mi lema' })).description, recipeSiteDefaults.description);
  assert.equal(effectiveSettings(cleanSettings({ revision: 1, tagline: 'Mi lema' })).tagline, 'Mi lema');
});

test('datos del sitio: links del pie', () => {
  assert.deepEqual(socialLinks({ instagram: 'cocina', contact: '5491155551234' }), [
    { label: '@cocina', href: 'https://www.instagram.com/cocina' },
    { label: 'WhatsApp', href: 'https://wa.me/5491155551234' },
  ]);
  assert.deepEqual(socialLinks({ instagram: '', contact: 'a@b.com' }), [{ label: 'a@b.com', href: 'mailto:a@b.com' }]);
  assert.deepEqual(socialLinks({ instagram: '', contact: '' }), []);
});

test('fotos adicionales: límites, repetidas y la principal', () => {
  const photo = n => `/api/images/comidasdelcielo/0b6f7c1e-2a3b-4c5d-8e9f-0a1b2c3d4e${String(n).padStart(2, '0')}.jpg`;
  assert.deepEqual(cleanRecipe(draft()).images, []);
  assert.deepEqual(cleanRecipe(draft({ image: photo(1), images: [photo(1), photo(2), photo(2), '', photo(3)] })).images, [photo(2), photo(3)]);
  assert.throws(() => cleanRecipe(draft({ images: Array.from({ length: maxExtraImages + 1 }, (_, n) => photo(n)) })), /hasta 6 fotos/);
  assert.throws(() => cleanRecipe(draft({ images: ['https://otro.com/a.jpg'] })), /Imagen inválida/);
  assert.throws(() => cleanRecipe(draft({ images: 'x' })), /Fotos inválidas/);
  const full = { ...draft({ image: photo(1), images: [photo(2)] }), siteId: 's', slug: 'x', published: true, ingredients: [], steps: [], categories: [] };
  assert.deepEqual(recipeJsonLd({ ...full, id }, 'https://a.com', 'A').image, ['https://a.com' + photo(1), 'https://a.com' + photo(2)]);
});

test('publicación programada', () => {
  const future = new Date(Date.now() + 86400_000).toISOString();
  const ok = { ingredients: [{ amount: '', name: 'sal' }], steps: ['Cocinar'] };
  assert.equal(cleanRecipe(draft({ ...ok, published: true, scheduledAt: future })).scheduledAt, future);
  // Un borrador no guarda fecha; vacío deja la guardada.
  assert.equal(cleanRecipe(draft({ scheduledAt: future })).scheduledAt, undefined);
  assert.equal(cleanRecipe(draft({ ...ok, published: true, scheduledAt: '' })).scheduledAt, undefined);
  assert.throws(() => cleanRecipe(draft({ ...ok, published: true, scheduledAt: 'mañana' })), /fecha/);
  assert.throws(() => cleanRecipe(draft({ ...ok, published: true, scheduledAt: '1990-01-01T00:00:00Z' })), /fecha/);
  assert.equal(isScheduled({ published: true, publishedAt: future }), true);
  assert.equal(isScheduled({ published: true, publishedAt: '2020-01-01T00:00:00Z' }), false);
  assert.equal(isScheduled({ published: false, publishedAt: future }), false);
  assert.equal(isScheduled({ published: true }), false);
});

test('más vistas: sin buscadores y ordenadas', () => {
  assert.deepEqual(mostViewed([{ views: 3 }, { views: undefined }, { views: 10 }, { views: 0 }, { views: 5 }], 2), [{ views: 10 }, { views: 5 }]);
  assert.equal(looksLikeBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
  assert.equal(looksLikeBot('WhatsApp/2.23.20 A'), true);
  assert.equal(looksLikeBot('facebookexternalhit/1.1'), true);
  assert.equal(looksLikeBot(null), true);
  assert.equal(looksLikeBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'), false);
});

test('la tarjeta usa la segunda foto disponible para el hover', () => {
  const base = { slug: 'a', title: 'A', summary: '', categories: [], moments: [], cuisine: '', servings: '', ingredients: [] };
  assert.equal(toRecipeCard({ ...base, image: '/1', images: ['/2', '/3'] }).hoverImage, '/2');
  assert.equal(toRecipeCard({ ...base, image: '/1', images: [] }).hoverImage, undefined);
  assert.equal(toRecipeCard({ ...base, image: undefined, images: ['/2', '/3'] }).image, '/2');
  assert.equal(toRecipeCard({ ...base, image: undefined, images: ['/2', '/3'] }).hoverImage, '/3');
});

import { normalizeMoments, facetCounts, matchesFilters, sortRecipes, recipeCuisines, noFilters, filterHref, maxSummary } from '../lib/recipes.ts';

test('momento, nación y complejidad se validan y limpian', () => {
  const clean = cleanRecipe(draft({ moments: ['postre', 'desayuno-merienda', 'postre'], cuisine: '  Italia  ', difficulty: 'media' }));
  assert.deepEqual(clean.moments, ['desayuno-merienda', 'postre']);
  assert.equal(clean.cuisine, 'Italia');
  assert.equal(clean.difficulty, 'media');
  assert.deepEqual(cleanRecipe(draft()).moments, []);
  assert.equal(cleanRecipe(draft({ difficulty: '' })).difficulty, undefined);
  assert.throws(() => cleanRecipe(draft({ moments: ['brunch'] })), /Momento/);
  assert.throws(() => cleanRecipe(draft({ difficulty: 'experto' })), /Complejidad/);
});

test('"cualquier momento" va solo', () => {
  assert.deepEqual(normalizeMoments(['postre', 'cualquier-momento']), ['cualquier-momento']);
  assert.deepEqual(cleanRecipe(draft({ moments: ['almuerzo-cena', 'cualquier-momento'] })).moments, ['cualquier-momento']);
});

test('la descripción acepta textos largos', () => {
  assert.equal(cleanRecipe(draft({ summary: 'a'.repeat(maxSummary) })).summary.length, maxSummary);
  assert.throws(() => cleanRecipe(draft({ summary: 'a'.repeat(maxSummary + 1) })), /demasiado largo/);
});

test('filtros combinados, conteos y orden del catálogo', () => {
  const card = (title, patch) => ({ title, categories: [], moments: [], cuisine: '', difficulty: undefined, minutes: undefined, ...patch });
  const tarta = card('Tarta de ricota', { moments: ['postre'], categories: ['Tartas'], cuisine: 'Italia', difficulty: 'media', minutes: 60 });
  const pan = card('Pan de ajo', { moments: ['cualquier-momento'], categories: ['Panes'], difficulty: 'facil', minutes: 30 });
  const salsa = card('Salsa criolla', { moments: ['almuerzo-cena'], categories: ['Salsas'], cuisine: 'Argentina' });
  const all = [tarta, pan, salsa];
  // "Cualquier momento" aparece también en cada momento.
  assert.deepEqual(all.filter(r => matchesFilters(r, { ...noFilters, moment: 'postre' })), [tarta, pan]);
  assert.deepEqual(all.filter(r => matchesFilters(r, { ...noFilters, moment: 'postre', difficulty: 'facil' })), [pan]);
  assert.deepEqual(all.filter(r => matchesFilters(r, { ...noFilters, cuisine: 'Argentina' })), [salsa]);
  // Los conteos de un eje respetan los demás filtros pero no el propio.
  const counts = facetCounts(all, { ...noFilters, moment: 'postre', difficulty: 'media' }, 'moment', ['postre', 'almuerzo-cena']);
  assert.equal(counts.get('postre'), 1);
  assert.equal(counts.get('almuerzo-cena'), 0);
  assert.deepEqual(sortRecipes(all, 'alfabetico').map(r => r.title), ['Pan de ajo', 'Salsa criolla', 'Tarta de ricota']);
  assert.deepEqual(sortRecipes(all, 'tiempo').map(r => r.title), ['Pan de ajo', 'Tarta de ricota', 'Salsa criolla']);
  assert.equal(sortRecipes(all, 'recientes'), all);
  assert.deepEqual(recipeCuisines(all), ['Argentina', 'Italia']);
  assert.equal(filterHref('type', 'Salsas y aderezos'), '/?tipo=Salsas%20y%20aderezos');
});

test('la tarjeta, los faltantes y el JSON-LD usan la taxonomía', () => {
  const recipe = { ...cleanRecipe(draft({ moments: ['postre'], cuisine: 'Italia', difficulty: 'facil', categories: ['Tartas'] })), siteId: 'comidasdelcielo' };
  const card = toRecipeCard(recipe);
  assert.equal(card.difficulty, 'facil');
  assert.ok(card.search.includes('italia') && card.search.includes('postre'));
  assert.ok(!recipeGaps(recipe).includes('momento'));
  assert.ok(recipeGaps({ ...recipe, moments: [], difficulty: undefined }).includes('complejidad'));
  const ld = recipeJsonLd(recipe, 'https://comidasdelcielo.vercel.app', 'Comidas del cielo');
  assert.equal(ld.recipeCategory, 'Postre');
  assert.equal(ld.recipeCuisine, 'Italia');
});

test('una descripción larga se separa en títulos, párrafos y listas, y el primer párrafo es el resumen', async () => {
  const { descriptionBlocks, descriptionLead } = await import('../lib/recipes.ts');
  const text = 'Descripción de la planta\n\nUn arbusto de hojas tricolores.\n\n🍇 Perfil de sabor\n\nCuatro etapas:\n• Nota inicial: salada\n• Cierre terroso';
  assert.deepEqual(descriptionBlocks(text), [
    { kind: 'heading', text: 'Descripción de la planta' },
    { kind: 'paragraph', text: 'Un arbusto de hojas tricolores.' },
    { kind: 'heading', text: '🍇 Perfil de sabor' },
    { kind: 'paragraph', text: 'Cuatro etapas:' },
    { kind: 'list', items: [{ label: 'Nota inicial', text: 'salada' }, { text: 'Cierre terroso' }] },
  ]);
  assert.deepEqual(descriptionLead(text), { lead: 'Un arbusto de hojas tricolores.', more: true });
  assert.deepEqual(descriptionLead('Clásica salsa de la abuela'), { lead: 'Clásica salsa de la abuela', more: false });
});

test('el filtro de tiempo total separa por rangos y deja afuera las recetas sin tiempo', async () => {
  const { matchesFilters, noFilters, filterHref } = await import('../lib/recipes.ts');
  const base = { categories: [], moments: [], cuisine: '', difficulty: undefined };
  const rapida = { ...base, minutes: 30 }, media = { ...base, minutes: 45 }, larga = { ...base, minutes: 95 }, sinTiempo = { ...base };
  const all = [rapida, media, larga, sinTiempo];
  assert.deepEqual(all.filter(r => matchesFilters(r, { ...noFilters, time: '30' })), [rapida]);
  assert.deepEqual(all.filter(r => matchesFilters(r, { ...noFilters, time: '60' })), [media]);
  assert.deepEqual(all.filter(r => matchesFilters(r, { ...noFilters, time: 'mas' })), [larga]);
  assert.equal(filterHref('time', '30'), '/?duracion=30');
});
