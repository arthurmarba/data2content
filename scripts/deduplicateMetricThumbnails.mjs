/**
 * Deduplica SOMENTE Metric.thumbnailUrl idêntica a Metric.coverUrl.
 * Simulação por padrão. Não executar --apply antes da publicação da camada de leitura.
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip, createGzip } from 'node:zlib';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { MongoClient, BSON } = require('mongoose').mongo;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BATCH_SIZE = 250;
const CANDIDATES = {
  coverUrl: { $type: 'string', $ne: '' },
  thumbnailUrl: { $type: 'string', $ne: '' },
  $expr: { $eq: ['$thumbnailUrl', '$coverUrl'] },
};

export function parseOptions(args) {
  const options = { apply: false, expectedDb: false, limit: 0 };
  for (const arg of args) {
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.apply = false;
    else if (arg === '--expected-db=data2content') options.expectedDb = true;
    else if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length));
      if (!Number.isSafeInteger(value) || value < 1) throw new Error('Limite inválido.');
      options.limit = value;
    } else throw new Error('Argumento desconhecido.');
  }
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Escolha simulação ou aplicação.');
  if (options.apply && !options.expectedDb) throw new Error('Aplicação exige --expected-db=data2content.');
  return options;
}

export function deleteFilter(doc) {
  if (!doc?._id || typeof doc.coverUrl !== 'string' || !doc.coverUrl || doc.coverUrl !== doc.thumbnailUrl) {
    throw new Error('Documento fora da deduplicação autorizada.');
  }
  return {
    _id: doc._id,
    coverUrl: doc.coverUrl,
    thumbnailUrl: doc.thumbnailUrl,
    updatedAt: Object.hasOwn(doc, 'updatedAt') ? doc.updatedAt : { $exists: false },
  };
}

export async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function* archiveRows(file) {
  const source = createReadStream(file);
  const unzip = createGunzip();
  source.on('error', error => unzip.destroy(error));
  source.pipe(unzip);
  const lines = createInterface({ input: unzip, crlfDelay: Infinity });
  try {
    for await (const line of lines) if (line) yield BSON.EJSON.parse(line, { relaxed: false });
  } finally {
    lines.close();
    source.destroy();
    unzip.destroy();
  }
}

async function sizes(db) {
  const whole = await db.command({ dbStats: 1, scale: 1 });
  const metrics = await db.command({ collStats: 'metrics', scale: 1 });
  return {
    dbDataBytes: whole.dataSize,
    dbIndexBytes: whole.indexSize,
    metricCount: metrics.count,
    metricDataBytes: metrics.size,
    metricStorageBytes: metrics.storageSize,
    metricIndexBytes: metrics.totalIndexSize,
  };
}

export async function deduplicateMetricThumbnails(options) {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');
  const dbName = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'data2content';
  if (dbName !== 'data2content') throw new Error('Banco configurado não é data2content.');
  const client = new MongoClient(process.env.MONGODB_URI, {
    appName: 'd2c-deduplicacao-capas', maxPoolSize: 1,
    serverSelectionTimeoutMS: 15000, socketTimeoutMS: 60000,
    retryWrites: true, writeConcern: { w: 'majority' },
  });
  let folder;
  let report;
  const save = async () => {
    if (folder) await writeFile(path.join(folder, 'resultado.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  };
  try {
    await client.connect();
    const db = client.db(dbName);
    const metrics = db.collection('metrics');
    const clock = await db.command({ hello: 1 });
    const now = clock.localTime;
    if (!(now instanceof Date) || Math.abs(+now - Date.now()) > 300000) throw new Error('Relógio do banco divergente.');
    folder = path.join(ROOT, 'output', 'mongodb-maintenance', `capas-${now.toISOString().replaceAll(':', '-')}`);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    report = { status: 'planejando', dbName, apply: options.apply, startedAt: now, limit: options.limit || null,
      before: await sizes(db), candidatesInDatabase: await metrics.countDocuments(CANDIDATES),
      archived: 0, archivedBytes: 0, verified: false, modified: 0, skippedConcurrent: 0 };
    const archive = path.join(folder, 'miniaturas-duplicadas.ejsonl.gz');
    const cursor = metrics.find(CANDIDATES, {
      projection: { _id: 1, coverUrl: 1, thumbnailUrl: 1, updatedAt: 1 },
      sort: { _id: 1 }, batchSize: BATCH_SIZE,
    });
    if (options.limit) cursor.limit(options.limit);
    async function* lines() {
      for await (const doc of cursor) {
        deleteFilter(doc);
        report.archived++;
        report.archivedBytes += BSON.calculateObjectSize({ thumbnailUrl: doc.thumbnailUrl }) - BSON.calculateObjectSize({});
        yield `${BSON.EJSON.stringify(doc, { relaxed: false })}\n`;
      }
    }
    await pipeline(Readable.from(lines()), createGzip(), createWriteStream(archive, { mode: 0o600 }));
    report.archiveFile = archive;
    report.sha256 = await hashFile(archive);
    let verified = 0;
    for await (const doc of archiveRows(archive)) { deleteFilter(doc); verified++; }
    report.verified = verified === report.archived && report.sha256 === await hashFile(archive);
    if (!report.verified) throw new Error('Cópia divergente; não houve exclusão.');
    report.status = options.apply ? 'pronto_para_aplicar' : 'simulado';
    await save();
    if (!options.apply || !report.archived) return report;

    report.status = 'aplicando';
    await save();
    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const result = await metrics.bulkWrite(batch.map(doc => ({ updateOne: {
        filter: deleteFilter(doc), update: { $unset: { thumbnailUrl: '' } }, upsert: false,
      } })), { ordered: true, writeConcern: { w: 'majority' } });
      report.modified += result.modifiedCount;
      report.skippedConcurrent += batch.length - result.modifiedCount;
      batch = [];
      await save();
    };
    for await (const doc of archiveRows(archive)) {
      batch.push(doc);
      if (batch.length === BATCH_SIZE) await flush();
    }
    await flush();
    report.after = await sizes(db);
    report.remainingDuplicates = await metrics.countDocuments(CANDIDATES);
    report.status = 'concluido';
    await save();
    return report;
  } catch (error) {
    if (report) {
      report.status = 'falhou';
      report.error = error instanceof Error ? error.message : String(error);
      await save();
    }
    throw error;
  } finally {
    await client.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  deduplicateMetricThumbnails(parseOptions(process.argv.slice(2)))
    .then(report => console.log(JSON.stringify({ status: report.status, folder: path.dirname(report.archiveFile),
      archived: report.archived, archivedBytes: report.archivedBytes, modified: report.modified,
      skippedConcurrent: report.skippedConcurrent, remainingDuplicates: report.remainingDuplicates })))
    .catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
