import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';

const apply = process.argv.includes('--apply');

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection unavailable');
  const users = db.collection('users');
  const buyerIndexes = db.collection('affiliatebuyercommissionindexes');

  const candidates = await users.aggregate([
    {
      $match: {
        affiliateUsed: { $type: 'string' },
        $or: [
          { affiliateFirstCommissionAt: { $exists: false } },
          { affiliateFirstCommissionAt: null },
        ],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'affiliateUsed',
        foreignField: 'affiliateCode',
        as: 'affiliateOwner',
      },
    },
    { $match: { affiliateOwner: { $size: 0 } } },
    { $project: { _id: 1, affiliateUsed: 1 } },
  ]).toArray();

  let repaired = 0;
  if (apply) {
    for (const candidate of candidates) {
      const consumed = await buyerIndexes.findOne({ buyerUserId: candidate._id });
      if (consumed) continue;
      const result = await users.updateOne(
        {
          _id: candidate._id,
          affiliateUsed: candidate.affiliateUsed,
          $or: [
            { affiliateFirstCommissionAt: { $exists: false } },
            { affiliateFirstCommissionAt: null },
          ],
        },
        { $unset: { affiliateUsed: '' } },
      );
      repaired += result.modifiedCount;
    }
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates: candidates.length, repaired }, null, 2));
}

main()
  .catch((error) => {
    console.error('[repairInvalidAffiliateAttributions] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
