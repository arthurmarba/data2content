import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';

const apply = process.argv.includes('--apply');

async function duplicateGroups(collection: any, key: string, match: Record<string, unknown>) {
  return collection
    .aggregate([
      { $match: match },
      { $group: { _id: `$${key}`, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
      { $limit: 50 },
    ])
    .toArray();
}

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection unavailable');

  const users = db.collection('users');
  const redemptions = db.collection('redemptions');
  const buyerCommissionIndexes = db.collection('affiliatebuyercommissionindexes');
  const duplicateTransfers = await duplicateGroups(redemptions, 'transferId', {
    transferId: { $type: 'string' },
  });
  const duplicateIdempotencyKeys = await duplicateGroups(redemptions, 'idempotencyKey', {
    idempotencyKey: { $type: 'string' },
  });
  const duplicateActiveRequests = await redemptions
    .aggregate([
      { $match: { status: 'requested' } },
      {
        $group: {
          _id: { userId: '$userId', currency: { $toLower: '$currency' } },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 50 },
    ])
    .toArray();

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    affiliatesMissingStatus: await users.countDocuments({
      affiliateCode: { $type: 'string' },
      affiliateStatus: { $exists: false },
    }),
    redemptionsWithNullTransfer: await redemptions.countDocuments({ transferId: null }),
    requestedWithoutIdempotencyKey: await redemptions.countDocuments({
      status: 'requested',
      idempotencyKey: { $exists: false },
    }),
    duplicateTransfers,
    duplicateIdempotencyKeys,
    duplicateActiveRequests,
  };

  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (
    duplicateTransfers.length > 0 ||
    duplicateIdempotencyKeys.length > 0 ||
    duplicateActiveRequests.length > 0
  ) {
    throw new Error('Duplicate financial records found; resolve the groups in the report before --apply.');
  }

  await users.updateMany(
    { affiliateCode: { $type: 'string' }, affiliateStatus: { $exists: false } },
    [{
      $set: {
        affiliateStatus: 'active',
        affiliateSince: { $ifNull: ['$affiliateSince', '$createdAt'] },
      },
    }],
  );
  await redemptions.updateMany({ transferId: null }, { $unset: { transferId: '' } });
  await redemptions.updateMany(
    { status: 'requested', idempotencyKey: { $exists: false } },
    [{ $set: { idempotencyKey: { $concat: ['redeem:', { $toString: '$_id' }] } } }],
  );

  const buyerOps: any[] = [];
  for await (const index of buyerCommissionIndexes.find(
    {},
    { projection: { buyerUserId: 1, createdAt: 1 } },
  )) {
    buyerOps.push({
      updateOne: {
        filter: { _id: index.buyerUserId, affiliateFirstCommissionAt: null },
        update: { $set: { affiliateFirstCommissionAt: index.createdAt || new Date() } },
      },
    });
    if (buyerOps.length === 500) {
      await users.bulkWrite(buyerOps, { ordered: false });
      buyerOps.length = 0;
    }
  }
  if (buyerOps.length) await users.bulkWrite(buyerOps, { ordered: false });

  const existingIndexes = await redemptions.indexes();
  for (const index of existingIndexes) {
    const keys = Object.keys(index.key || {});
    if (
      !index.unique &&
      keys.length === 1 &&
      (keys[0] === 'transferId' || keys[0] === 'idempotencyKey')
    ) {
      await redemptions.dropIndex(index.name!);
    }
  }

  await redemptions.createIndex(
    { idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      name: 'uniq_redemption_idempotency',
    },
  );
  await redemptions.createIndex(
    { transferId: 1 },
    {
      unique: true,
      partialFilterExpression: { transferId: { $type: 'string' } },
      name: 'uniq_redemption_transfer',
    },
  );
  await redemptions.createIndex(
    { userId: 1, currency: 1, status: 1 },
    {
      unique: true,
      partialFilterExpression: { status: 'requested' },
      name: 'uniq_active_redemption',
    },
  );

  console.log(JSON.stringify({ ...report, applied: true }, null, 2));
}

main()
  .catch((error) => {
    console.error('[migrateAffiliateFinancialSafety] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
