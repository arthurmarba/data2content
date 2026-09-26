import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, supersededProfileCopies, profileUnsetOperation, zeroSnapshotFilter } from './trimUnusedMongoFields.mjs';

const d = (id, user, day, details, account = 'ig1') => ({ _id: id, user, instagramAccountId: account, recordedAt: new Date(`2026-09-${String(day).padStart(2, '0')}`), accountDetails: details });
const collect = async gen => { const out = []; for await (const x of gen) out.push(x._id); return out; };

test('simula por padrão e exige o banco para aplicar', () => {
  assert.deepEqual(parseOptions([]), { apply: false, dropAfterDeploy: false, compactGeminiReceipts: false, plannerCacheTtl: false });
  assert.throws(() => parseOptions(['--apply']));
  assert.throws(() => parseOptions(['--apply', '--dry-run', '--expected-db=data2content']));
  assert.throws(() => parseOptions(['--tudo']));
  assert.equal(parseOptions(['--apply', '--expected-db=data2content']).apply, true);
});

test('preserva o mais recente e o mais recente com foto de cada usuário e conta', async () => {
  const pic = { profile_picture_url: 'p', biography: 'b', followers_count: 10 };
  const docs = [
    d('a1', 'u1', 20, { followers_count: 12 }), // mais recente, sem foto
    d('a2', 'u1', 19, pic),                     // mais recente com foto
    d('a3', 'u1', 18, pic),
    d('a4', 'u1', 17, { followers_count: 9 }),  // nada a retirar
    d('b1', 'u1', 16, pic, 'ig2'),              // outra conta: protegido
    d('b2', 'u1', 15, pic, 'ig2'),
    d('c1', 'u2', 20, pic),
  ];
  assert.deepEqual(await collect(supersededProfileCopies(docs)), ['a3', 'b2']);
});

test('recusa ordem errada', async () => {
  const docs = [d('a1', 'u1', 10, {}), d('a2', 'u1', 11, {})];
  await assert.rejects(collect(supersededProfileCopies(docs)));
});

test('retira só foto, bio e site, com condição nos valores arquivados', () => {
  const op = profileUnsetOperation({ _id: 'x', accountDetails: { profile_picture_url: 'p', website: 'w' } });
  assert.deepEqual(op.updateOne.filter, { _id: 'x', 'accountDetails.profile_picture_url': 'p', 'accountDetails.website': 'w' });
  assert.deepEqual(op.updateOne.update, { $unset: { 'accountDetails.profile_picture_url': '', 'accountDetails.website': '' } });
  assert.throws(() => profileUnsetOperation({ _id: 'y', accountDetails: { followers_count: 1 } }));
});

test('zeros dos snapshots: só registros em que os três são zero ou vazios', () => {
  const f = zeroSnapshotFilter();
  for (const field of ['dailyImpressions', 'cumulativeImpressions', '__v']) assert.deepEqual(f[field], { $in: [0, null] });
});

test('recibo do Gemini: só leituras concluídas há mais de 30 dias, conservando uso', async () => {
  const { geminiReceiptFilter, compactReceipt } = await import('./trimUnusedMongoFields.mjs');
  const now = new Date('2026-10-30T00:00:00Z');
  const f = geminiReceiptFilter(now);
  assert.equal(f.state, 'received');
  assert.equal(f.outcome, 'complete');
  assert.equal(+f.updatedAt.$lt, +new Date('2026-09-30T00:00:00Z'));
  const r = compactReceipt({ text: 'x'.repeat(5000), usageMetadata: { promptTokenCount: 9 }, candidates: [{ finishReason: 'STOP', content: {} }] }, now);
  assert.deepEqual(r, { usageMetadata: { promptTokenCount: 9 }, candidates: [{ finishReason: 'STOP' }], compactedAt: now });
  assert.equal(parseOptions(['--compact-gemini-receipts']).compactGeminiReceipts, true);
});

test('índices de posts: a ordenação da Descobrir fica', async () => {
  const { METRIC_INDEXES_AFTER_DEPLOY } = await import('./trimUnusedMongoFields.mjs');
  assert.equal(METRIC_INDEXES_AFTER_DEPLOY.length, 10);
  for (const kept of ['stats.total_interactions_-1', 'format_1', 'proposal_1', 'context_1', 'contentIntent_1', 'type_1', 'user_1_instagramMediaId_1']) {
    assert.ok(!METRIC_INDEXES_AFTER_DEPLOY.includes(kept), kept);
  }
});
