/**
 * @fileoverview Tipos e interfaces compartilhados para o marketAnalysisService.
 * @version 1.1.0
 * @description Adicionados tipos para ranking de categoria genérico e removidos os tipos específicos de proposta que se tornaram obsoletos.
 */

import { Types } from 'mongoose';
import { z } from 'zod';

// --- (NOVO) Tipos para Ranking de Categoria Genérico ---
export type RankableCategory = 'proposal' | 'format' | 'context';

export interface ICategoryMetricRankItem {
  category: string;
  value: number;
}
// --- FIM DA SEÇÃO NOVA ---

// --- Validação de Schema e Tipos de Contrato ---

export const TopCreatorMetricEnum = z.enum([
    'total_interactions',
    'engagement_rate_on_reach',
    'likes',
    'shares',
    'comments'
]);
export type TopCreatorMetric = z.infer<typeof TopCreatorMetricEnum>;

// --- Allowed metrics for category ranking ---
export const CategoryRankingMetricEnum = z.enum([
  'shares',
  'likes',
  'comments',
  'reach',
  'views',
  'posts'
]);
export type CategoryRankingMetric = z.infer<typeof CategoryRankingMetricEnum>;

// --- (REMOVIDO) O Enum e o Tipo abaixo foram substituídos pela nova abordagem genérica ---
// export const ProposalRankingMetricEnum = z.enum([
//   'avg_views',
//   'total_interactions'
// ]);
// export type ProposalRankingMetric = z.infer<typeof ProposalRankingMetricEnum>;
// -----------------------------------------------------------------------------------------

// --- Interfaces de Contrato ---

export interface IMarketPerformanceResult {
    avgEngagementRate?: number;
    avgShares?: number;
    avgLikes?: number;
    postCount: number;
}

export interface ITopCreatorResult {
    creatorId: string;
    creatorName?: string;
    metricValue: number;
    totalInteractions: number;
    postCount: number;
}

export interface ICreatorProfile {
    creatorId: string;
    creatorName: string;
    postCount: number;
    avgLikes: number;
    avgShares: number;
    avgEngagementRate: number;
    topPerformingContext: string;
    profilePictureUrl?: string;
}

export interface IFetchMultipleCreatorProfilesArgs {
  creatorIds: string[];
}

export interface FindGlobalPostsArgs {
    context?: string;
    proposal?: string;
    format?: string;
    minInteractions?: number;
    limit?: number;
    page?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    dateRange?: {
        startDate?: Date;
        endDate?: Date;
    };
}

export interface IGlobalPostResult {
  _id: Types.ObjectId;
  text_content?: string;
  description?: string;
  creatorName?: string;
  postDate?: Date;
  format?: string;
  proposal?: string;
  context?: string;
  stats?: {
    total_interactions?: number;
    likes?: number;
    shares?: number;
  };
}

export interface IGlobalPostsPaginatedResult {
    posts: IGlobalPostResult[];
    totalPosts: number;
    page: number;
    limit: number;
}

export interface IFetchDashboardCreatorsListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: {
    nameSearch?: string;
    planStatus?: string[];
    expertiseLevel?: string[];
    minTotalPosts?: number;
    minFollowers?: number;
    startDate?: string;
    endDate?: string;
  };
}

export interface IDashboardCreator {
  _id: Types.ObjectId;
  name: string;
  planStatus?: string;
  inferredExpertiseLevel?: string;
  totalPosts: number;
  lastActivityDate?: Date;
  avgEngagementRate: number;
  profilePictureUrl?: string;
  recentAlertsSummary?: {
    count: number;
    alerts: Array<{ type: string; date: Date; message?: string }>;
  };
}

export interface IFetchDashboardOverallContentStatsFilters {
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
  };
}

export interface IDashboardOverallStats {
  totalPlatformPosts: number;
  averagePlatformEngagementRate: number;
  totalContentCreators: number;
  breakdownByFormat: { format: string; count: number }[];
  breakdownByProposal: { proposal: string; count: number }[];
  breakdownByContext: { context: string; count: number }[];
}


