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
 * We count distinct `generatedAt` timestamps rounded to the nearest second —
 * practically this means we count stored ideas generated in the current month,
 * grouped by their batch (ideas from the same batch share the same `generatedAt`
 * to the minute, so counting distinct minutes is a good proxy).
 *
 * Simple approximation: count total ideas generated this month and divide by
 * average batch size (3). This avoids needing a separate "generation event" model.
 *
 * For production accuracy, store a `ContentIdeaGenerationEvent` — but this is
 * sufficient for launch quota enforcement.
 */
export async function countContentIdeaGenerationsThisMonth(
  userId: string,
): Promise<number> {
  await connectToDatabase();
  const { start, end } = getMonthRange(new Date());

  // Count total ideas generated this month for this user
  const count = await CreatorContentIdea.countDocuments({
    userId,
    generatedAt: { $gte: start, $lt: end },
  });

  // Divide by 3 (default batch size) and round up to estimate batches
  return Math.ceil(count / 3);
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

  const nextMonthKey = `${monthKey.slice(0, 4)}-${String(Number(monthKey.slice(5, 7)) % 12 + 1).padStart(2, "0")}`;
  const resetAt = `${nextMonthKey}-01T00:00:00.000Z`;

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
