/**
 * Retira do banco o que nenhum recurso lê (auditoria de 26/09/2026,
 * docs/auditoria-mongodb-campos-sem-uso-2026-09-26.md):
 *  - accountinsights: foto, bio e site copiados em registros antigos. Por usuário+conta fica o
 *    registro mais recente e o mais recente com foto, que é o que as telas consultam.
 *  - daily_metric_snapshots: impressions (sempre zero desde que a Meta aposentou) e __v (sempre 0).
 *  - Índices redundantes ou sobre campo inexistente.
 * Simula por padrão. --apply exige --expected-db=data2content.
 * --drop-after-deploy: índices que o modelo publicado ainda declara (idx_metric_history,
 * idx_metric_dayNumber e 10 de metrics). Só depois da publicação, senão o Mongoose da
 * produção os recria.
 * --compact-gemini-receipts: em leituras concluídas há mais de 30 dias, troca a resposta bruta do
 * Gemini por um recibo (uso e finishReason). Só depois de publicado o geminiGovernance que recusa
 * replay de recibo compactado; a leitura já está em content_reading_states/published_content_evidence.
 * --planner-cache-ttl: cria o TTL de 30 dias em plannerreccaches.frozenAt. O cache nunca é lido
 * (algoVersion gravado como texto e comparado como número); vencidos são arquivados antes.
 */
import { createRequire } from 'node:module';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { MongoClient, BSON } = require('mongoose').mongo;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BATCH_SIZE = 250;
const PROFILE_FIELDS = ['profile_picture_url', 'biography', 'website'];
const ZERO_SNAPSHOT_FIELDS = ['dailyImpressions', 'cumulativeImpressions', '__v'];
const SNAPSHOT_INDEXES = ['metric_1', 'dayNumber_1'];
const SNAPSHOT_INDEXES_AFTER_DEPLOY = ['idx_metric_history', 'idx_metric_dayNumber'];
// Zero uso em 18 dias no primário. stats.total_interactions_-1 fica: a Descobrir ordena por ele.
export const METRIC_INDEXES_AFTER_DEPLOY = [
  'tone_1', 'references_1', 'narrativeForm_1', 'contentSignals_1', 'stance_1', 'proofStyle_1',
  'commercialMode_1', 'source_1', 'classificationLastQueuedAt_1', 'isPubli_1',
];
const INSIGHT_INDEXES = ['fetchDate_1', 'user_1_instagramAccountId_1_fetchDate_-1', 'instagramAccountId_1_fetchDate_-1'];

export function parseOptions(args) {
  const allowed = new Set(['--apply', '--dry-run', '--expected-db=data2content', '--drop-after-deploy', '--compact-gemini-receipts', '--planner-cache-ttl']);
  if (args.some(arg => !allowed.has(arg))) throw new Error('Argumento desconhecido.');
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Escolha simulação ou aplicação.');
  const apply = args.includes('--apply');
  if (apply && !args.includes('--expected-db=data2content')) throw new Error('Aplicação exige --expected-db=data2content.');
  return { apply, dropAfterDeploy: args.includes('--drop-after-deploy'), compactGeminiReceipts: args.includes('--compact-gemini-receipts'), plannerCacheTtl: args.includes('--planner-cache-ttl') };
}

/**
 * Recebe registros ordenados por user, conta e recordedAt decrescente. Em cada grupo protege o
 * primeiro (mais recente) e o primeiro com foto; devolve os demais que ainda carregam cópias.
 */
export async function* supersededProfileCopies(docs) {
  let group = null;
  let sawPicture = false;
  let lastDate = null;
  for await (const doc of docs) {
    if (!doc._id || !doc.user || !(doc.recordedAt instanceof Date)) throw new Error('Registro de conta inválido.');
    const key = `${doc.user}|${doc.instagramAccountId ?? ''}`;
    const details = doc.accountDetails || {};
    const hasPicture = typeof details.profile_picture_url === 'string' && details.profile_picture_url !== '';
    if (key !== group) {
      group = key;
      lastDate = doc.recordedAt;
      sawPicture = hasPicture;
      continue; // mais recente do grupo
    }
    if (doc.recordedAt > lastDate) throw new Error('Registros fora de ordem.');
    lastDate = doc.recordedAt;
    if (!sawPicture && hasPicture) { sawPicture = true; continue; } // mais recente com foto
    if (PROFILE_FIELDS.some(field => Object.hasOwn(details, field))) yield doc;
  }
}

