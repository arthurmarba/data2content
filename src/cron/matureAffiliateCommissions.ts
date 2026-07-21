import { connectToDatabase } from '@/app/lib/mongoose';
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from '@/app/lib/mongoTransient';
import User from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { logAffiliateEvent, metrics } from '@/app/lib/telemetry';
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

  const query = {
    commissionLog: {
      $elemMatch: {
        type: 'commission',
        status: 'pending',
        amountCents: { $gt: 0 },
        currency: { $regex: /^[a-z]{3}$/i },
        availableAt: { $lte: nowUtc },
      },
    },
  };
  const projection = {
    commissionLog: 1,
    affiliateBalances: 1,
  };

  const users = await withMongoTransientRetry(
    async () => {
      await connectToDatabase();
      return User.find(query, projection).limit(maxUsers).lean();
    },
    {
      retries: 1,
      onRetry: (error, retryCount) => {
        logger.warn(`${TAG} transient_load_retry`, {
          retryCount,
          error: getErrorMessage(error),
        });
      },
    }
  );

  let processedUsers = 0;
  let promotedCount = 0;
  const byCurrency: Record<string, number> = {};
  let errors = 0;

  for (const u of users) {
    processedUsers++;
    const due = (u.commissionLog || [])
      .filter(
        (e: any) =>
          e.type === 'commission' &&
          e.status === 'pending' &&
          Number.isInteger(e.amountCents) &&
          e.amountCents > 0 &&
          /^[a-z]{3}$/i.test(String(e.currency || '')) &&
          new Date(e.availableAt) <= nowUtc
      )
      .slice(0, maxEntriesPerUser);

    for (const e of due) {
      const currency = String(e.currency).toLowerCase();
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
        byCurrency[currency] = (byCurrency[currency] || 0) + 1;
        continue;
      }

      try {
        const res = await withMongoTransientRetry(
          async () => {
            await connectToDatabase();
            return User.updateOne(
              {
                _id: u._id,
                commissionLog: {
                  $elemMatch: {
                    _id: e._id,
                    type: 'commission',
                    status: 'pending',
                    amountCents: e.amountCents,
                    currency: e.currency,
                    availableAt: { $lte: nowUtc },
                  },
                },
              },
              {
                $set: {
                  'commissionLog.$[entry].status': 'available',
                  'commissionLog.$[entry].maturedAt': nowUtc,
                  'commissionLog.$[entry].updatedAt': nowUtc,
                },
                $inc: { [`affiliateBalances.${currency}`]: e.amountCents },
              },
              {
                arrayFilters: [
                  {
                    'entry._id': e._id,
                    'entry.type': 'commission',
                    'entry.status': 'pending',
                    'entry.amountCents': e.amountCents,
                    'entry.currency': e.currency,
                    'entry.availableAt': { $lte: nowUtc },
                  },
                ],
              },
            );
          },
          {
            retries: 1,
            onRetry: (error, retryCount) => {
              logger.warn(`${TAG} transient_update_retry`, {
                userId: u._id,
                entryId: e._id,
                retryCount,
                error: getErrorMessage(error),
              });
            },
          }
        );
        if (res.modifiedCount === 1) {
          promotedCount++;
          byCurrency[currency] = (byCurrency[currency] || 0) + 1;
          logger.info(`${TAG} promoted`, {
            userId: u._id,
            entryId: e._id,
            currency,
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
        if (isTransientMongoError(err)) {
          logger.warn(`${TAG} transient_update_failed`, {
            userId: u._id,
            entryId: e._id,
            error: getErrorMessage(err),
          });
        } else {
          logger.error(`${TAG} error_update`, {
            userId: u._id,
            entryId: e._id,
            error: err,
          });
        }
      }
    }
  }

  const remaining = await withMongoTransientRetry(
    async () => {
      await connectToDatabase();
      return User.countDocuments(query);
    },
    {
      retries: 1,
      onRetry: (error, retryCount) => {
        logger.warn(`${TAG} transient_count_retry`, {
          retryCount,
          error: getErrorMessage(error),
        });
      },
    }
  );

  const result = {
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

  metrics.affiliates_mature_promoted_total.inc({ dryRun: String(dryRun) }, promotedCount);
  metrics.affiliates_mature_run_duration_ms.observe({ dryRun: String(dryRun) }, result.durationMs);
  metrics.affiliates_pending_count.set({}, remaining);
  logAffiliateEvent('affiliate_maturation_completed', {
    promotedCount,
    processedUsers,
    remainingDueEntries: remaining,
    errors,
    durationMs: result.durationMs,
    hasMore: result.hasMore,
  });
  if (remaining > 0 || errors > 0) {
    logger.warn(`${TAG} attention_required`, {
      remainingDueEntries: remaining,
      errors,
      durationMs: result.durationMs,
    });
  }

  return result;
}

export default matureAffiliateCommissions;
