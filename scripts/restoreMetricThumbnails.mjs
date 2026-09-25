/** Restaura somente miniaturas ainda ausentes, usando a cópia verificada da deduplicação. */
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveRows, deleteFilter, hashFile } from './deduplicateMetricThumbnails.mjs';

const require = createRequire(import.meta.url);
const { MongoClient } = require('mongoose').mongo;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_ROOT = path.join(ROOT, 'output', 'mongodb-maintenance');
const BATCH_SIZE = 250;

export function parseOptions(args) {
  const result = { apply: false, expectedDb: false, archive: null };
  for (const arg of args) {
    if (arg === '--apply') result.apply = true;
    else if (arg === '--dry-run') result.apply = false;
    else if (arg === '--expected-db=data2content') result.expectedDb = true;
    else if (arg.startsWith('--archive=')) result.archive = arg.slice('--archive='.length);
    else throw new Error('Argumento desconhecido.');
  }
  if (!result.archive) throw new Error('Informe --archive=caminho/miniaturas-duplicadas.ejsonl.gz.');
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Escolha simulação ou aplicação.');
  if (result.apply && !result.expectedDb) throw new Error('Restauração exige --expected-db=data2content.');
  return result;
}

export function restoreFilter(doc) {
  deleteFilter(doc);
  return {
    _id: doc._id,
    coverUrl: doc.coverUrl,
    thumbnailUrl: { $exists: false },
    updatedAt: Object.hasOwn(doc, 'updatedAt') ? doc.updatedAt : { $exists: false },
  };
}

export async function restoreMetricThumbnails(options) {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');
  const dbName = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'data2content';
  if (dbName !== 'data2content') throw new Error('Banco configurado não é data2content.');
  const outputRoot = await realpath(OUTPUT_ROOT);
  const archive = await realpath(options.archive);
  if (!archive.startsWith(`${outputRoot}${path.sep}`) || path.basename(archive) !== 'miniaturas-duplicadas.ejsonl.gz') {
    throw new Error('Arquivo de recuperação fora da pasta esperada.');
  }
  const folder = path.dirname(archive);
  const original = JSON.parse(await readFile(path.join(folder, 'resultado.json'), 'utf8'));
  if (original.dbName !== dbName || !original.verified || original.archiveFile !== archive || original.sha256 !== await hashFile(archive)) {
    throw new Error('Arquivo de recuperação sem verificação íntegra.');
  }
  let count = 0;
  for await (const doc of archiveRows(archive)) { restoreFilter(doc); count++; }
  if (count !== original.archived) throw new Error('Contagem da cópia divergente.');
  const report = { status: options.apply ? 'aplicando' : 'simulado', dbName, archive,
    sha256: original.sha256, archived: count, restored: 0, skipped: 0, startedAt: new Date() };
  if (!options.apply) return report;

  const client = new MongoClient(process.env.MONGODB_URI, {
    appName: 'd2c-restauracao-capas', maxPoolSize: 1,
    serverSelectionTimeoutMS: 15000, socketTimeoutMS: 60000,
    retryWrites: true, writeConcern: { w: 'majority' },
  });
  const save = () => writeFile(path.join(folder, 'restauracao.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  try {
    await client.connect();
    const metrics = client.db(dbName).collection('metrics');
    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const result = await metrics.bulkWrite(batch.map(doc => ({ updateOne: {
        filter: restoreFilter(doc), update: { $set: { thumbnailUrl: doc.thumbnailUrl } }, upsert: false,
      } })), { ordered: true, writeConcern: { w: 'majority' } });
      report.restored += result.modifiedCount;
      report.skipped += batch.length - result.modifiedCount;
      batch = [];
      await save();
    };
    await save();
    for await (const doc of archiveRows(archive)) {
      batch.push(doc);
      if (batch.length === BATCH_SIZE) await flush();
    }
    await flush();
    report.status = 'concluido';
    await save();
    return report;
  } catch (error) {
    report.status = 'falhou';
    await save();
    throw error;
  } finally {
    await client.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  restoreMetricThumbnails(parseOptions(process.argv.slice(2)))
    .then(report => console.log(JSON.stringify({ status: report.status, archived: report.archived,
      restored: report.restored, skipped: report.skipped })))
    .catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
