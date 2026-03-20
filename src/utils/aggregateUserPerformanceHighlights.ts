import MetricModel from "@/app/models/Metric";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";
import { getMetricCategoryValuesForAnalytics, type StrategicRankableCategory } from "@/app/lib/classificationV2Bridge";

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
  topContentIntent: AggregatedHighlight | null;
  topNarrativeForm: AggregatedHighlight | null;
  topContentSignal: AggregatedHighlight | null;
  topStance: AggregatedHighlight | null;
  topProofStyle: AggregatedHighlight | null;
  topCommercialMode: AggregatedHighlight | null;
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
    topContentIntent: null,
    topNarrativeForm: null,
    topContentSignal: null,
    topStance: null,
    topProofStyle: null,
    topCommercialMode: null,
  };

  try {
    await connectToDatabase();
    const projection: Record<string, 1> = {
      source: 1,
      type: 1,
      description: 1,
      format: 1,
      context: 1,
      proposal: 1,
      tone: 1,
      references: 1,
      contentIntent: 1,
      narrativeForm: 1,
      contentSignals: 1,
      stance: 1,
      proofStyle: 1,
      commercialMode: 1,
    };
    projection[metricField] = 1;

    const posts = await MetricModel.find(
      {
        user: resolvedUserId,
        postDate: { $gte: startDate, $lte: endDate },
      },
      projection
    ).lean().exec();

    type CategoryField =
      | "format"
      | "context"
      | "proposal"
      | "tone"
      | "references"
      | "contentIntent"
      | "narrativeForm"
      | "contentSignals"
      | "stance"
      | "proofStyle"
      | "commercialMode";

    const aggregates: Record<CategoryField, Map<string, { sum: number; count: number }>> = {
      format: new Map(),
      context: new Map(),
      proposal: new Map(),
      tone: new Map(),
      references: new Map(),
      contentIntent: new Map(),
      narrativeForm: new Map(),
      contentSignals: new Map(),
      stance: new Map(),
      proofStyle: new Map(),
      commercialMode: new Map(),
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
        const values = getMetricCategoryValuesForAnalytics(
          post,
          field as StrategicRankableCategory
        );
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
    initial.topContentIntent = toHighlight(sortEntries(aggregates.contentIntent), 0);
    initial.topNarrativeForm = toHighlight(sortEntries(aggregates.narrativeForm), 0);
    initial.topContentSignal = toHighlight(sortEntries(aggregates.contentSignals), 0);
    initial.topStance = toHighlight(sortEntries(aggregates.stance), 0);
    initial.topProofStyle = toHighlight(sortEntries(aggregates.proofStyle), 0);
    initial.topCommercialMode = toHighlight(sortEntries(aggregates.commercialMode), 0);

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
