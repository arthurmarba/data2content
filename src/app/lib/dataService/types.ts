/**
 * @fileoverview Definições de tipos e interfaces para o dataService.
 * @version 2.14.8 (Corrige erro 'Cannot find name IMetricStats')
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


// --- Tipos e Interfaces Específicos do DataService ---

/**
 * Representa a estrutura de um relatório enriquecido com dados processados.
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
    historicalComparisons?: IGrowthComparisons;
    longTermComparisons?: IGrowthComparisons;
    performanceByDayPCO?: PerformanceByDayPCO;
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
 * Comparações de crescimento (histórico e longo prazo).
 */
export interface IGrowthComparisons {
    weeklyFollowerChange?: number;
    monthlyReachTrend?: 'up' | 'down' | 'stable';
}

/**
 * Resultado dos dados de crescimento combinados.
 */
export interface IGrowthDataResult {
    historical?: IGrowthComparisons;
    longTerm?: IGrowthComparisons;
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
 * para funcionalidades como o Radar Tuca.
 */
export interface PostObject {
    _id: string; 
    userId: string; 
    platformPostId?: string; 
    type: 'IMAGE' | 'CAROUSEL' | 'REEL' | 'VIDEO' | 'STORY' | string; 
    description?: string; 
    createdAt: Date | string; 
    totalImpressions?: number;
    totalEngagement?: number;
    videoViews?: number;
    totalComments?: number; 
    format?: string;    
    proposal?: string;  
    context?: string;   
    // --- ATUALIZADO: Usa LocalIMetricStats importado ---
    stats?: LocalIMetricStats; 
}
