import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import {
  MATURATION_BATCH_USERS,
  MATURATION_MAX_ENTRIES_PER_USER,
  MATURATION_TIMEOUT_MS,
} from '@/config/affiliates';

interface MatureOptions {
  dryRun?: boolean;
  maxUsers?: number;
  maxEntriesPerUser?: number;
}

interface MatureResult {
  ok: boolean;
  dryRun: boolean;
  window: string;
  processedUsers: number;
  promotedCount: number;
  byCurrency: Record<string, number>;
  errors: number;
  durationMs: number;
  hasMore: boolean;
}

export async function matureAffiliateCommissions(
  opts: MatureOptions = {}
): Promise<MatureResult> {
  const TAG = '[affiliate:mature]';
  const dryRun = opts.dryRun ?? false;
  const maxUsers = opts.maxUsers ?? MATURATION_BATCH_USERS;
  const maxEntriesPerUser =
    opts.maxEntriesPerUser ?? MATURATION_MAX_ENTRIES_PER_USER;
  const start = Date.now();
  const nowUtc = new Date();

  await connectToDatabase();

  const query = {
    commissionLog: {
      $elemMatch: { status: 'pending', availableAt: { $lte: nowUtc } },
    },
  };
  const projection = {
    commissionLog: 1,
    affiliateBalances: 1,
  };

  const users = await User.find(query, projection).limit(maxUsers).lean();

  let processedUsers = 0;
  let promotedCount = 0;
  const byCurrency: Record<string, number> = {};
  let errors = 0;

  for (const u of users) {
    processedUsers++;
    const due = (u.commissionLog || [])
      .filter(
        (e: any) =>
          e.status === 'pending' && new Date(e.availableAt) <= nowUtc
      )
      .slice(0, maxEntriesPerUser);

    for (const e of due) {
      if (Date.now() - start > MATURATION_TIMEOUT_MS) {
        logger.warn(`${TAG} timeout`);
        return {
          ok: true,
          dryRun,
          window: nowUtc.toISOString(),
          processedUsers,
          promotedCount,
          byCurrency,
          errors,
          durationMs: Date.now() - start,
          hasMore: true,
        };
      }

      if (dryRun) {
        promotedCount++;
        byCurrency[e.currency] = (byCurrency[e.currency] || 0) + 1;
        continue;
      }

      try {
        const res = await User.updateOne(
          {
            _id: u._id,
            'commissionLog._id': e._id,
            'commissionLog.status': 'pending',
            'commissionLog.availableAt': { $lte: nowUtc },
          },
          {
            $set: {
              'commissionLog.$.status': 'available',
              'commissionLog.$.updatedAt': nowUtc,
            },
            $inc: { [`affiliateBalances.${e.currency}`]: e.amountCents },
          }
        );
        if (res.modifiedCount === 1) {
          promotedCount++;
          byCurrency[e.currency] = (byCurrency[e.currency] || 0) + 1;
          logger.info(`${TAG} promoted`, {
            userId: u._id,
            entryId: e._id,
            currency: e.currency,
            amountCents: e.amountCents,
          });
        } else {
          logger.warn(`${TAG} skip_concurrent`, {
            userId: u._id,
            entryId: e._id,
          });
        }
      } catch (err) {
        errors++;
        logger.error(`${TAG} error_update`, {
          userId: u._id,
          entryId: e._id,
          error: err,
        });
      }
    }
  }

  const remaining = await User.countDocuments(query);

  return {
    ok: true,
    dryRun,
    window: nowUtc.toISOString(),
    processedUsers,
    promotedCount,
    byCurrency,
    errors,
    durationMs: Date.now() - start,
    hasMore: remaining > 0,
  };
}

export default matureAffiliateCommissions;
