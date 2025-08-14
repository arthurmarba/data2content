// ./scripts/migrate-affiliates.ts

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

      // moeda normalizada (lowercase)
      const cur = normCur(e.currency);
      if (e.currency !== cur) {
        e.currency = cur;
        entryChanged = true;
      }

      // valores sempre inteiros em cents
      const amt = Math.round(e.amountCents || 0);
      if (e.amountCents !== amt) {
        e.amountCents = amt;
        entryChanged = true;
      }

      // tipos e status válidos
      if (!e.type) {
        e.type = 'commission';
        entryChanged = true;
      }
      if (!e.status || !['pending', 'available', 'paid', 'canceled', 'reversed'].includes(e.status)) {
        e.status = statusMap[e.status as string] || 'available';
        entryChanged = true;
      }

      // affiliateUserId sempre presente
      if (!e.affiliateUserId) {
        e.affiliateUserId = u._id;
        entryChanged = true;
      }

      // pending precisa de availableAt
      if (e.status === 'pending' && !e.availableAt) {
        e.availableAt = e.createdAt || new Date();
        entryChanged = true;
      }

      // timestamps
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

      // usar new ... .save() (evita overloads de create)
      await new AffiliateMigrationAudit({
        userId: u._id,
        step: 'normalize_ledger',
        at: new Date(),
      }).save();
    }
  }

  logger.info(`[migrate-affiliates] normalize ledger touched ${touched} users`);
};

const backfillIndexes = async () => {
  // -------- AffiliateInvoiceIndex (invoiceId + affiliateUserId) --------
  const invoiceCursor = User.aggregate([
    { $unwind: '$commissionLog' },
    {
      $project: {
        invoiceId: '$commissionLog.invoiceId',
        affiliateUserId: '$_id',
        createdAt: { $ifNull: ['$commissionLog.createdAt', new Date()] },
      },
    },
    { $match: { invoiceId: { $exists: true } } },
  ])
    .allowDiskUse(true)
    .cursor({ batchSize: 50 }) as AsyncIterable<any>; // sem .exec()

  for await (const doc of invoiceCursor) {
    try {
      // upsert idempotente evita E11000
      await AffiliateInvoiceIndex.updateOne(
        { invoiceId: doc.invoiceId, affiliateUserId: doc.affiliateUserId },
        {
          $setOnInsert: {
            invoiceId: doc.invoiceId,
            affiliateUserId: doc.affiliateUserId,
            createdAt: doc.createdAt ?? new Date(),
          },
        },
        { upsert: true }
      );
    } catch (e: any) {
      logger.error('[migrate-affiliates] invoice index upsert failed', e);
    }
  }

  // -------- AffiliateSubscriptionIndex (subscriptionId + affiliateUserId) --------
  const subCursor = User.aggregate([
    { $unwind: '$commissionLog' },
    { $match: { 'commissionLog.subscriptionId': { $exists: true } } },
    {
      $project: {
        subscriptionId: '$commissionLog.subscriptionId',
        affiliateUserId: '$_id',
        createdAt: { $ifNull: ['$commissionLog.createdAt', new Date()] },
      },
    },
    // Se quiser garantir 1 por (sub, aff) aqui, pode agrupar:
    // { $group: { _id: { sub: '$subscriptionId', aff: '$affiliateUserId' }, createdAt: { $min: '$createdAt' } } },
    // { $project: { subscriptionId: '$_id.sub', affiliateUserId: '$_id.aff', createdAt: 1, _id: 0 } },
  ])
    .allowDiskUse(true)
    .cursor({ batchSize: 50 }) as AsyncIterable<any>; // sem .exec()

  for await (const doc of subCursor) {
    try {
      await AffiliateSubscriptionIndex.updateOne(
        { subscriptionId: doc.subscriptionId, affiliateUserId: doc.affiliateUserId },
        {
          $setOnInsert: {
            subscriptionId: doc.subscriptionId,
            affiliateUserId: doc.affiliateUserId,
            createdAt: doc.createdAt ?? new Date(),
          },
        },
        { upsert: true }
      );
    } catch (e: any) {
      logger.error('[migrate-affiliates] subscription index upsert failed', e);
    }
  }

  logger.info('[migrate-affiliates] backfill indexes complete');
};

const recomputeBalancesAndDebt = async () => {
  const users = await User.find({});

  for (const u of users) {
    const beforeBalances: Record<string, number> = Object.fromEntries(
      (u.affiliateBalances || new Map()).entries()
    );
    const beforeDebt: Record<string, number> = Object.fromEntries(
      (u.affiliateDebtByCurrency || new Map()).entries()
    );
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

    const sumAvail = sumBy((e) => e.type === 'commission' && e.status === 'available');
    const sumAdjAva = sumBy((e) => e.type === 'adjustment' && e.status === 'available');
    const sumAdjRev = sumBy((e) => e.type === 'adjustment' && e.status === 'reversed');
    const sumRedeem = sumBy((e) => e.type === 'redeem' && e.status === 'paid');

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

    // dívida = soma absoluta dos adjustments 'reversed' (refund pós-pago)
    const debt: Record<string, number> = {};
    for (const e of (u as any).commissionLog || []) {
      if (e.type === 'adjustment' && e.status === 'reversed') {
        const cur = normCur(e.currency);
        debt[cur] = (debt[cur] || 0) + Math.abs(e.amountCents);
      }
    }

    // impedir saldo negativo → mover diferença para dívida (política clamp)
for (const cur of Object.keys(balances)) {
  const val = balances[cur] ?? 0;           // <- normaliza para número
  if (val < 0) {
    const diff = -val;
    balances[cur] = 0;
    debt[cur] = (debt[cur] ?? 0) + diff;    // <- usa ?? para evitar undefined
    warnings.push('negative_balance_clamped');
  }
}

    u.affiliateBalances = new Map(Object.entries(balances));
    u.affiliateDebtByCurrency = new Map(Object.entries(debt));
    u.markModified('affiliateBalances');
    u.markModified('affiliateDebtByCurrency');
    await u.save();

    const deltas: Record<string, number> = {};
    const allCurrencies = new Set([...Object.keys(beforeBalances), ...Object.keys(balances)]);
    for (const cur of allCurrencies) {
      deltas[cur] = (balances[cur] || 0) - (beforeBalances[cur] || 0);
    }

    await new AffiliateMigrationAudit({
      userId: u._id,
      step: 'recompute_balance',
      before: { balances: beforeBalances, debt: beforeDebt },
      after: { balances, debt },
      deltas,
      warnings,
      at: new Date(),
    }).save();
  }

  logger.info('[migrate-affiliates] recompute balances complete');
};

async function main() {
  const argv = yargs(hideBin(process.argv)).argv as any;
  await connectToDatabase();

  const steps = argv.step ? (argv.step as string).split(',') : ['normalize', 'backfill', 'recompute'];
  for (const s of steps) {
    logger.info(`[migrate-affiliates] step: ${s}`);
    if (s === 'normalize') await normalizeLedger();
    if (s === 'backfill') await backfillIndexes();
    if (s === 'recompute') await recomputeBalancesAndDebt();
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error('[migrate-affiliates] failure', err);
  process.exit(1);
});
