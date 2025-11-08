import { connectToDatabase } from '@/app/lib/mongoose';
import AffiliateRefundProgress from '@/app/models/AffiliateRefundProgress';
import { logger } from '@/app/lib/logger';

(async () => {
  try {
    await connectToDatabase();

    const collection = AffiliateRefundProgress.collection;
    const indexes = await collection.indexes();
    const legacyIndex = indexes.find(
      (idx) =>
        idx.key &&
        idx.key.invoiceId === 1 &&
        Object.keys(idx.key).length === 1 &&
        idx.name !== 'invoiceId_1_affiliateUserId_1',
    );

    if (legacyIndex) {
      logger.info('[fixAffiliateRefundProgressIndex] dropping legacy index', {
        name: legacyIndex.name,
      });
      await collection.dropIndex(legacyIndex.name);
    }

    logger.info('[fixAffiliateRefundProgressIndex] ensuring compound index');
    await collection.createIndex({ invoiceId: 1, affiliateUserId: 1 }, { unique: true, name: 'invoiceId_1_affiliateUserId_1' });

    logger.info('[fixAffiliateRefundProgressIndex] done');
    process.exit(0);
  } catch (err) {
    logger.error('[fixAffiliateRefundProgressIndex] failed', err);
    process.exit(1);
  }
})();
