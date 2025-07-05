import MetricModel from "@/app/models/Metric";
import { PipelineStage } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";

export interface AggregatedHighlight {
  name: string | null;
  average: number;
  count: number;
}

export interface PlatformPerformanceHighlightsAggregation {
  topFormat: AggregatedHighlight | null;
  lowFormat: AggregatedHighlight | null;
  topContext: AggregatedHighlight | null;
  topProposal: AggregatedHighlight | null;
  topTone: AggregatedHighlight | null;
  topReference: AggregatedHighlight | null;
}

async function aggregatePlatformPerformanceHighlights(
  periodInDays: number,
  metricField: string,
  referenceDate: Date = new Date()
): Promise<PlatformPerformanceHighlightsAggregation> {
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

  const initial: PlatformPerformanceHighlightsAggregation = {
    topFormat: null,
    lowFormat: null,
    topContext: null,
    topProposal: null,
    topTone: null,
    topReference: null,
  };

  try {
    await connectToDatabase();

    const matchStage: PipelineStage.Match = {
      $match: {
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
          byProposal: [
            { $unwind: "$proposal" },
            {
              $group: {
                _id: "$proposal",
                avg: { $avg: "$metricValue" },
                count: { $sum: 1 },
              },
            },
            { $sort: { avg: -1 } },
          ],
          byTone: [
            { $unwind: "$tone" },
            {
              $group: {
                _id: "$tone",
                avg: { $avg: "$metricValue" },
                count: { $sum: 1 },
              },
            },
            { $sort: { avg: -1 } },
          ],
          byReference: [
            { $unwind: "$references" },
            {
              $group: {
                _id: "$references",
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

    if (agg?.byProposal?.length) {
      const topP = agg.byProposal[0];
      const topProposalName = Array.isArray(topP._id) ? topP._id.join(',') : topP._id;
      initial.topProposal = {
        name: topProposalName ?? null,
        average: topP.avg ?? 0,
        count: topP.count ?? 0,
      };
    }

    if (agg?.byTone?.length) {
      const topT = agg.byTone[0];
      const topToneName = Array.isArray(topT._id) ? topT._id.join(',') : topT._id;
      initial.topTone = {
        name: topToneName ?? null,
        average: topT.avg ?? 0,
        count: topT.count ?? 0,
      };
    }

    if (agg?.byReference?.length) {
      const topR = agg.byReference[0];
      const topReferenceName = Array.isArray(topR._id) ? topR._id.join(',') : topR._id;
      initial.topReference = {
        name: topReferenceName ?? null,
        average: topR.avg ?? 0,
        count: topR.count ?? 0,
      };
    }

    return initial;
  } catch (error) {
    logger.error("Error in aggregatePlatformPerformanceHighlights:", error);
    return initial;
  }
}

export default aggregatePlatformPerformanceHighlights;
