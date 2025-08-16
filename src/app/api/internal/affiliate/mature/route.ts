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

// Adquire lock de forma atômica com updateOne (evita overloads de findOneAndUpdate)
async function acquireLock(name = 'affiliate-mature', ttlSec = 240) {
  const now = new Date();
  const expires = new Date(now.getTime() + ttlSec * 1000);
  const owner = os.hostname();

  // Só atualiza quando (a) expirado ou (b) nunca lockado
  const filter = {
    _id: name,
    $or: [{ expiresAt: { $lte: now } }, { lockedAt: null }],
  };

  const update = {
    $set: { lockedAt: now, expiresAt: expires, owner },
  };

  const res = await CronLock.updateOne(filter as any, update, { upsert: true });

  // Se fez upsert OU modificou o doc existente, o lock é nosso
  const has = (res.upsertedCount ?? 0) > 0 || (res.modifiedCount ?? 0) > 0;

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
  if (!has) {
    return new Response(JSON.stringify({ ok: false, reason: 'locked' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
          // ⬇️ Tip-safe: maturedAt pode não existir na interface gerada — setamos via `any`
          (e as any).maturedAt = new Date();
        }
        changed = true;
        maturedEntries++;
        countThisUser++;
      }
    }

    if (changed && !dryRun) {
      // Garante persistência das mudanças no array de subdocs
      // (em alguns setups o Mongoose já detecta; essa chamada é defensiva)
      // @ts-ignore - nem todo tipo expõe markModified no TS
      u.markModified?.('commissionLog');
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
