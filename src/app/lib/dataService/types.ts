/**
 * @fileoverview Definições de tipos e interfaces para o dataService.
 * @version 2.14.14 (Adiciona instagramMediaId a PostObject)
 * @version 2.14.13 (Atualiza CommunityInspirationFilters e outros para usar Enums)
 */
import { Types } from 'mongoose';

// Importar tipos de helpers do seu projeto
import type {
    OverallStats,
    DurationStat,
    DetailedContentStat,
    ProposalStat,
    ContextStat,
    PerformanceByDayPCO,
    DayOfWeekStat
} from '@/app/lib/reportHelpers';

// Importar IMetric e IMetricStats localmente para uso interno
import type { IMetric as LocalIMetric, IMetricStats as LocalIMetricStats } from '@/app/models/Metric';

// Importar os tipos Enum para a Comunidade de Inspiração
import type {
    FormatType,
    ProposalType,
    ContextType,
    QualitativeObjectiveType,
    PerformanceHighlightType
} from '@/app/lib/constants/communityInspirations.constants';

// Reexportar tipos dos modelos Mongoose
export type {
    IUser,
    UserExpertiseLevel,
    IUserPreferences,
    IUserLongTermGoal,
    IUserKeyFact,
    IAlertHistoryEntry,
    AlertDetails,
} from '@/app/models/User';

export type {
    IMetric,
    IMetricStats,
} from '@/app/models/Metric';

export type {
    IAdDeal,
} from '@/app/models/AdDeal';

export type {
    IAccountInsight,
} from '@/app/models/AccountInsight';

export type {
    ICommunityInspiration,
    IInternalMetricsSnapshot,
} from '@/app/models/CommunityInspiration';

export type {
    IDailyMetricSnapshot,
} from '@/app/models/DailyMetricSnapshot';

// --- Tipos para Dados de Crescimento Detalhados ---
export interface HistoricalGrowth {
  followerChangeShortTerm?: number;
  followerGrowthRateShortTerm?: number;
  avgEngagementPerPostShortTerm?: number;
  avgReachPerPostShortTerm?: number;
}

export interface LongTermGrowth {
  monthlyFollowerTrend?: { month: string; followers: number }[];
  monthlyReachTrend?: { month: string; avgReach: number }[];
  monthlyEngagementTrend?: { month: string; avgEngagement: number }[];
}

export interface IGrowthDataResult {
  historical: HistoricalGrowth;
  longTerm: LongTermGrowth;
  dataIsPlaceholder?: boolean;
  reasonForPlaceholder?: string;
}

// --- Tipos e Interfaces Específicos do DataService ---
export interface IEnrichedReport {
    overallStats?: OverallStats;
    profileSegment: string;
    multimediaSuggestion: string;
    top3Posts?: Pick<LocalIMetric, '_id' | 'description' | 'postLink' | 'stats' | 'type' | 'format' | 'proposal' | 'context' | 'instagramMediaId'>[]; // Adicionado instagramMediaId
    bottom3Posts?: Pick<LocalIMetric, '_id' | 'description' | 'postLink' | 'stats' | 'type' | 'format' | 'proposal' | 'context' | 'instagramMediaId'>[]; // Adicionado instagramMediaId
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[];
    proposalStats?: ProposalStat[];
    contextStats?: ContextStat[];
    historicalComparisons?: HistoricalGrowth;
    longTermComparisons?: LongTermGrowth;
    performanceByDayPCO?: PerformanceByDayPCO;
    recentPosts?: PostObject[];
    dayOfWeekStats?: DayOfWeekStat[];
}

export interface PreparedData {
    enrichedReport: IEnrichedReport;
}

export interface ReferenceSearchPostData {
    _id: string;
    description: string;
    proposal?: ProposalType;
    context?: ContextType;
    format?: FormatType;
}

export type ReferenceSearchResult =
    | { status: 'found'; post: ReferenceSearchPostData }
    | { status: 'clarify'; message: string }
    | { status: 'error'; message: string };

