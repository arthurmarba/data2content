/**
 * @fileoverview Script to reset failed classification status for posts.
 * @description Resets only metrics with classificationStatus "failed" back to "pending",
 * clearing classification fields so they can be reprocessed.
 *
 * @run `npm run reset-classification-failed`
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';
import { logger } from '@/app/lib/logger';

const SCRIPT_TAG = '[SCRIPT_RESET_FAILED_STATUS]';

async function resetFailedClassificationStatus() {
  logger.info(`${SCRIPT_TAG} Starting reset for failed classifications...`);

  try {
    await connectToDatabase();
    logger.info(`${SCRIPT_TAG} Database connection established.`);

    const metricsToReset = await Metric.find({
      classificationStatus: 'failed',
      description: { $exists: true, $ne: '' },
    })
      .select('_id')
      .lean();

    if (metricsToReset.length === 0) {
      logger.info(`${SCRIPT_TAG} No failed posts found to reset. Exiting.`);
      return;
    }

    const metricIdsToReset = metricsToReset.map((metric) => metric._id);
    logger.info(`${SCRIPT_TAG} ${metricIdsToReset.length} posts will be reset to pending.`);

    const updateResult = await Metric.updateMany(
      { _id: { $in: metricIdsToReset } },
      {
        $set: {
          classificationStatus: 'pending',
          classificationError: null,
          format: [],
          proposal: [],
          context: [],
          tone: [],
          references: [],
        },
      }
    );

    logger.info(`${SCRIPT_TAG} Done. ${updateResult.modifiedCount} documents updated.`);
  } catch (error) {
    logger.error(`${SCRIPT_TAG} Critical error during reset:`, error);
  } finally {
    await mongoose.disconnect();
    logger.info(`${SCRIPT_TAG} Database connection closed.`);
  }
}

resetFailedClassificationStatus();
