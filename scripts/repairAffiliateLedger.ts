import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import AffiliateMigrationAudit from '@/app/models/AffiliateMigrationAudit';
import { AffiliateBuyerCommissionIndex } from '@/server/db/models/AffiliateIndexes';
import { buildAffiliateRepairPlan } from '@/server/affiliate/repair';
import { normalizedBalanceMap } from '@/server/affiliate/ledger';

const apply = process.argv.includes('--apply');

async function main() {
  await connectToDatabase();
  await AffiliateBuyerCommissionIndex.createIndexes();
  const users = await User.find({ 'commissionLog.0': { $exists: true } });
  const report: Array<Record<string, unknown>> = [];
  let applied = 0;

  for (const user of users) {
    const plan = buildAffiliateRepairPlan(user.commissionLog as any, user.affiliateBalances as any);
    const hasPaidCommission = (user.commissionLog || []).some(
      (entry: any) => entry.type === 'commission' && entry.status === 'paid',
    );
    const needsAction = plan.cancelPendingEntryIds.length > 0 || plan.balanceChanged;
    if (!needsAction && !apply) continue;

    const record = {
      userId: String(user._id),
      name: user.name,
      cancelPendingEntries: plan.cancelPendingEntryIds.length,
      balanceBefore: normalizedBalanceMap(user.affiliateBalances as any),
      balanceAfter: plan.nextBalances,
      requiresManualReview: plan.requiresManualReview || hasPaidCommission,
      warnings: plan.warnings,
    };
    report.push(record);

    if (!apply || plan.requiresManualReview || hasPaidCommission) continue;

    const now = new Date();
    if (needsAction) {
      for (const entry of user.commissionLog || []) {
        if (plan.cancelPendingEntryIds.some((id) => String(id) === String((entry as any)._id))) {
          (entry as any).status = 'canceled';
          (entry as any).reasonCode = 'duplicate_renewal_commission';
          (entry as any).note = 'Canceled by affiliate ledger repair: renewal after first commission.';
          (entry as any).updatedAt = now;
        }
      }
      user.affiliateBalances = new Map(Object.entries(plan.nextBalances));
      user.markModified('commissionLog');
      user.markModified('affiliateBalances');
      await user.save();

      await new AffiliateMigrationAudit({
        userId: user._id,
        step: 'repair_affiliate_ledger',
        before: { balances: record.balanceBefore },
        after: { balances: plan.nextBalances },
        deltas: Object.fromEntries(
          Array.from(new Set([...Object.keys(record.balanceBefore), ...Object.keys(plan.nextBalances)])).map((currency) => [
            currency,
            (plan.nextBalances[currency] || 0) - (record.balanceBefore[currency] || 0),
          ]),
        ),
        warnings: plan.warnings,
        at: now,
      }).save();
      applied++;
    }

    for (const entry of plan.firstCommissionEntries) {
      await AffiliateBuyerCommissionIndex.updateOne(
        { buyerUserId: entry.buyerUserId },
        {
          $setOnInsert: {
            buyerUserId: entry.buyerUserId,
            affiliateUserId: user._id,
            invoiceId: (entry as any).invoiceId || '',
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates: report.length, applied, report }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[repairAffiliateLedger] failed', error);
  await mongoose.disconnect();
  process.exit(1);
});