export interface IGrowthComparisons {
    weeklyFollowerChange?: number;
    monthlyReachTrend?: 'up' | 'down' | 'stable';
}

export interface AdDealInsights {
    period: 'last30d' | 'last90d' | 'all';
    totalDeals: number;
    totalRevenueBRL: number;
    averageDealValueBRL?: number;
    commonBrandSegments: string[];
    avgValueByCompensation?: { [key: string]: number };
    commonDeliverables: string[];
    commonPlatforms: string[];
    dealsFrequency?: number;
}

/**
 * Filtros para buscar inspirações na comunidade.
 * ATUALIZADO v2.14.13: Usa tipos Enum para campos categóricos.
 */
export interface CommunityInspirationFilters {
  proposal?: ProposalType;
  context?: ContextType;
  format?: FormatType;
  primaryObjectiveAchieved_Qualitative?: QualitativeObjectiveType;
  performanceHighlights_Qualitative_INCLUDES_ANY?: PerformanceHighlightType[];
  performanceHighlights_Qualitative_CONTAINS?: string; 
  tags_IA?: string[];
}

/**
 * Representa um objeto de post simplificado.
 * ATUALIZADO v2.14.14: Adicionado instagramMediaId.
 * ATUALIZADO v2.14.13: Usa tipos Enum para campos categóricos.
 */
export interface PostObject {
    _id: string;
    userId: string;
    platformPostId?: string; // Pode coexistir se necessário, ou ser removido se instagramMediaId for o padrão nesta camada
    instagramMediaId?: string; // <-- ADICIONADO PARA CORRIGIR O ERRO EM reportService.ts
    type: string; 
    description?: string;
    postDate: Date | string;
    totalImpressions?: number;
    totalEngagement?: number;
    videoViews?: number;
    totalComments?: number;
    format?: FormatType;
    proposal?: ProposalType;
    context?: ContextType;
    stats?: LocalIMetricStats;
    tags?: string[];
}

/**
 * Critérios para a função findMetricsByCriteria.
 * ATUALIZADO v2.14.13: Usa tipos Enum para campos categóricos.
 */
export interface FindMetricsCriteria {
    format?: FormatType;
    proposal?: ProposalType;
    context?: ContextType;
    dateRange?: {
        start?: string; 
        end?: string;   
    };
    minLikes?: number;
    minShares?: number;
}

export interface FindMetricsCriteriaArgs {
    criteria: FindMetricsCriteria;
    limit?: number;
    sortBy?: 'postDate' | 'stats.shares' | 'stats.saved' | 'stats.likes' | 'stats.reach';
    sortOrder?: 'asc' | 'desc';
}

export interface MetricsHistoryDataset {
    label: string;
    data: number[];
}

export interface MetricsHistoryEntry {
    labels: string[];
    datasets: MetricsHistoryDataset[];
}

export interface MetricsHistory {
    engagementRate: MetricsHistoryEntry;
    propagationIndex: MetricsHistoryEntry;
    likeCommentRatio: MetricsHistoryEntry;
    saveRateOnReach: MetricsHistoryEntry;
    followerConversionRate: MetricsHistoryEntry;
    retentionRate: MetricsHistoryEntry;
    engagementDeepVsReach: MetricsHistoryEntry;
    engagementFastVsReach: MetricsHistoryEntry;
    likes: MetricsHistoryEntry;
    comments: MetricsHistoryEntry;
}

export interface FollowerTrendPoint {
    date: string;
    value: number | null;
}

export interface FollowerTrendData {
    chartData: FollowerTrendPoint[];
    insightSummary?: string;
}

export interface ReachEngagementTrendPoint {
    date: string;
    reach: number | null;
    totalInteractions: number | null;
}

export interface ReachEngagementTrendData {
    chartData: ReachEngagementTrendPoint[];
    insightSummary?: string;
}

export interface FpcTrendPoint {
    date: string;
    avgInteractions: number | null;
}

export interface FpcTrendData {
    chartData: FpcTrendPoint[];
    insightSummary?: string;
}
