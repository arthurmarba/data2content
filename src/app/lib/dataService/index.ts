/**
 * @fileoverview Ponto de entrada para o dataService modularizado.
 * Agrega e reexporta funcionalidades dos submódulos de serviço.
 * @version 2.15.0 (Adiciona exportação do rankingsService)
 */

import { logger } from '@/app/lib/logger';

// ------------------------------------------------------------------
// Reexportar Tipos e Interfaces Públicos
// ------------------------------------------------------------------
export * from './types';

// ------------------------------------------------------------------
// Reexportar Constantes Públicas
// ------------------------------------------------------------------
export * from './constants';

// ------------------------------------------------------------------
// Reexportar Funções dos Módulos de Serviço
// ------------------------------------------------------------------

// Funções relacionadas com Utilizadores
export * from './userService';

// Funções relacionadas com Relatórios e Métricas
export {
    fetchAndPrepareReportData,
    getRecentPostObjects,
    getDailySnapshotsForMetric,
    getRecentPostObjectsWithAggregatedMetrics,
    getTopPostsByMetric,
    getMetricDetails,
    findMetricsByCriteria,
    getMetricsHistory
} from './reportService';

// Funções relacionadas com a Comunidade de Inspiração
export * from './communityService';
export { getInspirationsWeighted } from './communityService';

// Funções relacionadas com AdDeals (Negócios de Publicidade)
export * from './adDealService';

// Funções relacionadas com AccountInsights (Insights da Conta)
export * from './accountInsightService';
// Funções relacionadas com dados demográficos da audiência
export * from './demographicService';

// --- (NOVO) Funções relacionadas com Rankings de Categorias ---
// Adicionando a exportação da nossa nova função para torná-la visível.
export {
    fetchTopCategories,
    fetchAvgEngagementPerPostCreators,
    fetchAvgReachPerPostCreators,
    fetchEngagementVariationCreators,
    fetchPerformanceConsistencyCreators,
    fetchReachPerFollowerCreators
} from './marketAnalysis/rankingsService';
// -------------------------------------------------------------

// Funções de tendências (followers, alcance e engajamento)
export {
    getFollowerTrend,
    getReachEngagementTrend,
    getFpcTrend
} from './trendService';
// -------------------------------------------------------------

export {
    fetchTopActiveUsers,
    fetchUserUsageTrend
} from './usageService';

logger.info('[dataService][index] Módulos do dataService carregados e prontos para uso.')