export interface IFetchTucaRadarEffectivenessArgs {
    alertType?: string;
    periodDays: number;
}

export interface ITucaRadarEffectivenessResult {
    alertType: string;
    positiveInteractionRate: number;
    totalAlerts: number;
}

export interface IFetchCohortComparisonArgs {
    metric: string;
    cohorts: { filterBy: 'planStatus' | 'inferredExpertiseLevel'; value: string }[];
    dateRange?: {
        startDate: Date;
        endDate: Date;
    };
}

export interface ICohortComparisonResult {
    cohortName: string;
    avgMetricValue: number;
    userCount: number;
}

export interface IRankingCreatorInfo {
  creatorId: Types.ObjectId;
  creatorName: string;
  profilePictureUrl?: string;
}

export interface ICreatorMetricRankItem extends IRankingCreatorInfo {
  metricValue: number;
}

// --- (REMOVIDO) Substituído por ICategoryMetricRankItem para ser genérico ---
// export interface IProposalMetricRankItem {
//   proposal: string;
//   metricValue: number;
// }
// --------------------------------------------------------------------------

export interface IFetchCreatorRankingParams {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  limit?: number;
}

export interface IFetchCreatorTimeSeriesArgs {
  creatorId: string;
  metric: 'post_count' | 'avg_engagement_rate' | 'avg_likes' | 'avg_shares' | 'total_interactions';
  period: 'monthly' | 'weekly';
  dateRange: { startDate: Date; endDate: Date };
}

export interface ISegmentDefinition {
  format?: string;
  proposal?: string;
  context?: string;
}

export interface IFetchSegmentPerformanceArgs {
  criteria: ISegmentDefinition;
  dateRange: { startDate: Date; endDate: Date };
}

export interface ISegmentPerformanceResult {
  postCount: number;
  avgEngagementRate: number;
  avgLikes: number;
  avgShares: number;
  avgComments: number;
}

export interface IPeriod {
  startDate: Date;
  endDate: Date;
}

export type TopMoverEntityType = 'content' | 'creator';

export type TopMoverMetric =
  | 'cumulativeViews'
  | 'cumulativeLikes'
  | 'cumulativeShares'
  | 'cumulativeComments'
  | 'cumulativeSaved'
  | 'cumulativeReach'
  | 'cumulativeImpressions'
  | 'cumulativeTotalInteractions';

export type TopMoverSortBy =
  | 'absoluteChange_increase'
  | 'absoluteChange_decrease'
  | 'percentageChange_increase'
  | 'percentageChange_decrease';

export interface ITopMoverCreatorFilters {
    planStatus?: string[];
    inferredExpertiseLevel?: string[];
}

export interface IFetchTopMoversArgs {
  entityType: TopMoverEntityType;
  metric: TopMoverMetric;
  currentPeriod: IPeriod;
  previousPeriod: IPeriod;
  topN?: number;
  sortBy?: TopMoverSortBy;
  creatorFilters?: ITopMoverCreatorFilters;
  contentFilters?: ISegmentDefinition;
}

export interface ITopMoverResult {
  entityId: string;
  entityName: string;
  profilePictureUrl?: string;
  coverUrl?: string; // <<< ADICIONE ESTA LINHA
  metricName: TopMoverMetric;
  previousValue: number;
  currentValue: number;
  absoluteChange: number;
  percentageChange: number | null;
}

export interface IFetchPlatformConversionMetricsArgs {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

export interface ICreatorTimeSeriesDataPoint {
  date: Date;
  value: number;
}

export interface IPlatformConversionMetrics {
  averageFollowerConversionRatePerPost: number;
  accountFollowerConversionRate: number;
  numberOfPostsConsideredForRate: number;
  accountsEngagedInPeriod: number;
  followersGainedInPeriod: number;
}