import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';
import { logger } from '@/app/lib/logger';
import { canonicalizeCategoryValues } from '@/app/lib/classification';

const SCRIPT_TAG = '[SCRIPT_FIX_FORMAT_LABELS]';

async function normalizeFormats() {
  logger.info(`${SCRIPT_TAG} Iniciando canonicalização do campo 'format'...`);
  try {
    await connectToDatabase();
    const docs = await Metric.find({}).select('_id format');

    for (const doc of docs) {
      const currentFormats: string[] = Array.isArray(doc.format) ? doc.format : [];
      const newFormats = canonicalizeCategoryValues(currentFormats, 'format');
      if (newFormats.length === currentFormats.length && newFormats.every((value, index) => value === currentFormats[index])) {
        continue;
      }
      await Metric.updateOne({ _id: doc._id }, { $set: { format: newFormats } });
    }

    logger.info(`${SCRIPT_TAG} Canonicalização concluída para ${docs.length} documentos avaliados.`);
  } catch (err) {
    logger.error(`${SCRIPT_TAG} Erro durante a normalização:`, err);
  } finally {
    await mongoose.disconnect();
  }
}

normalizeFormats();
