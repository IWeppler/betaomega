import test from 'node:test';
import assert from 'node:assert/strict';
import { canOpen, visibleSections } from '../lib/panel-access.ts';

const sections = [
  { path: '', label: 'Resumen' },
  { path: 'agenda', label: 'Agenda', permission: 'sauna.agenda' },
  { path: 'codigos', label: 'Códigos', permission: 'sauna.codigos' },
];

test('sin lista de permisos (administrador) se ve todo', () => {
  assert.equal(visibleSections(sections).length, 3);
});

test('con permisos se ocultan las secciones que piden otro', () => {
  assert.deepEqual(visibleSections(sections, ['sauna.agenda']).map(s => s.path), ['', 'agenda']);
  assert.deepEqual(visibleSections(sections, []).map(s => s.path), [''], 'el resumen no pide permiso');
});

test('una ruta sin permiso no se puede abrir aunque se escriba a mano', () => {
  assert.equal(canOpen(sections, 'codigos', ['sauna.agenda']), false);
  assert.equal(canOpen(sections, 'agenda', ['sauna.agenda']), true);
  assert.equal(canOpen(sections, 'no-existe'), false);
});
