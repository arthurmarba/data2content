import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';

function objectNumbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, amount]) => [
      key.toLowerCase(),
      Math.trunc(Number(amount) || 0),
    ]),
  );
}

function ledgerAvailable(entries: any[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of entries || []) {
    const currency = String(entry.currency || 'brl').toLowerCase();
    const amount = Math.trunc(Number(entry.amountCents) || 0);
    if (entry.type === 'commission' && entry.status === 'available') {
      result[currency] = (result[currency] || 0) + amount;
    } else if (
      entry.type === 'adjustment' &&
      (entry.status === 'available' || entry.status === 'reversed')
    ) {
      result[currency] = (result[currency] || 0) + amount;
    } else if (entry.type === 'redeem' && entry.status === 'paid') {
      result[currency] = (result[currency] || 0) - Math.abs(amount);
    }
  }
  return Object.fromEntries(
    Object.entries(result).map(([currency, amount]) => [currency, Math.max(amount, 0)]),
  );
}

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection unavailable');
  const users = db.collection('users');
  const redemptions = db.collection('redemptions');
  const refundProgress = db.collection('affiliaterefundprogresses');

  const reservedByUser = new Map<string, Record<string, number>>();
  for await (const redemption of redemptions.find(
    { status: 'requested', balanceReservedAt: { $type: 'date' } },
    { projection: { userId: 1, currency: 1, amountCents: 1 } },
  )) {
    const userId = String(redemption.userId);
    const currency = String(redemption.currency || '').toLowerCase();
    const byCurrency = reservedByUser.get(userId) || {};
    byCurrency[currency] = (byCurrency[currency] || 0) + Number(redemption.amountCents || 0);
    reservedByUser.set(userId, byCurrency);
  }

  let usersWithLedger = 0;
  let balanceMismatches = 0;
  let invalidPendingEntries = 0;
  for await (const user of users.find(
    { 'commissionLog.0': { $exists: true } },
    { projection: { affiliateBalances: 1, commissionLog: 1 } },
  )) {
    usersWithLedger++;
    const stored = objectNumbers(user.affiliateBalances);
    const ledger = ledgerAvailable(user.commissionLog || []);
    const reserved = reservedByUser.get(String(user._id)) || {};
    const currencies = new Set([
      ...Object.keys(stored),
      ...Object.keys(ledger),
      ...Object.keys(reserved),
    ]);
    if (
      [...currencies].some(
        (currency) =>
          (stored[currency] || 0) !==
          Math.max((ledger[currency] || 0) - (reserved[currency] || 0), 0),
      )
    ) {
      balanceMismatches++;
    }
    invalidPendingEntries += (user.commissionLog || []).filter(
      (entry: any) =>
        entry.status === 'pending' &&
        (
          entry.type !== 'commission' ||
          !Number.isSafeInteger(entry.amountCents) ||
          entry.amountCents <= 0 ||
          !/^[a-z]{3}$/i.test(String(entry.currency || ''))
        ),
    ).length;
  }

  const now = Date.now();
  const attributionHealth = await users.aggregate([
    { $match: { affiliateUsed: { $type: 'string' } } },
    {
      $lookup: {
        from: 'users',
        localField: 'affiliateUsed',
        foreignField: 'affiliateCode',
        as: 'affiliateOwner',
      },
    },
    {
      $match: {
        $or: [
          { affiliateOwner: { $size: 0 } },
          { 'affiliateOwner.0.affiliateStatus': { $in: ['inactive', 'suspended'] } },
        ],
      },
    },
    {
      $lookup: {
        from: 'affiliatebuyercommissionindexes',
        localField: '_id',
        foreignField: 'buyerUserId',
        as: 'commissionIndex',
      },
    },
    {
      $project: {
        reason: {
          $cond: [{ $eq: [{ $size: '$affiliateOwner' }, 0] }, 'owner_missing', 'owner_inactive'],
        },
        consumed: {
          $or: [
            { $ne: [{ $ifNull: ['$affiliateFirstCommissionAt', null] }, null] },
            { $gt: [{ $size: '$commissionIndex' }, 0] },
          ],
        },
      },
    },
    { $group: { _id: { reason: '$reason', consumed: '$consumed' }, count: { $sum: 1 } } },
  ]).toArray();
  const report = {
    usersWithLedger,
    balanceMismatches,
    invalidPendingEntries,
    requestedRedemptionsOlderThan15Minutes: await redemptions.countDocuments({
      status: 'requested',
      createdAt: { $lt: new Date(now - 15 * 60 * 1000) },
    }),
    paidRedemptionsWithoutTransactionReference: await redemptions.countDocuments({
      status: 'paid',
      $and: [
        { $or: [{ transferId: { $exists: false } }, { transferId: null }, { transferId: '' }] },
        { $or: [{ transactionId: { $exists: false } }, { transactionId: null }, { transactionId: '' }] },
      ],
    }),
    refundProgressMissingCommissionTotal: await refundProgress.countDocuments({
      refundedPaidCentsTotal: { $gt: 0 },
      reversedCommissionCentsTotal: { $exists: false },
    }),
    duplicatedConnectAccounts: (await users.aggregate([
      { $match: { 'paymentInfo.stripeAccountId': { $type: 'string' } } },
      { $group: { _id: '$paymentInfo.stripeAccountId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'count' },
    ]).toArray())[0]?.count || 0,
    invalidAffiliateAttributions: attributionHealth.reduce((sum, item) => sum + item.count, 0),
    invalidAffiliateAttributionBreakdown: attributionHealth.map((item) => ({
      reason: item._id.reason,
      commissionConsumed: item._id.consumed,
      count: item.count,
    })),
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error('[auditAffiliateFinancialIntegrity] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
