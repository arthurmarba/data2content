import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, removableSnapshots, snapshotDeleteFilter } from './maintainMongoStorage.mjs';

const cutoff = new Date('2026-01-08T00:00:00Z');
const doc = (id, metric, date, extra = {}) => ({ _id: id, metric, date: new Date(date), ...extra });
async function collect(rows) {
  const anchors = [], deleted = [];
  for await (const value of removableSnapshots(rows, cutoff, anchors)) deleted.push(value._id);
  return { anchors: anchors.map(a => a._id), deleted };
}
test('preserva referência por post, inclusive o post cujo único registro é antigo', async () => {
  assert.deepEqual(await collect([
    doc('a1', 'a', '2026-01-07'), doc('a2', 'a', '2025-12-01'), doc('a3', 'a', '2025-11-01'),
    doc('b1', 'b', '2025-01-01'), doc('c1', 'c', '2025-12-31'), doc('c2', 'c', '2025-12-30'),
  ]), { anchors: ['a1', 'b1', 'c1'], deleted: ['a2', 'a3', 'c2'] });
});
test('bloqueia a data exata do corte, registros recentes e datas inválidas', async () => {
  for (const date of ['2026-01-08', '2026-09-07', 'invalida']) {
    await assert.rejects(collect([doc('a1', 'a', date)]));
    assert.throws(() => snapshotDeleteFilter(doc('a1', 'a', date), cutoff));
  }
});
test('interrompe se a ordenação quebrar a escolha da referência', async () => {
  await assert.rejects(collect([doc('a1', 'a', '2025-12-01'), doc('a2', 'a', '2025-12-02')]));
  await assert.rejects(collect([doc('a1', 'a', '2025-12-01'), doc('b1', 'b', '2025-12-01'), doc('a2', 'a', '2025-11-01')]));
});
test('reexecução após a limpeza não seleciona nenhuma referência para exclusão', async () => {
  const result = await collect([doc('a1', 'a', '2026-01-07'), doc('b1', 'b', '2025-01-01')]);
  assert.deepEqual(result.deleted, []);
});
test('a exclusão exige o mesmo registro, post, data e versão de atualização', () => {
  const row = doc('a1', 'a', '2025-12-01', { updatedAt: new Date('2025-12-02') });
  assert.deepEqual(snapshotDeleteFilter(row, cutoff), { _id: 'a1', metric: 'a', date: { $eq: row.date, $lt: cutoff }, updatedAt: row.updatedAt });
  assert.deepEqual(snapshotDeleteFilter(doc('a2', 'a', '2025-12-01'), cutoff).updatedAt, { $exists: false });
});
test('simula por padrão e exige indicação explícita do banco ao aplicar', () => {
  assert.equal(parseOptions([]).apply, false);
  assert.throws(() => parseOptions(['--apply']));
  assert.throws(() => parseOptions(['--apply', '--dry-run', '--expected-db=data2content']));
  assert.throws(() => parseOptions(['--months=6']));
  assert.equal(parseOptions(['--apply', '--expected-db=data2content', '--ensure-pdf-ttl']).apply, true);
});
