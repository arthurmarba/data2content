import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "./dateHelpers";
import { getCategoryWithSubcategoryIds, getCategoryById } from "@/app/lib/classification";
import { resolveCreatorIdsByContext } from "@/app/lib/creatorContextHelper";
import {
  getMetricCategoryValuesForAnalytics,
  type StrategicRankableCategory,
} from "@/app/lib/classificationV2Bridge";

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
  topContentIntent: AggregatedHighlight | null;
  topNarrativeForm: AggregatedHighlight | null;
  topContentSignal: AggregatedHighlight | null;
  topStance: AggregatedHighlight | null;
  topProofStyle: AggregatedHighlight | null;
  topCommercialMode: AggregatedHighlight | null;
}

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

async function aggregatePlatformPerformanceHighlights(
  periodInDays: number,
  metricField: string,
  agencyId?: string,
  referenceDate: Date = new Date(),
  onlyActiveSubscribers?: boolean,
  contextFilter?: string,
  creatorContext?: string
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
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

  const initial: PlatformPerformanceHighlightsAggregation = {
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

    let userFilter: Record<string, unknown> = {};
    if (agencyId || onlyActiveSubscribers) {
      const query: Record<string, unknown> = {};
      if (agencyId) query.agency = new Types.ObjectId(agencyId);
      if (onlyActiveSubscribers) query.planStatus = "active";
      const filteredUserIds = await UserModel.find(query).distinct("_id");
      if (!filteredUserIds.length) {
        return initial;
      }
      userFilter = { user: { $in: filteredUserIds } };
    }

    if (creatorContext) {
      const contextIds = await resolveCreatorIdsByContext(creatorContext, { onlyActiveSubscribers });
      const contextObjectIds = contextIds.map((id) => new Types.ObjectId(id));
      if (!contextObjectIds.length) {
        return initial;
      }

      if ("user" in userFilter && (userFilter.user as { $in?: Types.ObjectId[] }).$in) {
        const existingIds = (userFilter.user as { $in: Types.ObjectId[] }).$in;
        userFilter.user = {
          $in: existingIds.filter((id) => contextObjectIds.some((cid) => cid.equals(id))),
        };
      } else {
        userFilter.user = { $in: contextObjectIds };
      }
    }

    const matchFilter: Record<string, unknown> = {
      postDate: { $gte: startDate, $lte: endDate },
      ...userFilter,
    };

    if (contextFilter) {
      const ids = getCategoryWithSubcategoryIds(contextFilter, "context");
      const labels = ids.map((id) => getCategoryById(id, "context")?.label || id);
      matchFilter.context = { $in: [...ids, ...labels] };
    }

    const projection: Record<string, 1> = {
      source: 1,
      type: 1,
      description: 1,
      format: 1,
      proposal: 1,
      context: 1,
      tone: 1,
      references: 1,
      contentIntent: 1,
      narrativeForm: 1,
      contentSignals: 1,
      stance: 1,
      proofStyle: 1,
      commercialMode: 1,
      stats: 1,
    };
    projection[metricField] = 1;

    const posts = await MetricModel.find(matchFilter, projection).lean().exec();

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

    const resolveMetricValue = (source: Record<string, unknown>, path: string): number | null => {
      const value = path.split(".").reduce<unknown>(
        (current, part) => (current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined),
        source
      );
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

    for (const post of posts as Array<Record<string, unknown>>) {
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
    logger.error("Error in aggregatePlatformPerformanceHighlights:", error);
    return initial;
  }
}

export default aggregatePlatformPerformanceHighlights;