export function profileUnsetOperation(doc) {
  const details = doc.accountDetails || {};
  const present = PROFILE_FIELDS.filter(field => Object.hasOwn(details, field));
  if (!doc._id || !present.length) throw new Error('Nada a retirar neste registro.');
  // Só altera se os valores continuarem os arquivados.
  const filter = { _id: doc._id };
  for (const field of present) filter[`accountDetails.${field}`] = details[field];
  return { updateOne: { filter, update: { $unset: Object.fromEntries(present.map(f => [`accountDetails.${f}`, ''])) } } };
}

export function zeroSnapshotFilter() {
  return {
    $or: ZERO_SNAPSHOT_FIELDS.map(field => ({ [field]: { $exists: true } })),
    ...Object.fromEntries(ZERO_SNAPSHOT_FIELDS.map(field => [field, { $in: [0, null] }])),
  };
}

export const RECEIPT_AGE_DAYS = 30;

export function geminiReceiptFilter(now) {
  return {
    state: 'received',
    outcome: 'complete',
    updatedAt: { $lt: new Date(+now - RECEIPT_AGE_DAYS * 86400000) },
    'response.compactedAt': { $exists: false },
    'response.text': { $exists: true },
  };
}

export function compactReceipt(response, now) {
  return {
    usageMetadata: response?.usageMetadata ?? null,
    candidates: [{ finishReason: response?.candidates?.[0]?.finishReason ?? null }],
    compactedAt: now,
  };
}

