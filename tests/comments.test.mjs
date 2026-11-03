import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanComment, hasLink, sentTooFast, displayName, pendingCount, isCommentStatus, maxCommentBody, maxCommentName, minFillMs } from '../lib/comments.ts';

test('un comentario válido se limpia: espacios, saltos de línea y caracteres de control', () => {
  const clean = cleanComment({ name: '  Ana   María ', body: '  Quedó\u0007 riquísimo.\r\n\r\n\r\n\r\nLo repito.  ' });
  assert.deepEqual(clean, { name: 'Ana María', body: 'Quedó riquísimo.\n\nLo repito.' });
});

test('el nombre es opcional y se muestra Anónimo si falta', () => {
  const clean = cleanComment({ body: 'Muy bueno' });
  assert.equal(clean.name, '');
  assert.equal(displayName(clean), 'Anónimo');
  assert.equal(displayName({ name: 'Luis' }), 'Luis');
});

test('los comentarios vacíos, demasiado largos o con enlaces se rechazan', () => {
  assert.throws(() => cleanComment({ body: '   ' }), /Escribí tu comentario/);
  assert.throws(() => cleanComment({ body: 'a'.repeat(maxCommentBody + 1) }), /demasiado largo/);
  assert.equal(cleanComment({ body: 'a'.repeat(maxCommentBody) }).body.length, maxCommentBody);
  assert.throws(() => cleanComment({ name: 'a'.repeat(maxCommentName + 1), body: 'ok' }), /nombre es demasiado largo/);
  assert.throws(() => cleanComment({ body: 'Mirá https://spam.example' }), /enlaces/);
  assert.throws(() => cleanComment({ body: 'visiten www.spam.example' }), /enlaces/);
  assert.throws(() => cleanComment({ name: 'www.spam.example', body: 'ok' }), /enlaces/);
  assert.throws(() => cleanComment(null), /inválido/);
  assert.throws(() => cleanComment({ body: 42 }), /inválido/);
  assert.equal(hasLink('Quedó rico.Con limón'), false);
});

test('un formulario enviado demasiado rápido o sin hora de inicio es de un script', () => {
  const now = 1_000_000;
  assert.equal(sentTooFast(undefined, now), true);
  assert.equal(sentTooFast('1', now), true);
  assert.equal(sentTooFast(now - (minFillMs - 1), now), true);
  assert.equal(sentTooFast(now - minFillMs, now), false);
  assert.equal(sentTooFast(now + 600_000, now), true);
});

test('estados y conteo de pendientes', () => {
  assert.ok(isCommentStatus('approved') && !isCommentStatus('spam'));
  assert.equal(pendingCount([{ status: 'pending' }, { status: 'approved' }, { status: 'pending' }, { status: 'hidden' }]), 2);
});
