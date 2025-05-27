/**
 * @fileoverview Definições de tipos e interfaces para o dataService.
 * @version 2.14.12 (Adiciona dayOfWeekStats à interface IEnrichedReport)
 */
import { Types } from 'mongoose';

// Importar tipos de utilitários ou bibliotecas externas, se necessário
// Exemplo: import { SomeType } from 'some-library';

// Importar tipos de helpers do seu projeto
// Certifique-se de que o caminho para reportHelpers está correto.
import type { // Usa 'import type' se reportHelpers só exporta tipos
    OverallStats,
    DurationStat,
    DetailedContentStat,
    ProposalStat,
    ContextStat,
    PerformanceByDayPCO,
    DayOfWeekStat // MODIFICADO: Adicionado DayOfWeekStat explicitamente à importação
} from '@/app/lib/reportHelpers'; // Ajuste o caminho se necessário

// --- ATUALIZADO: Adicionar importação direta de IMetric e IMetricStats para uso interno ---
import type { IMetric as LocalIMetric, IMetricStats as LocalIMetricStats } from '@/app/models/Metric'; // Importa IMetric e IMetricStats localmente

// Reexportar tipos dos modelos Mongoose que são usados na interface pública do dataService.
// Ajuste os caminhos para os seus modelos conforme a estrutura do seu projeto.
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
    IMetric, // Continua reexportando IMetric
    IMetricStats, // Continua reexportando IMetricStats
} from '@/app/models/Metric';

export type {
    IAdDeal,
} from '@/app/models/AdDeal';

export type {
    IAccountInsight,
} from '@/app/models/AccountInsight';

export type {
    ICommunityInspiration,
} from '@/app/models/CommunityInspiration';

export type {
    IDailyMetricSnapshot,
} from '@/app/models/DailyMetricSnapshot';
// export type { IStoryMetric } from '@/app/models/StoryMetric';


// --- Tipos para Dados de Crescimento Detalhados ---

/**
 * Métricas de crescimento de curto prazo (histórico recente).
 */
export interface HistoricalGrowth {
  followerChangeShortTerm?: number;       // Variação numérica de seguidores no período.
  followerGrowthRateShortTerm?: number;   // Taxa de crescimento de seguidores em % no período.
  avgEngagementPerPostShortTerm?: number; // Média de engajamento por post no período.
  avgReachPerPostShortTerm?: number;      // Média de alcance por post no período.
  // Adicionar outras métricas de curto prazo relevantes conforme necessário
}

/**
 * Métricas de crescimento de longo prazo (tendências).
 */
export interface LongTermGrowth {
  monthlyFollowerTrend?: { month: string; followers: number }[];      // Tendência mensal de seguidores.
  monthlyReachTrend?: { month: string; avgReach: number }[];          // Tendência mensal de alcance médio por post.
  monthlyEngagementTrend?: { month: string; avgEngagement: number }[];// Tendência mensal de engajamento médio por post.
  // Adicionar outras tendências de longo prazo relevantes conforme necessário
}

/**
 * Resultado dos dados de crescimento combinados, agora usando as estruturas detalhadas.
 * Substitui a definição anterior de IGrowthDataResult que usava IGrowthComparisons.
 */
export interface IGrowthDataResult {
  historical: HistoricalGrowth; // Usa a estrutura detalhada
  longTerm: LongTermGrowth;     // Usa a estrutura detalhada
  dataIsPlaceholder?: boolean;
  reasonForPlaceholder?: string;
}


// --- Tipos e Interfaces Específicos do DataService (Continuação) ---

/**
 * Representa a estrutura de um relatório enriquecido com dados processados.
 * Atualizado para usar HistoricalGrowth e LongTermGrowth.
 * MODIFICADO v2.14.12: Adicionado dayOfWeekStats à interface IEnrichedReport.
 */
export interface IEnrichedReport {
    overallStats?: OverallStats;
    profileSegment: string;
    multimediaSuggestion: string;
    top3Posts?: Pick<LocalIMetric, '_id' | 'description' | 'postLink' | 'stats'>[];
    bottom3Posts?: Pick<LocalIMetric, '_id' | 'description' | 'postLink' | 'stats'>[];
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[];
    proposalStats?: ProposalStat[];
    contextStats?: ContextStat[];
    historicalComparisons?: HistoricalGrowth;
    longTermComparisons?: LongTermGrowth;
    performanceByDayPCO?: PerformanceByDayPCO;
    recentPosts?: PostObject[];
    dayOfWeekStats?: DayOfWeekStat[]; // NOVO CAMPO ADICIONADO
}

/**
 * Estrutura dos dados preparados pela função fetchAndPrepareReportData.
 */
export interface PreparedData {
    enrichedReport: IEnrichedReport;
}

/**
 * Estrutura para o objeto post retornado em ReferenceSearchResult quando encontrado.
 */
export interface ReferenceSearchPostData {
    _id: string;
    description: string;
    proposal?: string;
    context?: string;
    format?: string;
}

/**
 * Resultado da busca por um post referenciado em texto.
 */
export type ReferenceSearchResult =
    | { status: 'found'; post: ReferenceSearchPostData }
    | { status: 'clarify'; message: string }
    | { status: 'error'; message: string };

/**
 * Comparações de crescimento (histórico e longo prazo) - Estrutura original.
 */
export interface IGrowthComparisons {
    weeklyFollowerChange?: number;
    monthlyReachTrend?: 'up' | 'down' | 'stable';
}

/**
 * Insights derivados de AdDeals (negócios de publicidade).
 */
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
 */
export interface CommunityInspirationFilters {
  proposal?: string;
  context?: string;
  format?: string;
  primaryObjectiveAchieved_Qualitative?: string;
  performanceHighlights_Qualitative_CONTAINS?: string;
  tags_IA?: string[];
  limit?: number;
}

/**
 * Representa um objeto de post simplificado, usado internamente
 * para funcionalidades como o Radar Tuca e insights de fallback.
 */
export interface PostObject {
    _id: string;
    userId: string;
    platformPostId?: string;
    type: 'IMAGE' | 'CAROUSEL' | 'REEL' | 'VIDEO' | 'STORY' | string;
    description?: string;
    postDate: Date | string; 
    totalImpressions?: number;
    totalEngagement?: number;
    videoViews?: number;
    totalComments?: number;
    format?: string;
    proposal?: string;
    context?: string;
    stats?: LocalIMetricStats;
    tags?: string[]; 
}
