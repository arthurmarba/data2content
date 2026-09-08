/** Por padrão apenas confere. --apply-indexes cria somente índices das duas coleções de aquisição. */
import mongoose from 'mongoose';
import Journey from '../src/app/models/AcquisitionJourney';
import Event from '../src/app/models/AcquisitionEvent';

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'data2content', autoIndex: false });
  const apply = process.argv.includes('--apply-indexes');
  if (apply) { await Journey.createIndexes(); await Event.createIndexes(); }
  for (const model of [Journey, Event]) {
    const indexes = await model.collection.indexes().catch(() => []);
    console.log(JSON.stringify({ collection: model.collection.name, indexes: indexes.map(i => ({ name: i.name, unique: i.unique, expireAfterSeconds: i.expireAfterSeconds })), applied: apply }));
  }
  console.log(JSON.stringify({ configured: Object.fromEntries(['OPENAI_ADS_API_KEY', 'OPENAI_ADS_PIXEL_ID', 'OPENAI_ADS_CONVERSIONS_API_KEY'].map(k => [k, Boolean(process.env[k])])) }));
}
main().catch(() => { console.error('Falha na preparação da aquisição.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
