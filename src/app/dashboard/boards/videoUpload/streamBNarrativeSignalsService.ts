/**
 * streamBNarrativeSignalsService.ts
 *
 * Aggregates classified Instagram posts (Metric documents) into a "Stream B"
 * snapshot for the narrative map. Stream B is passive — it grows the map
 * silently between creator visits, while Stream A (D2C video uploads) is
 * active and triggers the leading narrative cards.
 *
 * For Phase 2 V1, this service exposes counts since last visit. Full signal
 * integration (territories, tones, themes) into the map cards is Phase 2b.
 */
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";

export interface StreamBSignalsSummary {
  /** Posts analyzed (with classification completed) since lastMapVisitAt. Capped at 99. */
  postsSinceLastVisit: number;
  /** Total posts available (with completed classification). Used to gauge map richness. */
  totalPostsAnalyzed: number;
  /** ISO timestamp of the most recent classified post. Null if none. */
  mostRecentPostAt: string | null;
  /** Distinct new themes detected since last visit (heuristic count of new theme strings). */
  newThemesSinceLastVisit: number;
}

const POSTS_CAP = 99;

/**
 * Builds a lightweight Stream B summary for the shell notification.
 *
 * - Uses Metric.classificationStatus = "completed" so only fully classified posts count.
 * - Compares Metric.postDate against lastMapVisitAt to derive "since last visit".
 * - Falls back to a 14-day window when lastMapVisitAt is null (new user).
 */
export async function buildStreamBSignalsSummary(
  userId: string,
  lastMapVisitAt: Date | null,
): Promise<StreamBSignalsSummary | null> {
  if (!userId || !Types.ObjectId.isValid(userId)) return null;

  try {
    await connectToDatabase();
    const { default: MetricModel } = await import("@/app/models/Metric");

    const userObjectId = new Types.ObjectId(userId);
    const sinceDate =
      lastMapVisitAt instanceof Date && !Number.isNaN(lastMapVisitAt.getTime())
        ? lastMapVisitAt
        : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // fallback: 14 days

    // Single aggregation: counts + most-recent date + recent themes
    const result = await MetricModel.aggregate([
      {
        $match: {
          user: userObjectId,
          classificationStatus: "completed",
        },
      },
      {
        $facet: {
          totalCount: [{ $count: "n" }],
          sinceLastVisitCount: [
            { $match: { postDate: { $gt: sinceDate } } },
            { $count: "n" },
          ],
          mostRecent: [
            { $sort: { postDate: -1 } },
            { $limit: 1 },
            { $project: { postDate: 1 } },
          ],
          themesSinceVisit: [
            { $match: { postDate: { $gt: sinceDate }, theme: { $exists: true, $ne: null } } },
            { $group: { _id: "$theme" } },
            { $count: "n" },
          ],
        },
      },
    ]);

    const facets = (result?.[0] ?? {}) as {
      totalCount?: Array<{ n: number }>;
      sinceLastVisitCount?: Array<{ n: number }>;
      mostRecent?: Array<{ postDate: Date }>;
      themesSinceVisit?: Array<{ n: number }>;
    };

    const totalPostsAnalyzed = facets.totalCount?.[0]?.n ?? 0;
    const postsSinceLastVisit = Math.min(
      facets.sinceLastVisitCount?.[0]?.n ?? 0,
      POSTS_CAP,
    );
    const mostRecentPostAt = facets.mostRecent?.[0]?.postDate
      ? facets.mostRecent[0].postDate.toISOString()
      : null;
    const newThemesSinceLastVisit = facets.themesSinceVisit?.[0]?.n ?? 0;

    return {
      postsSinceLastVisit,
      totalPostsAnalyzed,
      mostRecentPostAt,
      newThemesSinceLastVisit,
    };
  } catch (err) {
    console.error("[streamBSignals] Erro ao agregar Metrics:", err);
    return null;
  }
}

/**
 * Updates User.lastMapVisitAt. Called when the creator opens the shell.
 * Non-fatal on errors — the next visit will recompute correctly.
 */
export async function touchMapVisit(userId: string): Promise<void> {
  if (!userId || !Types.ObjectId.isValid(userId)) return;
  try {
    await connectToDatabase();
    const { default: UserModel } = await import("@/app/models/User");
    await UserModel.findByIdAndUpdate(userId, {
      $set: { lastMapVisitAt: new Date() },
    });
  } catch {
    // Non-fatal
  }
}
