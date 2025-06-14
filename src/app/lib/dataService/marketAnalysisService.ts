/**
 * @fileoverview Ponto de entrada principal para os serviços de análise de mercado.
 * @version 1.0.0
 * @description Este arquivo reexporta todas as funções dos serviços modulares,
 * servindo como um ponto de acesso único e organizado para as funcionalidades
 * de análise de mercado.
 */

// Exporta todos os tipos e interfaces compartilhados
export * from './marketAnalysis/types';

// Exporta as funções relacionadas ao dashboard
export * from './marketAnalysis/dashboardService';

// Exporta as funções de ranking de criadores
export * from './marketAnalysis/rankingsService';

// Exporta as funções de busca de posts
export * from './marketAnalysis/postsService';

// Exporta as funções de busca de perfis
export * from './marketAnalysis/profilesService';

// Exporta as funções de dados de séries temporais
export * from './marketAnalysis/timeSeriesService';

// Exporta as funções de análise de "Top Movers"
export * from './marketAnalysis/moversService';

// Exporta as funções de análise de segmentos
export * from './marketAnalysis/segmentService';

// Exporta as funções do Radar Tuca
export * from './marketAnalysis/radarService';

// Exporta as funções de comparação de coortes
export * from './marketAnalysis/cohortsService';
