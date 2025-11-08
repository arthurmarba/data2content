import { connectToDatabase } from '@/app/lib/mongoose';
import Redemption from '@/app/models/Redemption';
import { logger } from '@/app/lib/logger';

(async () => {
  try {
    await connectToDatabase();

    const result = await Redemption.updateMany(
      { status: 'processing' },
      { $set: { status: 'requested' } },
    );

    logger.info('[migrateRedemptionStatuses] updated documents', {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });

    const dangling = await Redemption.countDocuments({
      status: { $nin: ['requested', 'paid', 'rejected'] },
    });
    if (dangling > 0) {
      logger.warn(
        '[migrateRedemptionStatuses] Found redemptions with unexpected status after migration',
        { dangling },
      );
    }

    logger.info('[migrateRedemptionStatuses] migration complete');
    process.exit(0);
  } catch (err) {
    logger.error('[migrateRedemptionStatuses] migration failed', err);
    process.exit(1);
  }
})();
