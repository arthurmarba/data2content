import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';
import { logger } from '@/app/lib/logger';
import { formatCategories } from '@/app/lib/classification';

const SCRIPT_TAG = '[SCRIPT_FIX_FORMAT_LABELS]';

const ID_TO_LABEL_MAP = formatCategories.reduce<Record<string, string>>((acc, cat) => {
  acc[cat.id] = cat.label;
  return acc;
}, {});

async function normalizeFormats() {
  logger.info(`${SCRIPT_TAG} Iniciando normalização do campo 'format'...`);
  try {
    await connectToDatabase();

    const lowercaseIds = Object.keys(ID_TO_LABEL_MAP);
    const query = { format: { $elemMatch: { $in: lowercaseIds } } };

    const docs = await Metric.find(query).select('_id format');
    if (docs.length === 0) {
      logger.info(`${SCRIPT_TAG} Nenhum documento com formatos em minúsculo encontrado.`);
      return;
    }

    for (const doc of docs) {
      const currentFormats: string[] = Array.isArray(doc.format) ? doc.format : [];
      const newFormats = currentFormats.map(f => ID_TO_LABEL_MAP[f] || f);
      await Metric.updateOne({ _id: doc._id }, { $set: { format: newFormats } });
    }

    logger.info(`${SCRIPT_TAG} Normalização concluída para ${docs.length} documentos.`);
  } catch (err) {
    logger.error(`${SCRIPT_TAG} Erro durante a normalização:`, err);
  } finally {
    await mongoose.disconnect();
  }
}

normalizeFormats();
