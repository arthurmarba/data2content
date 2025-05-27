// @/app/lib/fallbackInsightService/fallbackInsight.types.ts
import type { IUser } from '@/app/models/User';
import type { IMetric, IMetricStats as DirectIMetricStatsOriginal } from '@/app/models/Metric';
import type { Types } from 'mongoose'; // Import Types for ObjectId
import type {
    IEnrichedReport as OriginalEnrichedReport,
    IAccountInsight as OriginalAccountInsight,
    PostObject as OriginalPostObject,
    HistoricalGrowth as OriginalHistoricalGrowth,
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

/**
 * Define a estrutura esperada para os snapshots diários de métricas,
 * alinhada com IDailyMetricSnapshot de DailyMetricSnapshot.ts.
 * Esta interface é baseada nas propriedades acessadas nas funções geradoras de insight
 * e agora expandida para incluir todas as métricas disponíveis.
 */
export interface DailySnapshot {
  // Campos de IDailyMetricSnapshot
  metric?: Types.ObjectId | IMetricModel; // Referência à métrica original
  date?: Date; // Data do snapshot

  /**
   * O número do dia do snapshot em relação à data de criação do post original.
   * Ex: Dia 1, Dia 2, etc. Começa em 1.
   */
  dayNumber?: number;

  // --- Métricas DELTA (Variação *NAQUELE DIA*) ---
  dailyViews?: number;
  dailyLikes?: number;
  dailyComments?: number;
  dailyShares?: number;
  dailySaved?: number;
  dailyReach?: number;
  dailyFollows?: number;
  dailyProfileVisits?: number;
  dailyReelsVideoViewTotalTime?: number; // Delta diário do tempo total de visualização de Reels
  dailyImpressions?: number; // Mantido, embora não explicitamente em IDailyMetricSnapshot como delta, mas usado

  // --- Métricas CUMULATIVAS (Total *ATÉ O FINAL* daquele dia) ---
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

  // --- Métricas PONTUAIS/MÉDIAS (Valor do dia) ---
  currentReelsAvgWatchTime?: number; // Tempo médio de visualização de Reels

  // Adicione outras propriedades de snapshot diário conforme necessário
  // Se alguma métrica delta do IDailyMetricSnapshot não estiver aqui e for necessária,
  // ela deve ser adicionada.
}

// Reexportando ou redefinindo tipos para uso interno do serviço de fallback
export type IUserModel = IUser;
export type IMetricModel = IMetric; // IMetric é a interface de Metric.ts
export type IMetricStats = DirectIMetricStatsOriginal;
export type IEnrichedReport = OriginalEnrichedReport;
export type IAccountInsight = OriginalAccountInsight;
export type PostObject = OriginalPostObject;
export type HistoricalGrowth = OriginalHistoricalGrowth;
// DailySnapshot é agora definido localmente acima e otimizado
export type DayOfWeekStat = OriginalDayOfWeekStat;
export type DetailedContentStat = OriginalDetailedContentStat;
export type DurationStat = OriginalDurationStat;
export type IDialogueState = OriginalDialogueState;
export type IFallbackInsightHistoryEntry = OriginalHistoryEntry;
export type FallbackInsightType = OriginalFallbackInsightType;

/**
 * Representa um insight potencial que pode ser gerado.
 */
export interface PotentialInsight {
    text: string;
    type: FallbackInsightType;
}

// Adicione quaisquer outros tipos específicos que possam surgir durante a refatoração.
