/**
 * @fileoverview Funções para obter destaques de performance da plataforma.
 * @version 1.0.0
 */

import { PipelineStage } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';

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

export interface AggregatePerformanceHighlightsArgs {
  timePeriod: string;
  metricField?: string;
}

const SERVICE_TAG = '[dataService][performanceHighlights]';

export async function aggregatePerformanceHighlights(
  args: AggregatePerformanceHighlightsArgs
): Promise<PerformanceHighlightsAggregation> {
  const TAG = `${SERVICE_TAG}[aggregatePerformanceHighlights]`;
  const metricField = args.metricField || 'stats.total_interactions';

  logger.info(
    `${TAG} Aggregating highlights for metric ${metricField} and timePeriod ${args.timePeriod}`
  );

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, args.timePeriod);

  const initial: PerformanceHighlightsAggregation = {
    topFormat: null,
    lowFormat: null,
    topContext: null,
  };

  try {
    await connectToDatabase();

    const matchStage: PipelineStage.Match = { $match: {} };
    if (args.timePeriod !== 'all_time') {
      matchStage.$match.postDate = { $gte: startDate, $lte: endDate };
    }

    const projectStage: PipelineStage.Project = {
      $project: {
        format: { $ifNull: ['$format', null] },
        context: { $ifNull: ['$context', null] },
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
            { $group: { _id: '$format', avg: { $avg: '$metricValue' }, count: { $sum: 1 } } },
            { $sort: { avg: -1 } },
          ],
          byContext: [
            { $group: { _id: '$context', avg: { $avg: '$metricValue' }, count: { $sum: 1 } } },
            { $sort: { avg: -1 } },
          ],
        },
      },
    ];

    const [agg] = await MetricModel.aggregate(pipeline);

    if (agg?.byFormat?.length) {
      const topF = agg.byFormat[0];
      const lowF = agg.byFormat[agg.byFormat.length - 1];
      initial.topFormat = {
        name: topF._id ?? null,
        average: topF.avg ?? 0,
        count: topF.count ?? 0,
      };
      initial.lowFormat = {
        name: lowF._id ?? null,
        average: lowF.avg ?? 0,
        count: lowF.count ?? 0,
      };
    }

    if (agg?.byContext?.length) {
      const topC = agg.byContext[0];
      initial.topContext = {
        name: topC._id ?? null,
        average: topC.avg ?? 0,
        count: topC.count ?? 0,
      };
    }

    return initial;
  } catch (error: any) {
    logger.error(`${TAG} Error aggregating highlights:`, error);
    throw new DatabaseError(`Failed to aggregate performance highlights: ${error.message}`);
  }
}