async function checksum(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function* readArchive(file) {
  const source = createReadStream(file);
  const unzip = createGunzip();
  source.on('error', error => unzip.destroy(error));
  source.pipe(unzip);
  const lines = createInterface({ input: unzip, crlfDelay: Infinity });
  try { for await (const line of lines) if (line) yield BSON.EJSON.parse(line, { relaxed: false }); }
  finally { lines.close(); source.destroy(); unzip.destroy(); }
}

async function stats(db) {
  const total = await db.command({ dbStats: 1, scale: 1 });
  const collections = {};
  for (const name of ['accountinsights', 'daily_metric_snapshots']) {
    const s = await db.command({ collStats: name, scale: 1 });
    collections[name] = { count: s.count, dataBytes: s.size, indexBytes: s.totalIndexSize, indexSizes: s.indexSizes };
  }
  return { dataBytes: total.dataSize, indexBytes: total.indexSize, collections };
}

const sanitize = error => String(error.message).replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[URI oculta]');

export async function trimUnusedMongoFields(options) {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');
  const dbName = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'data2content';
  if (dbName !== 'data2content') throw new Error('O banco configurado não é data2content.');
  const client = new MongoClient(process.env.MONGODB_URI, {
    maxPoolSize: 1, serverSelectionTimeoutMS: 15000, socketTimeoutMS: 120000,
    appName: 'd2c-campos-sem-uso', retryWrites: true,
  });
  let folder;
  let report;
  const save = async () => {
    if (folder) await writeFile(path.join(folder, 'resultado.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  };
  try {
    await client.connect();
    const db = client.db(dbName);
    const insights = db.collection('accountinsights');
    const snapshots = db.collection('daily_metric_snapshots');
    const startedAt = new Date();
    report = { startedAt, dbName, apply: options.apply, status: 'planejando', before: await stats(db) };

    const usersWithPicture = () => insights.aggregate([
      { $match: { 'accountDetails.profile_picture_url': { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$user' } }, { $count: 'n' },
    ]).toArray().then(r => r[0]?.n ?? 0);
    report.usersWithPictureBefore = await usersWithPicture();

    // 1. Plano: cópias de perfil.
    const cursor = insights.find({}, { projection: { user: 1, instagramAccountId: 1, recordedAt: 1, accountDetails: 1 } })
      .sort({ user: 1, instagramAccountId: 1, recordedAt: -1 }).batchSize(1000).maxTimeMS(120000);
    report.profile = { candidates: 0, bytes: 0, updated: 0, skippedChanged: 0 };
    async function* archiveLines() {
      for await (const doc of supersededProfileCopies(cursor)) {
        report.profile.candidates++;
        const removed = { _id: doc._id, accountDetails: Object.fromEntries(PROFILE_FIELDS.filter(f => Object.hasOwn(doc.accountDetails, f)).map(f => [f, doc.accountDetails[f]])) };
        report.profile.bytes += BSON.calculateObjectSize(removed.accountDetails);
        yield BSON.EJSON.stringify(removed, { relaxed: false }) + '\n';
      }
    }
    if (options.apply) {
      folder = path.join(ROOT, 'output/mongodb-maintenance', 'campos-' + startedAt.toISOString().replace(/[:.]/g, '-'));
      await mkdir(folder, { recursive: true, mode: 0o700 });
      report.backupFile = path.join(folder, 'perfil-copias-antigas.ejsonl.gz');
      await pipeline(Readable.from(archiveLines()), createGzip(), createWriteStream(report.backupFile, { flags: 'wx', mode: 0o600 }));
      const file = await open(report.backupFile, 'r');
      try { await file.sync(); } finally { await file.close(); }
      report.backupSha256 = await checksum(report.backupFile);
      let verified = 0;
      for await (const doc of readArchive(report.backupFile)) { profileUnsetOperation(doc); verified++; }
      if (verified !== report.profile.candidates) throw new Error('Contagem do arquivo de recuperação divergente.');
      report.backupVerifiedCount = verified;
    } else {
      for await (const ignored of archiveLines()) { /* só conta */ }
    }

    // 2. Plano: zeros dos snapshots.
    const zeroCount = await snapshots.countDocuments(zeroSnapshotFilter(), { maxTimeMS: 120000 });
    const nonZero = await snapshots.countDocuments({ $or: ['dailyImpressions', 'cumulativeImpressions'].map(f => ({ [f]: { $exists: true, $nin: [0, null] } })) }, { maxTimeMS: 120000 });
    report.snapshots = { candidates: zeroCount, nonZeroPreserved: nonZero, updated: 0 };

    // 3. Plano: índices.
    const snapIdx = await snapshots.listIndexes().toArray();
    const insIdx = await insights.listIndexes().toArray();
    const fetchDateDocs = await insights.countDocuments({ fetchDate: { $exists: true } });
    const wantedSnap = options.dropAfterDeploy ? [...SNAPSHOT_INDEXES, ...SNAPSHOT_INDEXES_AFTER_DEPLOY] : SNAPSHOT_INDEXES;
    const metricsColl = db.collection('metrics');
    const metricIdx = options.dropAfterDeploy ? (await metricsColl.listIndexes().toArray()).filter(i => METRIC_INDEXES_AFTER_DEPLOY.includes(i.name)) : [];
    if (!snapIdx.some(i => i.name === 'idx_metric_date_unique' && i.unique)) throw new Error('Índice único {metric,date} ausente; não removo os demais.');
    report.indexes = {
      snapshots: snapIdx.filter(i => wantedSnap.includes(i.name)),
      accountinsights: fetchDateDocs === 0 ? insIdx.filter(i => INSIGHT_INDEXES.includes(i.name)) : [],
      metrics: metricIdx,
      fetchDateDocs,
      dropped: [],
    };
    // 4. Plano: recibos do Gemini.
    const operations = db.collection('gemini_operations');
    report.gemini = { enabled: options.compactGeminiReceipts, candidates: 0, bytes: 0, compacted: 0 };
    if (options.compactGeminiReceipts) {
      const row = (await operations.aggregate([
        { $match: geminiReceiptFilter(startedAt) },
        { $group: { _id: null, n: { $sum: 1 }, b: { $sum: { $bsonSize: '$response' } } } },
      ], { maxTimeMS: 60000 }).toArray())[0];
      report.gemini.candidates = row?.n ?? 0;
      report.gemini.bytes = row?.b ?? 0;
    }
    // 5. Plano: TTL do cache do planejamento.
    const planner = db.collection('plannerreccaches');
    const plannerCutoff = new Date(+startedAt - 30 * 86400000);
    report.planner = { enabled: options.plannerCacheTtl, expiring: 0, bytes: 0, ttl: null };
    if (options.plannerCacheTtl) {
      const row = (await planner.aggregate([
        { $match: { frozenAt: { $lt: plannerCutoff } } },
        { $group: { _id: null, n: { $sum: 1 }, b: { $sum: { $bsonSize: '$$ROOT' } } } },
      ]).toArray())[0];
      report.planner.expiring = row?.n ?? 0;
      report.planner.bytes = row?.b ?? 0;
    }
    report.status = 'plano_conferido';
    await save();
    console.log(JSON.stringify({ etapa: report.status, aplicar: options.apply, perfil: report.profile, snapshots: report.snapshots, gemini: report.gemini, planejamento: report.planner, indices: [...report.indexes.snapshots, ...report.indexes.accountinsights, ...report.indexes.metrics].map(i => i.name), backup: report.backupFile }));
    if (!options.apply) return report;

    // Execução: índices (liberam espaço na hora; especificação guardada no resultado para recriar).
    for (const spec of report.indexes.snapshots) { await snapshots.dropIndex(spec.name); report.indexes.dropped.push(`daily_metric_snapshots.${spec.name}`); await save(); }
    for (const spec of report.indexes.accountinsights) { await insights.dropIndex(spec.name); report.indexes.dropped.push(`accountinsights.${spec.name}`); await save(); }
    for (const spec of report.indexes.metrics) { await metricsColl.dropIndex(spec.name); report.indexes.dropped.push(`metrics.${spec.name}`); await save(); }

    // Execução: cópias de perfil, com condição sobre os valores arquivados.
    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const result = await insights.bulkWrite(batch.map(profileUnsetOperation), { ordered: false, writeConcern: { w: 'majority', wtimeoutMS: 15000 } });
      report.profile.updated += result.modifiedCount;
      report.profile.skippedChanged += batch.length - result.matchedCount;
      batch = [];
      report.status = 'retirando_copias_de_perfil';
      await save();
      await new Promise(resolve => setTimeout(resolve, 50));
    };
    for await (const doc of readArchive(report.backupFile)) { batch.push(doc); if (batch.length >= BATCH_SIZE) await flush(); }
    await flush();

    // Execução: zeros dos snapshots, em lotes por _id.
    const unset = { $unset: Object.fromEntries(ZERO_SNAPSHOT_FIELDS.map(f => [f, ''])) };
    let ids = [];
    const flushZeros = async () => {
      if (!ids.length) return;
      const result = await snapshots.updateMany({ _id: { $in: ids }, ...zeroSnapshotFilter() }, unset, { writeConcern: { w: 'majority', wtimeoutMS: 15000 } });
      report.snapshots.updated += result.modifiedCount;
      ids = [];
      report.status = 'retirando_zeros_de_snapshots';
      if (report.snapshots.updated % 20000 < 1000) await save();
      await new Promise(resolve => setTimeout(resolve, 30));
    };
    for await (const doc of snapshots.find(zeroSnapshotFilter(), { projection: { _id: 1 } }).batchSize(1000)) {
      ids.push(doc._id);
      if (ids.length >= 1000) await flushZeros();
    }
    await flushZeros();

    // Execução: recibos do Gemini, com cópia integral antes.
    if (options.compactGeminiReceipts && report.gemini.candidates) {
      const receiptFile = path.join(folder, 'gemini-respostas.ejsonl.gz');
      const lines = async function* () {
        for await (const doc of operations.find(geminiReceiptFilter(startedAt), { projection: { response: 1, updatedAt: 1 } })) {
          yield BSON.EJSON.stringify(doc, { relaxed: false }) + '\n';
        }
      };
      await pipeline(Readable.from(lines()), createGzip(), createWriteStream(receiptFile, { flags: 'wx', mode: 0o600 }));
      report.geminiBackupSha256 = await checksum(receiptFile);
      for await (const doc of readArchive(receiptFile)) {
        const result = await operations.updateOne(
          { _id: doc._id, updatedAt: doc.updatedAt, ...geminiReceiptFilter(startedAt) },
          { $set: { response: compactReceipt(doc.response, startedAt) } },
          { writeConcern: { w: 'majority', wtimeoutMS: 15000 } },
        );
        report.gemini.compacted += result.modifiedCount;
      }
      await save();
    }

    // Execução: TTL do cache do planejamento, com cópia dos que vão expirar.
    if (options.plannerCacheTtl) {
      const plannerFile = path.join(folder, 'planejamento-cache-vencido.ejsonl.gz');
      const lines = async function* () {
        for await (const doc of planner.find({ frozenAt: { $lt: plannerCutoff } })) yield BSON.EJSON.stringify(doc, { relaxed: false }) + '\n';
      };
      await pipeline(Readable.from(lines()), createGzip(), createWriteStream(plannerFile, { flags: 'wx', mode: 0o600 }));
      report.plannerBackupSha256 = await checksum(plannerFile);
      const existing = (await planner.listIndexes().toArray()).find(i => i.key.frozenAt === 1 && Object.keys(i.key).length === 1);
      if (existing && existing.expireAfterSeconds !== 30 * 86400) await db.command({ collMod: 'plannerreccaches', index: { name: existing.name, expireAfterSeconds: 30 * 86400 } });
      if (!existing) await planner.createIndex({ frozenAt: 1 }, { name: 'frozenAt_ttl', expireAfterSeconds: 30 * 86400 });
      report.planner.ttl = (await planner.listIndexes().toArray()).find(i => i.key.frozenAt === 1)?.expireAfterSeconds ?? null;
      if (report.planner.ttl !== 30 * 86400) throw new Error('TTL do cache do planejamento não confirmado.');
      await save();
    }

    // Conferência.
    report.check = {
      usersWithPictureAfter: await usersWithPicture(),
      usersWithPictureBefore: report.usersWithPictureBefore,
      snapshotsNonZeroStill: await snapshots.countDocuments({ $or: ['dailyImpressions', 'cumulativeImpressions'].map(f => ({ [f]: { $exists: true, $nin: [0, null] } })) }),
      snapshotsZeroLeft: await snapshots.countDocuments(zeroSnapshotFilter()),
    };
    report.after = await stats(db);
    report.finishedAt = new Date();
    if (report.check.usersWithPictureAfter !== report.usersWithPictureBefore || report.check.snapshotsNonZeroStill !== report.snapshots.nonZeroPreserved) {
      throw new Error('Conferência divergente: usuários com foto ou valores não zero mudaram; revisar o relatório.');
    }
    report.status = report.profile.skippedChanged ? 'concluido_com_registros_alterados_preservados' : 'concluido';
    await save();
    return report;
  } catch (error) {
    if (report) { report.status = 'interrompido'; report.error = { name: error.name, code: error.codeName || error.code, message: sanitize(error) }; await save(); }
    throw error;
  } finally { await client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const result = await trimUnusedMongoFields(parseOptions(process.argv.slice(2))); console.log(JSON.stringify({ status: result.status, perfil: result.profile, snapshots: result.snapshots, indices: result.indexes?.dropped, conferencia: result.check, antes: { dados: result.before?.dataBytes, indices: result.before?.indexBytes }, depois: result.after && { dados: result.after.dataBytes, indices: result.after.indexBytes } }, null, 2)); }
  catch (error) { console.error(JSON.stringify({ erro: error.name, codigo: error.codeName || error.code, mensagem: sanitize(error) })); process.exitCode = 1; }
}
