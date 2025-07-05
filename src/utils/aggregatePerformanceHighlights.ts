import MetricModel from "@/app/models/Metric";
import { Types, PipelineStage } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";

export interface AggregatedHighlight {
  name: string | null;
  average: number;
  count: number;
}

export interface PerformanceHighlightsAggregation {
  topFormat: AggregatedHighlight | null;
  lowFormat: AggregatedHighlight | null;
  topContext: AggregatedHighlight | null;
}

async function aggregatePerformanceHighlights(
  userId: string | Types.ObjectId,
  periodInDays: number,
  metricField: string,
  referenceDate: Date = new Date()
): Promise<PerformanceHighlightsAggregation> {
  const resolvedUserId =
    typeof userId === "string" ? new Types.ObjectId(userId) : userId;
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
  const startDate = getStartDateFromTimePeriod(
    today,
    `last_${periodInDays}_days`
  );

  const initial: PerformanceHighlightsAggregation = {
    topFormat: null,
    lowFormat: null,
    topContext: null,
  };

  try {
    await connectToDatabase();

    const matchStage: PipelineStage.Match = {
      $match: {
        user: resolvedUserId,
        postDate: { $gte: startDate, $lte: endDate },
      },
    };

    const projectStage: PipelineStage.Project = {
      $project: {
        format: { $ifNull: ["$format", null] },
        context: { $ifNull: ["$context", null] },
        metricValue: `$${metricField}`,
      },
    };

    const metricFilterStage: PipelineStage.Match = {
      $match: { metricValue: { $ne: null } },
    };

    const pipeline: PipelineStage[] = [
      matchStage,
      projectStage,
      metricFilterStage,
      {
        $facet: {
          byFormat: [
            { $unwind: "$format" },
            {
              $group: {
                _id: "$format",
                avg: { $avg: "$metricValue" },
                count: { $sum: 1 },
              },
            },
            { $sort: { avg: -1 } },
          ],
          byContext: [
            { $unwind: "$context" },
            {
              $group: {
                _id: "$context",
                avg: { $avg: "$metricValue" },
                count: { $sum: 1 },
              },
            },
            { $sort: { avg: -1 } },
          ],
        },
      },
    ];

    const [agg] = await MetricModel.aggregate(pipeline);

    if (agg?.byFormat?.length) {
      const topF = agg.byFormat[0];
      const lowF = agg.byFormat[agg.byFormat.length - 1];
      const topFormatName = Array.isArray(topF._id) ? topF._id.join(',') : topF._id;
      const lowFormatName = Array.isArray(lowF._id) ? lowF._id.join(',') : lowF._id;
      initial.topFormat = {
        name: topFormatName ?? null,
        average: topF.avg ?? 0,
        count: topF.count ?? 0,
      };
      initial.lowFormat = {
        name: lowFormatName ?? null,
        average: lowF.avg ?? 0,
        count: lowF.count ?? 0,
      };
    }

    if (agg?.byContext?.length) {
      const topC = agg.byContext[0];
      const topContextName = Array.isArray(topC._id) ? topC._id.join(',') : topC._id;
      initial.topContext = {
        name: topContextName ?? null,
        average: topC.avg ?? 0,
        count: topC.count ?? 0,
      };
    }

    return initial;
  } catch (error) {
    logger.error(
      `Error in aggregatePerformanceHighlights for user ${resolvedUserId}:`,
      error
    );
    return initial;
  }
}

export default aggregatePerformanceHighlights;
