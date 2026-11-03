import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMetric, shiftDay, fillDays, sortRecipeRows, compactNumber, niceScale, channelLabel } from '../lib/metrics.ts';

const id = '0b6f7c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f';

test('un evento de visita o de compartido se valida; lo demás se rechaza', () => {
  assert.deepEqual(cleanMetric({ kind: 'view' }), { kind: 'view', recipeId: undefined });
  assert.deepEqual(cleanMetric({ kind: 'view', recipeId: id }), { kind: 'view', recipeId: id });
  assert.deepEqual(cleanMetric({ kind: 'share', channel: 'whatsapp', recipeId: id }), { kind: 'share', recipeId: id, channel: 'whatsapp' });
  assert.deepEqual(cleanMetric({ kind: 'share', channel: 'nativo' }), { kind: 'share', recipeId: undefined, channel: 'nativo' });
  assert.throws(() => cleanMetric({ kind: 'share', channel: 'telegram' }), /Canal/);
  assert.throws(() => cleanMetric({ kind: 'share' }), /Canal/);
  assert.throws(() => cleanMetric({ kind: 'view', recipeId: 'no-es-un-uuid' }), /Receta/);
  assert.throws(() => cleanMetric({ kind: 'page_view' }), /Evento/);
  assert.throws(() => cleanMetric(null), /Evento/);
  assert.throws(() => cleanMetric([]), /Evento/);
});

test('los días se mueven por calendario, también entre meses y años', () => {
  assert.equal(shiftDay('2026-11-03', -2), '2026-11-01');
  assert.equal(shiftDay('2026-11-01', -1), '2026-10-31');
  assert.equal(shiftDay('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDay('2028-02-28', 1), '2028-02-29');
});

test('el reporte se completa con ceros en los días sin actividad, del más viejo al más nuevo', () => {
  const rows = fillDays({ today: '2026-11-03', days: 7, daily: [
    { day: '2026-11-03', pageViews: 5, recipeViews: 3, shares: 1 },
    { day: '2026-10-30', pageViews: 2, recipeViews: 0, shares: 0 },
  ] });
  assert.equal(rows.length, 7);
  assert.equal(rows[0].day, '2026-10-28');
  assert.equal(rows[6].day, '2026-11-03');
  assert.deepEqual(rows[2], { day: '2026-10-30', pageViews: 2, recipeViews: 0, shares: 0 });
  assert.deepEqual(rows[1], { day: '2026-10-29', pageViews: 0, recipeViews: 0, shares: 0 });
  assert.deepEqual(rows[6], { day: '2026-11-03', pageViews: 5, recipeViews: 3, shares: 1 });
});

test('la tabla de recetas se ordena por la columna elegida y desempata por nombre', () => {
  const rows = [
    { id: 'a', title: 'Tarta', views: 5, shares: 0, total: 50 },
    { id: 'b', title: 'Alfajores', views: 5, shares: 2, total: 10 },
    { id: 'c', title: 'Pan', views: 9, shares: 1, total: 30 },
  ];
  assert.deepEqual(sortRecipeRows(rows, 'views').map(r => r.id), ['c', 'b', 'a']);
  assert.deepEqual(sortRecipeRows(rows, 'shares').map(r => r.id), ['b', 'c', 'a']);
  assert.deepEqual(sortRecipeRows(rows, 'total').map(r => r.id), ['a', 'c', 'b']);
  assert.deepEqual(sortRecipeRows(rows, 'title').map(r => r.id), ['b', 'c', 'a']);
  assert.equal(rows[0].id, 'a', 'no modifica la lista original');
});

test('los números del eje salen redondos y compactos', () => {
  assert.equal(compactNumber(950), '950');
  assert.equal(compactNumber(1200), '1.2K');
  assert.equal(compactNumber(12000), '12K');
  assert.deepEqual(niceScale(0), { max: 4, ticks: [0, 1, 2, 3, 4] });
  assert.deepEqual(niceScale(7), { max: 8, ticks: [0, 2, 4, 6, 8] });
  const big = niceScale(1234);
  assert.ok(big.max >= 1234 && big.ticks.length === 5 && big.ticks[0] === 0);
  assert.equal(channelLabel('whatsapp'), 'WhatsApp');
  assert.equal(channelLabel('otro'), 'otro');
});
