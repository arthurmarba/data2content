import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorContentIdea from "@/app/models/CreatorContentIdea";

/**
 * Monthly generation limits for content ideas (pautas).
 * Counts unique generation batches per calendar month.
 */
export const CONTENT_IDEAS_QUOTA = {
  /** Free users: 3 generations/month (only if map is ready) */
  free: 3,
  /** Pro users: 30 generations/month */
  pro: 30,
  /** Admins: unlimited */
  admin: Infinity,
} as const;

function getMonthRange(now: Date): { start: Date; end: Date; monthKey: string } {
  const monthKey = now.toISOString().slice(0, 7); // "YYYY-MM"
  const start = new Date(`${monthKey}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end, monthKey };
}

/**
 * Returns how many generation batches the user has triggered this calendar month.
 *
 * Each call to `POST /content-ideas/generate` that succeeds counts as one batch,
 * regardless of how many ideas were generated in that batch.
 *
 * Cada timestamp exato representa um lote legado. Novos pedidos usam o ledger atômico de Collabs.
 */
export async function countContentIdeaGenerationsThisMonth(
  userId: string,
): Promise<number> {
  await connectToDatabase();
  const { start, end } = getMonthRange(new Date());

  const batches = await CreatorContentIdea.distinct("generatedAt", { userId, generatedAt: { $gte: start, $lt: end } });
  return batches.length;
}

export interface ContentIdeasQuotaResult {
  allowed: boolean;
  usedBatches: number;
  limitBatches: number;
  resetAt: string; // ISO date of next month start
}

/**
 * Checks whether the user is within their monthly content-ideas generation quota.
 */
export async function checkContentIdeasQuota(opts: {
  userId: string;
  isAdmin: boolean;
  isPro: boolean;
}): Promise<ContentIdeasQuotaResult> {
  const { userId, isAdmin, isPro } = opts;
  const now = new Date();
  const { start: _s, end, monthKey } = getMonthRange(now);

  const limit = isAdmin
    ? CONTENT_IDEAS_QUOTA.admin
    : isPro
      ? CONTENT_IDEAS_QUOTA.pro
      : CONTENT_IDEAS_QUOTA.free;

  const resetAt = end.toISOString();

  if (limit === Infinity) {
    return { allowed: true, usedBatches: 0, limitBatches: limit, resetAt };
  }

  const usedBatches = await countContentIdeaGenerationsThisMonth(userId);
  return {
    allowed: usedBatches < limit,
    usedBatches,
    limitBatches: limit,
    resetAt,
  };
}
