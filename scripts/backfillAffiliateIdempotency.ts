import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import AffiliateInvoiceIndex from "@/app/models/AffiliateInvoiceIndex";
import AffiliateSubscriptionIndex from "@/app/models/AffiliateSubscriptionIndex";
import { logger } from "@/app/lib/logger";

(async () => {
  try {
    await connectToDatabase();

    const invoiceCursor = User.aggregate([
      { $unwind: "$commissionLog" },
      {
        $project: {
          invoiceId: {
            $ifNull: ["$commissionLog.invoiceId", "$commissionLog.sourcePaymentId"],
          },
          affiliateUserId: "$_id",
          createdAt: { $ifNull: ["$commissionLog.date", new Date()] },
        },
      },
      { $match: { invoiceId: { $exists: true } } },
    ]).cursor({ batchSize: 50 }).exec();

    for await (const doc of invoiceCursor) {
      try {
        await AffiliateInvoiceIndex.create(doc);
      } catch (e: any) {
        if (e.code !== 11000)
          logger.error("[backfill] invoice index insert failed", e);
      }
    }

    const subCursor = User.aggregate([
      { $unwind: "$commissionLog" },
      { $match: { "commissionLog.subscriptionId": { $exists: true } } },
      {
        $project: {
          subscriptionId: "$commissionLog.subscriptionId",
          affiliateUserId: "$_id",
          createdAt: { $ifNull: ["$commissionLog.date", new Date()] },
        },
      },
    ]).cursor({ batchSize: 50 }).exec();

    for await (const doc of subCursor) {
      try {
        await AffiliateSubscriptionIndex.create(doc);
      } catch (e: any) {
        if (e.code !== 11000)
          logger.error("[backfill] subscription index insert failed", e);
      }
    }

    logger.info("[backfill] Affiliate idempotency indices populated.");
    process.exit(0);
  } catch (e) {
    logger.error("[backfill] failure", e);
    process.exit(1);
  }
})();
