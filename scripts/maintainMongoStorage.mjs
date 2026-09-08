/**
 * Retenção aprovada: oito meses de snapshots + uma referência anterior por post;
 * PDFs vencidos. Simula por padrão. --apply exige --expected-db=data2content.
 * O arquivo de recuperação contém BSON canônico em JSONL gzip, com SHA-256.
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
const SNAPSHOTS = 'daily_metric_snapshots';
const PDFS = 'mediakitpdfcaches';
const BATCH_SIZE = 250;

export function parseOptions(args) {
  const allowed = new Set(['--apply', '--dry-run', '--expected-db=data2content', '--ensure-pdf-ttl']);
  if (args.some(arg => !allowed.has(arg))) throw new Error('Argumento desconhecido.');
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Escolha simulação ou aplicação.');
  const apply = args.includes('--apply');
  if (apply && !args.includes('--expected-db=data2content')) throw new Error('Aplicação exige --expected-db=data2content.');
  return { apply, ensurePdfTtl: args.includes('--ensure-pdf-ttl') };
}

// Recebe somente datas anteriores ao corte, ordenadas por post e data decrescente.
// O primeiro registro de CADA post fica no banco, mesmo se todo o histórico for antigo.
export async function* removableSnapshots(cursor, cutoff, anchors) {
  let currentMetric = null;
  let lastDate = null;
  const seen = new Set();
  for await (const doc of cursor) {
    if (!doc._id || !doc.metric || !(doc.date instanceof Date) || !(doc.date < cutoff)) {
      throw new Error('Snapshot inválido ou fora da janela autorizada.');
    }
    const key = String(doc.metric);
    if (key !== currentMetric) {
      if (seen.has(key)) throw new Error('Cursor fora de ordem por post.');
      seen.add(key);
      currentMetric = key;
      lastDate = doc.date;
      anchors.push({ _id: doc._id, metric: doc.metric, date: doc.date });
      continue;
    }
    if (doc.date >= lastDate) throw new Error('Datas duplicadas ou fora de ordem.');
    lastDate = doc.date;
    yield doc;
  }
}

export function snapshotDeleteFilter(doc, cutoff) {
  if (!(doc.date instanceof Date) || !(doc.date < cutoff) || !doc._id || !doc.metric) {
    throw new Error('Tentativa de excluir snapshot fora do escopo.');
  }
  return {
    _id: doc._id, metric: doc.metric, date: { $eq: doc.date, $lt: cutoff },
    updatedAt: Object.hasOwn(doc, 'updatedAt') ? doc.updatedAt : { $exists: false },
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
  for (const name of [SNAPSHOTS, PDFS, 'metrics', 'users']) {
    const s = await db.command({ collStats: name, scale: 1 });
    collections[name] = { count: s.count, dataBytes: s.size, indexBytes: s.totalIndexSize, storageBytes: s.storageSize };
  }
  return { dataBytes: total.dataSize, indexBytes: total.indexSize, collections };
}

export async function maintainMongoStorage(options) {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');
  const dbName = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'data2content';
  if (dbName !== 'data2content') throw new Error('O banco configurado não é data2content.');
  const client = new MongoClient(process.env.MONGODB_URI, {
    maxPoolSize: 1, serverSelectionTimeoutMS: 15000, socketTimeoutMS: 60000,
    appName: 'd2c-retencao-oito-meses', retryWrites: true,
  });
  let folder;
  let report;
  const save = async () => {
    if (folder) await writeFile(path.join(folder, 'resultado.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  };
  try {
    await client.connect();
    const db = client.db(dbName);
    // O relógio do banco evita antecipar expiração por desvio no relógio do cliente.
    const hello = await db.command({ hello: 1 });
    const now = hello.localTime;
    if (!(now instanceof Date) || Math.abs(+now - Date.now()) > 300000) throw new Error('Relógio do banco inválido ou divergente.');
    const cutRows = await db.collection(SNAPSHOTS).aggregate([
      { $limit: 1 },
      { $project: { _id: 0, cutoff: { $dateSubtract: { startDate: now, unit: 'month', amount: 8, timezone: 'America/Sao_Paulo' } } } },
    ], { maxTimeMS: 10000 }).toArray();
    if (!cutRows[0]?.cutoff) throw new Error('Sem snapshots para calcular a janela; não houve escrita.');
    const cutoff = cutRows[0].cutoff;
    const snapshots = db.collection(SNAPSHOTS);
    const pdfs = db.collection(PDFS);
    const oldFilter = { date: { $type: 'date', $lt: cutoff } };
    const anchors = [];
    report = { startedAt: now, dbName, apply: options.apply, cutoff, retentionMonths: 8, status: 'planejando', before: await stats(db), candidates: { count: 0, bytes: 0 }, deletedSnapshots: 0, deletedPdfs: 0 };
    const cursor = snapshots.find(oldFilter).sort({ metric: 1, date: -1 }).batchSize(500).maxTimeMS(60000);
    async function* archiveLines() {
      for await (const doc of removableSnapshots(cursor, cutoff, anchors)) {
        report.candidates.count++;
        report.candidates.bytes += BSON.calculateObjectSize(doc);
        yield BSON.EJSON.stringify(doc, { relaxed: false }) + '\n';
      }
    }
    if (options.apply) {
      folder = path.join(ROOT, 'output/mongodb-maintenance', now.toISOString().replace(/[:.]/g, '-') + '-' + process.pid);
      await mkdir(folder, { recursive: true, mode: 0o700 });
      report.backupFile = path.join(folder, 'snapshots-removiveis.ejsonl.gz');
      await pipeline(Readable.from(archiveLines()), createGzip(), createWriteStream(report.backupFile, { flags: 'wx', mode: 0o600 }));
      // Forçar a cópia a disco antes da primeira exclusão.
      const file = await open(report.backupFile, 'r');
      try { await file.sync(); } finally { await file.close(); }
      report.backupSha256 = await checksum(report.backupFile);
      let verified = 0;
      const anchorIds = new Set(anchors.map(a => String(a._id)));
      for await (const doc of readArchive(report.backupFile)) {
        snapshotDeleteFilter(doc, cutoff);
        if (anchorIds.has(String(doc._id))) throw new Error('Referência protegida encontrada no arquivo de exclusão.');
        verified++;
      }
      if (verified !== report.candidates.count) throw new Error('Contagem do arquivo de recuperação divergente.');
      report.backupVerifiedCount = verified;
      await writeFile(path.join(folder, 'referencias-preservadas.ejson'), BSON.EJSON.stringify(anchors, { relaxed: false }), { mode: 0o600 });
    } else {
      for await (const ignored of archiveLines()) { /* Conta sem persistir documentos. */ }
    }
    report.preservedAnchors = anchors.length;
    report.expiredPdfs = (await pdfs.aggregate([
      { $match: { expiresAt: { $type: 'date', $lt: now } } },
      { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: { $bsonSize: '$$ROOT' } } } },
    ], { maxTimeMS: 15000 }).toArray())[0] || { count: 0, bytes: 0 };
    report.status = 'plano_conferido';
    await save();
    console.log(JSON.stringify({ etapa: report.status, aplicar: options.apply, corte: cutoff, snapshots: report.candidates, referencias: anchors.length, pdfs: report.expiredPdfs, backup: report.backupFile }));
    if (!options.apply) return report;

    // Sem alteração em modelos, índices de snapshots ou demais coleções.
    let anchorCount = 0;
    for (let i = 0; i < anchors.length; i += BATCH_SIZE) {
      anchorCount += await snapshots.countDocuments({ $or: anchors.slice(i, i + BATCH_SIZE) }, { maxTimeMS: 10000 });
    }
    if (anchorCount !== anchors.length) throw new Error('Uma referência mudou durante o preparo; limpeza interrompida.');
    report.recentCountBefore = await snapshots.countDocuments({ date: { $gte: cutoff } }, { maxTimeMS: 15000 });
    let batch = [];
    let batches = 0;
    const flush = async () => {
      if (!batch.length) return;
      const operations = batch.map(doc => ({ deleteOne: { filter: snapshotDeleteFilter(doc, cutoff) } }));
      const deleted = await snapshots.bulkWrite(operations, { ordered: true, writeConcern: { w: 'majority', wtimeoutMS: 15000 } });
      report.deletedSnapshots += deleted.deletedCount;
      report.skippedChangedSnapshots = (report.skippedChangedSnapshots || 0) + batch.length - deleted.deletedCount;
      batch = [];
      batches++;
      report.status = 'excluindo_snapshots';
      await save();
      if (batches % 20 === 0) console.log(JSON.stringify({ etapa: report.status, excluidos: report.deletedSnapshots }));
      await new Promise(resolve => setTimeout(resolve, 50));
    };
    for await (const doc of readArchive(report.backupFile)) { batch.push(doc); if (batch.length >= BATCH_SIZE) await flush(); }
    await flush();
    const expiredIds = await pdfs.find({ expiresAt: { $type: 'date', $lt: now } }, { projection: { _id: 1 } }).toArray();
    for (let i = 0; i < expiredIds.length; i += 10) {
      const removed = await pdfs.deleteMany({ _id: { $in: expiredIds.slice(i, i + 10).map(d => d._id) }, expiresAt: { $type: 'date', $lt: now } }, { writeConcern: { w: 'majority', wtimeoutMS: 15000 } });
      report.deletedPdfs += removed.deletedCount;
    }
    await save();
    if (options.ensurePdfTtl) {
      const indexes = await pdfs.listIndexes().toArray();
      const index = indexes.find(i => Object.keys(i.key).length === 1 && i.key.expiresAt === 1);
      if (index && index.expireAfterSeconds !== 0) {
        await db.command({ collMod: PDFS, index: { name: index.name, expireAfterSeconds: 0 } });
      } else if (!index) {
        await pdfs.createIndex({ expiresAt: 1 }, { name: 'expiresAt_1', expireAfterSeconds: 0 });
      }
      report.pdfTtl = (await pdfs.listIndexes().toArray()).find(i => i.key.expiresAt === 1)?.expireAfterSeconds;
      if (report.pdfTtl !== 0) throw new Error('O índice TTL de PDFs não foi confirmado.');
    }
    report.preservedAnchorsAfter = 0;
    for (let i = 0; i < anchors.length; i += BATCH_SIZE) {
      report.preservedAnchorsAfter += await snapshots.countDocuments({ $or: anchors.slice(i, i + BATCH_SIZE) }, { maxTimeMS: 10000 });
    }
    report.recentCountAfter = await snapshots.countDocuments({ date: { $gte: cutoff } }, { maxTimeMS: 15000 });
    report.oldCountAfter = await snapshots.countDocuments(oldFilter, { maxTimeMS: 15000 });
    report.after = await stats(db);
    report.finishedAt = new Date();
    if (report.preservedAnchorsAfter !== anchors.length || report.recentCountAfter < report.recentCountBefore) throw new Error('A conferência de preservação encontrou divergência; revisar o relatório.');
    report.status = report.skippedChangedSnapshots ? 'concluido_com_registros_alterados_preservados' : 'concluido';
    await save();
    return report;
  } catch (error) {
    if (report) { report.status = 'interrompido'; report.error = { name: error.name, code: error.codeName || error.code, message: String(error.message).replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[URI oculta]') }; await save(); }
    throw error;
  } finally { await client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const result = await maintainMongoStorage(parseOptions(process.argv.slice(2))); console.log(JSON.stringify(result, null, 2)); }
  catch (error) { console.error(JSON.stringify({ erro: error.name, codigo: error.codeName || error.code, mensagem: String(error.message).replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[URI oculta]') })); process.exitCode = 1; }
}
