/**
 * @fileoverview Normalize format field based on metric.type for API-sourced posts.
 * @description Removes unsupported legacy format values and sets a deterministic canonical format
 * using the metric.type when available.
 *
 * @run `npm run normalize-format`
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';
import { logger } from '@/app/lib/logger';

const SCRIPT_TAG = '[SCRIPT_NORMALIZE_FORMAT]';

const mapTypeToFormat = (type?: string | null): string | null => {
  switch (type) {
    case 'REEL':
    case 'VIDEO':
      return 'reel';
    case 'IMAGE':
      return 'photo';
    case 'CAROUSEL_ALBUM':
      return 'carousel';
    default:
      return null;
  }
};

async function normalizeFormatFromMetricType() {
  logger.info(`${SCRIPT_TAG} Starting format normalization...`);

  try {
    await connectToDatabase();
    logger.info(`${SCRIPT_TAG} Database connection established.`);

    const cursor = Metric.find({
      format: { $in: ['Story', 'Live', 'story', 'live'] },
    })
      .select('_id format type')
      .cursor();

    let updated = 0;
    for await (const metric of cursor) {
      const current = Array.isArray(metric.format) ? metric.format : [];
      const withoutUnsupported = current.filter((f) => !['Story', 'Live', 'story', 'live'].includes(f));
      const mapped = mapTypeToFormat(metric.type);
      const nextFormat =
        withoutUnsupported.length > 0 ? withoutUnsupported : mapped ? [mapped] : [];

      const changed =
        nextFormat.length !== current.length ||
        nextFormat.some((value, idx) => value !== current[idx]);

      if (changed) {
        await Metric.updateOne({ _id: metric._id }, { $set: { format: nextFormat } });
        updated += 1;
      }
    }

    logger.info(`${SCRIPT_TAG} Done. ${updated} documents updated.`);
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Critical error during normalization:`, error);
  } finally {
    await mongoose.disconnect();
    logger.info(`${SCRIPT_TAG} Database connection closed.`);
  }
}

normalizeFormatFromMetricType();
