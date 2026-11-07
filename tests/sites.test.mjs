import test from 'node:test';
import assert from 'node:assert/strict';
import { isPanelHost, siteForHostIn, seedSites, defaultPanelHosts } from '../lib/sites.ts';

const siteForHost = (host, fallback) => siteForHostIn(seedSites, host, fallback);

test('elige el sitio por dominio, sin www ni puerto', () => {
  assert.equal(siteForHost('nekurel.com').id, 'nekurel');
  assert.equal(siteForHost('www.NEKUREL.com:443').id, 'nekurel');
  assert.equal(siteForHost('nekurel.localhost:3000').id, 'nekurel');
});

test('un dominio desconocido usa el sitio por defecto', () => {
  assert.equal(siteForHost('192.168.0.10:3000').id, 'nekurel');
  assert.equal(siteForHost('otro.com', 'no-existe'), undefined);
});

test('reconoce el dominio del panel', () => {
  assert.equal(isPanelHost('betayomega.vercel.app'), true);
  assert.equal(isPanelHost('panel.localhost:3000'), true);
  assert.equal(isPanelHost('nekurel.com'), false);
  assert.equal(isPanelHost('betayomega.com', 'betayomega.com, panel.localhost'), true);
  assert.equal(isPanelHost('betayomega.vercel.app', 'betayomega.com'), false, 'PANEL_HOSTS reemplaza la lista por defecto');
  assert.ok(defaultPanelHosts.includes('betayomega.vercel.app'));
});

test('una fila del registro se convierte en sitio, con las opciones de su tipo', async () => {
  const { siteFromRow } = await import('../lib/site-registry.ts');
  const water = siteFromRow({
    id: 'agua', kind: 'productos', name: 'Agua', url: 'https://agua.example', catalog_key: null, panel_icon: '/agua.png',
    options: { items: { one: 'agua', many: 'aguas', feminine: true }, descriptionLabel: 'Cómo', application: true, accent: '#0b6e99' },
    site_domains: [{ domain: 'agua.example' }],
  });
  assert.deepEqual(water.domains, ['agua.example']);
  assert.equal(water.panelIcon, '/agua.png');
  assert.equal(water.products.application, true);
  assert.equal('catalogKey' in water, false);
  const shop = siteFromRow({ id: 'tienda', kind: 'herboristeria', name: 'T', url: 'https://t', catalog_key: 'catalog', panel_icon: null, options: {}, site_domains: null });
  assert.equal(shop.catalogKey, 'catalog');
  assert.deepEqual(shop.domains, []);
  assert.equal('products' in shop, false, 'solo los sitios de productos llevan opciones de productos');
});

test('un sitio inactivo lo ve el panel y no el público', async () => {
  const { activeSites, siteFromRow } = await import('../lib/site-registry.ts');
  const row = { kind: 'sauna', name: 'S', url: 'https://s', catalog_key: null, panel_icon: null, options: {}, site_domains: [{ domain: 's.example' }] };
  const hidden = siteFromRow({ ...row, id: 'oculto', active: false });
  const open = siteFromRow({ ...row, id: 'abierto', active: true });
  assert.equal(hidden.inactive, true);
  assert.equal('inactive' in open, false);
  assert.deepEqual(activeSites([hidden, open]).map(site => site.id), ['abierto']);
  assert.equal(siteForHostIn(activeSites([hidden, open]), 's.example', 'no-existe').id, 'abierto', 'el dominio de un sitio inactivo no responde');
});

test('un tipo que este código no conoce se ignora en vez de romper el panel', async () => {
  const { siteFromRow } = await import('../lib/site-registry.ts');
  assert.equal(siteFromRow({ id: 'x', kind: 'tipo-nuevo', name: 'X', url: 'https://x', catalog_key: null, panel_icon: null, options: {}, site_domains: [] }), undefined);
});

test('el seed de supabase/schema.sql coincide con la lista del código', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  for (const site of seedSites) {
    assert.ok(sql.includes(`('${site.id}', '${site.kind}', '${site.name}', '${site.url}'`), `falta ${site.id} en schema.sql`);
    for (const domain of site.domains) assert.ok(sql.includes(`('${domain}', '${site.id}')`), `falta ${domain} en schema.sql`);
  }
});
