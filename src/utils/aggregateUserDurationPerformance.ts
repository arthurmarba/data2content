import MetricModel from "@/app/models/Metric";
import { PipelineStage, Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";

export interface DurationBucketPerformance {
  key: "0_15" | "15_30" | "30_60" | "60_plus";
  label: "0-15s" | "15-30s" | "30-60s" | "60s+";
  minSeconds: number;
  maxSeconds: number | null;
  postsCount: number;
  totalInteractions: number;
  averageInteractions: number;
}

export interface UserDurationPerformance {
  buckets: DurationBucketPerformance[];
  totalVideoPosts: number;
  totalPostsWithDuration: number;
  totalPostsWithoutDuration: number;
  durationCoverageRate: number;
}

const DURATION_BUCKET_DEFS: Array<{
  bucketId: number;
  key: DurationBucketPerformance["key"];
  label: DurationBucketPerformance["label"];
  minSeconds: number;
  maxSeconds: number | null;
}> = [
  { bucketId: 0, key: "0_15", label: "0-15s", minSeconds: 0, maxSeconds: 15 },
  { bucketId: 15, key: "15_30", label: "15-30s", minSeconds: 15, maxSeconds: 30 },
  { bucketId: 30, key: "30_60", label: "30-60s", minSeconds: 30, maxSeconds: 60 },
  { bucketId: 60, key: "60_plus", label: "60s+", minSeconds: 60, maxSeconds: null },
];

const FALLBACK_RESULT: UserDurationPerformance = {
  buckets: DURATION_BUCKET_DEFS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    minSeconds: bucket.minSeconds,
    maxSeconds: bucket.maxSeconds,
    postsCount: 0,
    totalInteractions: 0,
    averageInteractions: 0,
  })),
  totalVideoPosts: 0,
  totalPostsWithDuration: 0,
  totalPostsWithoutDuration: 0,
  durationCoverageRate: 0,
};

export async function aggregateUserDurationPerformance(
  userId: string | Types.ObjectId,
  periodInDays: number,
  referenceDate: Date = new Date()
): Promise<UserDurationPerformance> {
  const today = new Date(referenceDate);
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999
  );
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

  try {
    await connectToDatabase();

    const resolvedUserId =
      typeof userId === "string" ? new Types.ObjectId(userId) : userId;

    const pipeline: PipelineStage[] = [
      {
        $match: {
          user: resolvedUserId,
          postDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $project: {
          durationSeconds: {
            $cond: [
              { $gt: [{ $ifNull: ["$stats.video_duration_seconds", 0] }, 0] },
              "$stats.video_duration_seconds",
              null,
            ],
          },
          interactions: {
            $ifNull: [
              "$stats.total_interactions",
              {
                $add: [
                  { $ifNull: ["$stats.likes", 0] },
                  { $ifNull: ["$stats.comments", 0] },
                  { $ifNull: ["$stats.shares", 0] },
                  { $ifNull: ["$stats.saved", 0] },
                ],
              },
            ],
          },
          isVideoContent: {
            $or: [
              { $in: ["$type", ["REEL", "VIDEO"]] },
              { $gt: [{ $ifNull: ["$stats.video_duration_seconds", 0] }, 0] },
            ],
          },
        },
      },
      {
        $facet: {
          durationBuckets: [
            {
              $match: {
                isVideoContent: true,
                durationSeconds: { $ne: null, $gt: 0 },
              },
            },
            {
              $bucket: {
                groupBy: "$durationSeconds",
                boundaries: [0, 15, 30, 60, 1000000],
                default: "other",
                output: {
                  postsCount: { $sum: 1 },
                  totalInteractions: { $sum: { $ifNull: ["$interactions", 0] } },
                },
              },
            },
            {
              $project: {
                _id: 0,
                bucketId: "$_id",
                postsCount: 1,
                totalInteractions: 1,
              },
            },
          ],
          totalVideoPosts: [
            { $match: { isVideoContent: true } },
            { $count: "count" },
          ],
          totalPostsWithDuration: [
            {
              $match: {
                isVideoContent: true,
                durationSeconds: { $ne: null, $gt: 0 },
              },
            },
            { $count: "count" },
          ],
          totalPostsWithoutDuration: [
            {
              $match: {
                isVideoContent: true,
                $or: [{ durationSeconds: null }, { durationSeconds: { $lte: 0 } }],
              },
            },
            { $count: "count" },
          ],
        },
      },
    ];

    const [aggregation] = await MetricModel.aggregate(pipeline);
    if (!aggregation) return FALLBACK_RESULT;

    const bucketRows: Array<{
      bucketId: number | string;
      postsCount: number;
      totalInteractions: number;
    }> = Array.isArray(aggregation.durationBuckets) ? aggregation.durationBuckets : [];

    const bucketMap = new Map<number, { postsCount: number; totalInteractions: number }>();
    for (const row of bucketRows) {
      if (typeof row.bucketId !== "number") continue;
      bucketMap.set(row.bucketId, {
        postsCount: Number(row.postsCount || 0),
        totalInteractions: Number(row.totalInteractions || 0),
      });
    }

    const buckets: DurationBucketPerformance[] = DURATION_BUCKET_DEFS.map((definition) => {
      const data = bucketMap.get(definition.bucketId) || { postsCount: 0, totalInteractions: 0 };
      const averageInteractions =
        data.postsCount > 0 ? data.totalInteractions / data.postsCount : 0;
      return {
        key: definition.key,
        label: definition.label,
        minSeconds: definition.minSeconds,
        maxSeconds: definition.maxSeconds,
        postsCount: data.postsCount,
        totalInteractions: data.totalInteractions,
        averageInteractions,
      };
    });

    const totalVideoPosts = Number(aggregation.totalVideoPosts?.[0]?.count || 0);
    const totalPostsWithDuration = Number(aggregation.totalPostsWithDuration?.[0]?.count || 0);
    const totalPostsWithoutDuration = Number(aggregation.totalPostsWithoutDuration?.[0]?.count || 0);
    const durationCoverageRate =
      totalVideoPosts > 0 ? totalPostsWithDuration / totalVideoPosts : 0;

    return {
      buckets,
      totalVideoPosts,
      totalPostsWithDuration,
      totalPostsWithoutDuration,
      durationCoverageRate,
    };
  } catch (error) {
    logger.error("Error in aggregateUserDurationPerformance:", error);
    return FALLBACK_RESULT;
  }
}
