import mongoose from 'mongoose';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import User from '@/app/models/User';
import AffiliateInvoiceIndex from '@/app/models/AffiliateInvoiceIndex';
import AffiliateSubscriptionIndex from '@/app/models/AffiliateSubscriptionIndex';
import AffiliateMigrationAudit from '@/app/models/AffiliateMigrationAudit';
import { normCur } from '@/utils/normCur';

const statusMap: Record<string, string> = {
  accrued: 'available',
  paid: 'paid',
  failed: 'canceled',
  fallback: 'available',
};

const normalizeLedger = async () => {
  const users = await User.find({});
  let touched = 0;
  for (const u of users) {
    let changed = false;
    for (const e of (u as any).commissionLog || []) {
      let entryChanged = false;
      const cur = normCur(e.currency);
      if (e.currency !== cur) {
        e.currency = cur;
        entryChanged = true;
      }
      const amt = Math.round(e.amountCents || 0);
      if (e.amountCents !== amt) {
        e.amountCents = amt;
        entryChanged = true;
      }
      if (!e.type) {
        e.type = 'commission';
        entryChanged = true;
      }
      if (!e.status || !['pending','available','paid','canceled','reversed'].includes(e.status)) {
        e.status = statusMap[e.status as string] || 'available';
        entryChanged = true;
      }
      if (!e.affiliateUserId) {
        e.affiliateUserId = u._id;
        entryChanged = true;
      }
      if (e.status === 'pending' && !e.availableAt) {
        e.availableAt = e.createdAt || new Date();
        entryChanged = true;
      }
      if (!e.createdAt) {
        e.createdAt = new Date();
        entryChanged = true;
      }
      if (entryChanged) {
        e.updatedAt = new Date();
        changed = true;
      }
    }
    if (changed) {
      (u as any).markModified('commissionLog');
      await u.save();
      touched++;
      await AffiliateMigrationAudit.create({
        userId: u._id,
        step: 'normalize_ledger',
        at: new Date(),
      });
    }
  }
  logger.info(`[migrate-affiliates] normalize ledger touched ${touched} users`);
};

const backfillIndexes = async () => {
  const invoiceCursor = User.aggregate([
    { $unwind: '$commissionLog' },
    { $project: {
        invoiceId: '$commissionLog.invoiceId',
        affiliateUserId: '$_id',
        createdAt: { $ifNull: ['$commissionLog.createdAt', new Date()] },
      } },
    { $match: { invoiceId: { $exists: true } } }
  ]).cursor({ batchSize: 50 }).exec();

  for await (const doc of invoiceCursor) {
    try {
      await AffiliateInvoiceIndex.create(doc);
    } catch (e: any) {
      if (e.code !== 11000) logger.error('[migrate-affiliates] invoice index insert failed', e);
    }
  }

  const subCursor = User.aggregate([
    { $unwind: '$commissionLog' },
    { $match: { 'commissionLog.subscriptionId': { $exists: true } } },
    { $project: {
        subscriptionId: '$commissionLog.subscriptionId',
        affiliateUserId: '$_id',
        createdAt: { $ifNull: ['$commissionLog.createdAt', new Date()] },
      } }
  ]).cursor({ batchSize: 50 }).exec();

  for await (const doc of subCursor) {
    try {
      await AffiliateSubscriptionIndex.create(doc);
    } catch (e: any) {
      if (e.code !== 11000) logger.error('[migrate-affiliates] subscription index insert failed', e);
    }
  }
  logger.info('[migrate-affiliates] backfill indexes complete');
};

const recomputeBalancesAndDebt = async () => {
  const users = await User.find({});
  for (const u of users) {
    const beforeBalances: Record<string, number> = Object.fromEntries((u.affiliateBalances || new Map()).entries());
    const beforeDebt: Record<string, number> = Object.fromEntries((u.affiliateDebtByCurrency || new Map()).entries());
    const warnings: string[] = [];

    const sumBy = (pred: (e: any) => boolean) => {
      const res: Record<string, number> = {};
      for (const e of (u as any).commissionLog || []) {
        if (pred(e)) {
          const cur = normCur(e.currency);
          res[cur] = (res[cur] || 0) + e.amountCents;
        }
      }
      return res;
    };

    const sumAvail = sumBy(e => e.type === 'commission' && e.status === 'available');
    const sumAdjAva = sumBy(e => e.type === 'adjustment' && e.status === 'available');
    const sumAdjRev = sumBy(e => e.type === 'adjustment' && e.status === 'reversed');
    const sumRedeem = sumBy(e => e.type === 'redeem' && e.status === 'paid');

    const balances: Record<string, number> = {};
    const currencies = new Set([
      ...Object.keys(sumAvail),
      ...Object.keys(sumAdjAva),
      ...Object.keys(sumAdjRev),
      ...Object.keys(sumRedeem),
    ]);
    for (const cur of currencies) {
      balances[cur] =
        (sumAvail[cur] || 0) +
        (sumAdjAva[cur] || 0) +
        (sumAdjRev[cur] || 0) +
        (sumRedeem[cur] || 0);
    }

    const debt: Record<string, number> = {};
    for (const e of (u as any).commissionLog || []) {
      if (e.type === 'adjustment' && e.status === 'reversed') {
        const cur = normCur(e.currency);
        debt[cur] = (debt[cur] || 0) + Math.abs(e.amountCents);
      }
    }

    for (const cur of Object.keys(balances)) {
      if (balances[cur] < 0) {
        const diff = -balances[cur];
        balances[cur] = 0;
        debt[cur] = (debt[cur] || 0) + diff;
        warnings.push('negative_balance_clamped');
      }
    }

    u.affiliateBalances = new Map(Object.entries(balances));
    u.affiliateDebtByCurrency = new Map(Object.entries(debt));
    u.markModified('affiliateBalances');
    u.markModified('affiliateDebtByCurrency');
    await u.save();

    const deltas: Record<string, number> = {};
    const allCurrencies = new Set([
      ...Object.keys(beforeBalances),
      ...Object.keys(balances),
    ]);
    for (const cur of allCurrencies) {
      deltas[cur] = (balances[cur] || 0) - (beforeBalances[cur] || 0);
    }

    await AffiliateMigrationAudit.create({
      userId: u._id,
      step: 'recompute_balance',
      before: { balances: beforeBalances, debt: beforeDebt },
      after: { balances, debt },
      deltas,
      warnings,
      at: new Date(),
    });
  }
  logger.info('[migrate-affiliates] recompute balances complete');
};

async function main() {
  const argv = yargs(hideBin(process.argv)).argv as any;
  await connectToDatabase();
  const steps = argv.step ? (argv.step as string).split(',') : ['normalize','backfill','recompute'];
  for (const s of steps) {
    logger.info(`[migrate-affiliates] step: ${s}`);
    if (s === 'normalize') await normalizeLedger();
    if (s === 'backfill') await backfillIndexes();
    if (s === 'recompute') await recomputeBalancesAndDebt();
  }
  await mongoose.disconnect();
}

main().catch(err => {
  logger.error('[migrate-affiliates] failure', err);
  process.exit(1);
});

