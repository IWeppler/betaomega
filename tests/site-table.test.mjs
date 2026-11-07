import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeBody, scopeQuery, siteDocumentKey } from '../lib/site-table.ts';

test('las claves de los documentos no cambian: son las que ya están guardadas', () => {
  assert.equal(siteDocumentKey('products', 'purificacion'), 'products:purificacion');
  assert.equal(siteDocumentKey('site', 'comidasdelcielo'), 'site:comidasdelcielo');
});

test('un id de sitio raro no puede apuntar al documento de otro', () => {
  for (const id of ['', 'a:b', 'a/b', 'A', 'a b', 'a,b']) assert.throws(() => siteDocumentKey('products', id), /inválido/);
});

test('toda consulta lleva el filtro del sitio primero', () => {
  assert.equal(scopeQuery('comidasdelcielo'), '?site_id=eq.comidasdelcielo');
  assert.equal(scopeQuery('comidasdelcielo', 'select=*&order=title.asc'), '?site_id=eq.comidasdelcielo&select=*&order=title.asc');
  assert.equal(scopeQuery('a', '?id=eq.1'), '?site_id=eq.a&id=eq.1', 'acepta el signo ? inicial');
});

test('el id del sitio se escapa para que no pueda colar otros filtros', () => {
  assert.equal(scopeQuery('x&site_id=eq.otro'), '?site_id=eq.x%26site_id%3Deq.otro');
});

test('una consulta que fija site_id por su cuenta es un error', () => {
  assert.throws(() => scopeQuery('a', 'site_id=eq.b'), /site_id/);
  assert.throws(() => scopeQuery('a', 'id=eq.1&site_id=eq.b'), /site_id/);
  // Una columna cuyo nombre solo termina igual no cuenta.
  assert.doesNotThrow(() => scopeQuery('a', 'other_site_id=eq.b'));
});

test('el cuerpo de una escritura queda marcado con el sitio', () => {
  assert.deepEqual(JSON.parse(scopeBody('a', '{"title":"Pan"}')), { title: 'Pan', site_id: 'a' });
  assert.deepEqual(JSON.parse(scopeBody('a', '{"title":"Pan","site_id":"a"}')), { title: 'Pan', site_id: 'a' });
  assert.deepEqual(JSON.parse(scopeBody('a', '[{"n":1},{"n":2}]')), [{ n: 1, site_id: 'a' }, { n: 2, site_id: 'a' }]);
});

test('un cuerpo de otro sitio no se reescribe en silencio: falla', () => {
  assert.throws(() => scopeBody('a', '{"site_id":"b"}'), /sitio b/);
  assert.throws(() => scopeBody('a', '[{"site_id":"a"},{"site_id":"b"}]'), /sitio b/);
  assert.throws(() => scopeBody('a', '"texto"'), /objeto/);
});
