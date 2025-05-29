// @/app/lib/fallbackInsightService/fallbackInsight.types.ts
// v1.1.1 (Remove tentativa incorreta de importar DailySnapshot de dataService)
import type { IUser } from '@/app/models/User';
import type { IMetric, IMetricStats as DirectIMetricStatsOriginal } from '@/app/models/Metric';
import type { Types } from 'mongoose';
import type {
    IEnrichedReport as OriginalEnrichedReport,
    IAccountInsight as OriginalAccountInsight,
    PostObject as OriginalPostObjectFromDataService,
    HistoricalGrowth as OriginalHistoricalGrowth,
    // DailySnapshot as OriginalDailySnapshotFromDataService, // LINHA REMOVIDA - DailySnapshot é definido localmente
} from '@/app/lib/dataService';
import type {
    DayOfWeekStat as OriginalDayOfWeekStat,
    DetailedContentStat as OriginalDetailedContentStat,
    DurationStat as OriginalDurationStat
} from '@/app/lib/reportHelpers';
import type {
    IDialogueState as OriginalDialogueState,
    IFallbackInsightHistoryEntry as OriginalHistoryEntry
} from '@/app/lib/stateService';
import { FallbackInsightType as OriginalFallbackInsightType } from '@/app/lib/constants';

import type {
    FormatType as CommunityFormatType,
    ProposalType as CommunityProposalType,
    ContextType as CommunityContextType,
    QualitativeObjectiveType as CommunityQualitativeObjectiveType,
    PerformanceHighlightType as CommunityPerformanceHighlightType
} from '@/app/lib/constants/communityInspirations.constants';

/**
 * Define a estrutura esperada para os snapshots diários de métricas.
 * Esta interface é baseada nas propriedades acessadas nas funções geradoras de insight.
 */
export interface DailySnapshot {
  metric?: Types.ObjectId | IMetricModel;
  date?: Date;
  dayNumber?: number;
  dailyViews?: number;
  dailyLikes?: number;
  dailyComments?: number;
  dailyShares?: number;
  dailySaved?: number;
  dailyReach?: number;
  dailyFollows?: number;
  dailyProfileVisits?: number;
  dailyReelsVideoViewTotalTime?: number;
  dailyImpressions?: number;
  cumulativeViews?: number;
  cumulativeLikes?: number;
  cumulativeComments?: number;
  cumulativeShares?: number;
  cumulativeSaved?: number;
  cumulativeReach?: number;
  cumulativeFollows?: number;
  cumulativeProfileVisits?: number;
  cumulativeTotalInteractions?: number;
  cumulativeReelsVideoViewTotalTime?: number;
  currentReelsAvgWatchTime?: number;
}

export type IUserModel = IUser;
export type IMetricModel = IMetric;
export type IMetricStats = DirectIMetricStatsOriginal;
export type IEnrichedReport = OriginalEnrichedReport;
export type IAccountInsight = OriginalAccountInsight;
export type PostObject = OriginalPostObjectFromDataService;
export type HistoricalGrowth = OriginalHistoricalGrowth;
export type DayOfWeekStat = OriginalDayOfWeekStat;
export type DetailedContentStat = OriginalDetailedContentStat;
export type DurationStat = OriginalDurationStat;
export type IDialogueState = OriginalDialogueState;
export type IFallbackInsightHistoryEntry = OriginalHistoryEntry;
export type FallbackInsightType = OriginalFallbackInsightType;

export type FormatType = CommunityFormatType;
export type ProposalType = CommunityProposalType;
export type ContextType = CommunityContextType;
export type QualitativeObjectiveType = CommunityQualitativeObjectiveType;
export type PerformanceHighlightType = CommunityPerformanceHighlightType;

export interface PotentialInsight {
    text: string;
    type: FallbackInsightType;
}
