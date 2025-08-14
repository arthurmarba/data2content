import os from 'node:os';
import { connectMongo } from '@/server/db/connect';
import { User } from '@/server/db/models/User';
import { adjustBalance } from '@/server/affiliate/balance';
import { CronLock } from '@/server/db/models/CronLock';

export const runtime = 'nodejs';

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function acquireLock(name = 'affiliate-mature', ttlSec = 240) {
  const now = new Date();
  const expires = new Date(now.getTime() + ttlSec * 1000);
  const owner = os.hostname();

  const res = await CronLock.findOneAndUpdate(
    {
      _id: name,
      $or: [{ expiresAt: { $lte: now } }, { lockedAt: null }],
    },
    { $set: { lockedAt: now, expiresAt: expires, owner } },
    { upsert: true, new: true }
  );

  const has =
    !!res && res.owner === owner && res.expiresAt && res.expiresAt.getTime() === expires.getTime();
  return { has, owner };
}

/**
 * POST /api/internal/affiliate/mature
 * Headers:
 *   x-internal-secret: <INTERNAL_CRON_SECRET>
 * Body (opcional JSON):
 *   {
 *     "limit": number, // default 100 usuários por execução
 *     "maxItemsPerUser": number, // default 20 items por user
 *     "dryRun": boolean // se true, NÃO persiste
 *   }
 */
export async function POST(req: Request) {
  const token = req.headers.get('x-internal-secret');
  if (token !== process.env.INTERNAL_CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  await connectMongo();

  const { has } = await acquireLock('affiliate-mature', 240);
  if (!has) return new Response(JSON.stringify({ ok: false, reason: 'locked' }), { status: 409 });

  const { limit = 100, maxItemsPerUser = 20, dryRun = false } = await safeJson(req);

  const now = new Date();
  const users = await User.find({
    commissionLog: {
      $elemMatch: { type: 'commission', status: 'pending', availableAt: { $lte: now } },
    },
  })
    .select({ commissionLog: 1, affiliateBalances: 1 })
    .limit(Math.max(1, Math.min(500, Number(limit))))
    .lean(false);

  let maturedUsers = 0;
  let maturedEntries = 0;

  for (const u of users) {
    let changed = false;
    let countThisUser = 0;

    for (const e of u.commissionLog ?? []) {
      if (countThisUser >= maxItemsPerUser) break;

      if (
        e?.type === 'commission' &&
        e.status === 'pending' &&
        e.availableAt &&
        e.availableAt <= now &&
        typeof e.amountCents === 'number' &&
        e.amountCents > 0
      ) {
        if (!dryRun) {
          await adjustBalance(u as any, e.currency, e.amountCents);
          e.status = 'available';
          e.maturedAt = new Date();
        }
        changed = true;
        maturedEntries++;
        countThisUser++;
      }
    }

    if (changed && !dryRun) {
      await u.save();
      maturedUsers++;
    }
  }

  return Response.json({
    ok: true,
    dryRun,
    processedUsers: users.length,
    maturedUsers,
    maturedEntries,
  });
}
