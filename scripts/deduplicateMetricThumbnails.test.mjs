import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { deleteFilter, parseOptions } from './deduplicateMetricThumbnails.mjs';

const require = createRequire(import.meta.url);
const { ObjectId } = require('mongoose').mongo;

test('a aplicação exige banco esperado e limite válido', () => {
  assert.throws(() => parseOptions(['--apply']), /expected-db/);
  assert.throws(() => parseOptions(['--apply', '--expected-db=data2content', '--limit=0']), /Limite inválido/);
  assert.deepEqual(parseOptions(['--apply', '--expected-db=data2content', '--limit=100']),
    { apply: true, expectedDb: true, limit: 100 });
});

test('o filtro só aceita URLs idênticas e prende valores concorrentes', () => {
  const _id = new ObjectId();
  const updatedAt = new Date('2026-09-25T00:00:00.000Z');
  const doc = { _id, coverUrl: 'https://img.example/a', thumbnailUrl: 'https://img.example/a', updatedAt };
  assert.deepEqual(deleteFilter(doc), { _id, coverUrl: doc.coverUrl, thumbnailUrl: doc.thumbnailUrl, updatedAt });
  assert.throws(() => deleteFilter({ ...doc, thumbnailUrl: 'https://img.example/b' }), /fora da deduplicação/);
  assert.throws(() => deleteFilter({ ...doc, coverUrl: '' }), /fora da deduplicação/);
});
