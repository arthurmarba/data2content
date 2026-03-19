import MetricModel from "@/app/models/Metric";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";
import { canonicalizeCategoryValues, type CategoryType } from "@/app/lib/classification";

export interface AggregatedHighlight {
  name: string | null;
  average: number;
  count: number;
}

export interface UserPerformanceHighlightsAggregation {
  topFormat: AggregatedHighlight | null;
  lowFormat: AggregatedHighlight | null;
  topContext: AggregatedHighlight | null;
  topProposal: AggregatedHighlight | null;
  topTone: AggregatedHighlight | null;
  topReference: AggregatedHighlight | null;
}

async function aggregateUserPerformanceHighlights(
  userId: string | Types.ObjectId,
  periodInDays: number,
  metricField: string,
  referenceDate: Date = new Date()
): Promise<UserPerformanceHighlightsAggregation> {
  const resolvedUserId =
    typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
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

  const initial: UserPerformanceHighlightsAggregation = {
    topFormat: null,
    lowFormat: null,
    topContext: null,
    topProposal: null,
    topTone: null,
    topReference: null,
  };

  try {
    await connectToDatabase();
    const projection: Record<string, 1> = {
      format: 1,
      context: 1,
      proposal: 1,
      tone: 1,
      references: 1,
    };
    projection[metricField] = 1;

    const posts = await MetricModel.find(
      {
        user: resolvedUserId,
        postDate: { $gte: startDate, $lte: endDate },
      },
      projection
    ).lean().exec();

    type CategoryField = "format" | "context" | "proposal" | "tone" | "references";
    const fieldToType: Record<CategoryField, CategoryType> = {
      format: "format",
      context: "context",
      proposal: "proposal",
      tone: "tone",
      references: "reference",
    };

    const aggregates: Record<CategoryField, Map<string, { sum: number; count: number }>> = {
      format: new Map(),
      context: new Map(),
      proposal: new Map(),
      tone: new Map(),
      references: new Map(),
    };

    const resolveMetricValue = (source: Record<string, any>, path: string): number | null => {
      const value = path.split(".").reduce<any>((current, part) => current?.[part], source);
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    };

    const toHighlight = (
      entries: Array<[string, { sum: number; count: number }]>,
      index: number
    ): AggregatedHighlight | null => {
      const entry = entries[index];
      if (!entry) return null;
      const [name, data] = entry;
      return {
        name,
        average: data.count > 0 ? data.sum / data.count : 0,
        count: data.count,
      };
    };

    for (const post of posts as Array<Record<string, any>>) {
      const metricValue = resolveMetricValue(post, metricField);
      if (metricValue === null) continue;

      (Object.keys(aggregates) as CategoryField[]).forEach((field) => {
        const values = canonicalizeCategoryValues(post[field], fieldToType[field], { includeUnknown: true });
        values.forEach((value) => {
          const bucket = aggregates[field].get(value) ?? { sum: 0, count: 0 };
          bucket.sum += metricValue;
          bucket.count += 1;
          aggregates[field].set(value, bucket);
        });
      });
    }

    const sortEntries = (
      map: Map<string, { sum: number; count: number }>,
      direction: "desc" | "asc" = "desc"
    ) =>
      Array.from(map.entries()).sort((left, right) => {
        const leftAverage = left[1].count > 0 ? left[1].sum / left[1].count : 0;
        const rightAverage = right[1].count > 0 ? right[1].sum / right[1].count : 0;
        if (leftAverage === rightAverage) return right[1].count - left[1].count;
        return direction === "desc" ? rightAverage - leftAverage : leftAverage - rightAverage;
      });

    initial.topFormat = toHighlight(sortEntries(aggregates.format), 0);
    initial.lowFormat = toHighlight(sortEntries(aggregates.format, "asc"), 0);
    initial.topContext = toHighlight(sortEntries(aggregates.context), 0);
    initial.topProposal = toHighlight(sortEntries(aggregates.proposal), 0);
    initial.topTone = toHighlight(sortEntries(aggregates.tone), 0);
    initial.topReference = toHighlight(sortEntries(aggregates.references), 0);

    return initial;
  } catch (error) {
    logger.error(
      `Error in aggregateUserPerformanceHighlights for user ${resolvedUserId}:`,
      error
    );
    return initial;
  }
}

export default aggregateUserPerformanceHighlights;
