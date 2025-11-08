import os from 'node:os';
import { connectMongo } from '@/server/db/connect';
import { CronLock } from '@/server/db/models/CronLock';
import matureAffiliateCommissions from '@/cron/matureAffiliateCommissions';

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

  const {
    limit = 100,
    maxItemsPerUser: rawMaxItemsPerUser = 20,
    dryRun = false,
  } = await safeJson(req);

  const parsedMaxItems = Number(rawMaxItemsPerUser);
  const safeMaxItems = Number.isFinite(parsedMaxItems) ? parsedMaxItems : 20;
  const maxEntriesPerUser = Math.max(1, Math.min(100, safeMaxItems));

  const result = await matureAffiliateCommissions({
    dryRun,
    maxUsers: Math.max(1, Math.min(500, Number(limit))),
    maxEntriesPerUser,
  });

  return Response.json(result);
}
