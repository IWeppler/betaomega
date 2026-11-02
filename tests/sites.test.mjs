import test from 'node:test';
import assert from 'node:assert/strict';
import { isPanelHost, siteForHost, defaultPanelHosts } from '../lib/sites.ts';

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
