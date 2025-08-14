import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import AffiliateInvoiceIndex from "@/app/models/AffiliateInvoiceIndex";
import AffiliateSubscriptionIndex from "@/app/models/AffiliateSubscriptionIndex";
import { logger } from "@/app/lib/logger";

(async () => {
  try {
    await connectToDatabase();

    // Cursor para invoices (sem .exec())
    const invoiceCursor = User.aggregate([
      { $unwind: "$commissionLog" },
      {
        $project: {
          invoiceId: "$commissionLog.invoiceId",
          affiliateUserId: "$_id",
          createdAt: { $ifNull: ["$commissionLog.createdAt", new Date()] },
        },
      },
      { $match: { invoiceId: { $exists: true } } },
    ])
      .allowDiskUse(true)
      .cursor({ batchSize: 50 });

    for await (const doc of invoiceCursor as AsyncIterable<any>) {
      try {
        await AffiliateInvoiceIndex.create(doc);
      } catch (e: any) {
        if (e?.code !== 11000) {
          logger.error("[backfill] invoice index insert failed", e);
        }
      }
    }

    // Cursor para subscriptions (sem .exec())
    const subCursor = User.aggregate([
      { $unwind: "$commissionLog" },
      { $match: { "commissionLog.subscriptionId": { $exists: true } } },
      {
        $project: {
          subscriptionId: "$commissionLog.subscriptionId",
          affiliateUserId: "$_id",
          createdAt: { $ifNull: ["$commissionLog.createdAt", new Date()] },
        },
      },
      // dica: se quiser reduzir colisões, pode agrupar para 1 registro por (sub, aff)
      // { $group: { _id: { sub: "$subscriptionId", aff: "$affiliateUserId" }, createdAt: { $min: "$createdAt" } } },
      // { $project: { subscriptionId: "$_id.sub", affiliateUserId: "$_id.aff", createdAt: 1, _id: 0 } },
    ])
      .allowDiskUse(true)
      .cursor({ batchSize: 50 });

    for await (const doc of subCursor as AsyncIterable<any>) {
      try {
        await AffiliateSubscriptionIndex.create(doc);
      } catch (e: any) {
        if (e?.code !== 11000) {
          logger.error("[backfill] subscription index insert failed", e);
        }
      }
    }

    logger.info("[backfill] Affiliate idempotency indices populated.");
    process.exit(0);
  } catch (e) {
    logger.error("[backfill] failure", e);
    process.exit(1);
  }
})();
