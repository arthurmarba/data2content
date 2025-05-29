/**
 * @fileoverview Ponto de entrada para o dataService modularizado.
 * Agrega e reexporta funcionalidades dos submódulos de serviço
 * (userService, reportService, communityService, etc.),
 * tipos e constantes partilhadas.
 * @version 2.14.12 (Adiciona findMetricsByCriteria à exportação)
 */

import { logger } from '@/app/lib/logger'; // Importado no início para uso abaixo

// ------------------------------------------------------------------
// Reexportar Tipos e Interfaces Públicos
// ------------------------------------------------------------------
// Todos os tipos e interfaces que são usados pela "API pública" do dataService
// devem ser exportados a partir de './types'.
// Isto exportará 'FindMetricsCriteriaArgs' de types.ts
export * from './types';

// ------------------------------------------------------------------
// Reexportar Constantes Públicas
// ------------------------------------------------------------------
// Constantes que podem ser úteis para os consumidores do dataService.
export * from './constants';

// ------------------------------------------------------------------
// Reexportar Funções dos Módulos de Serviço
// ------------------------------------------------------------------

// Funções relacionadas com Utilizadores
export * from './userService';

// Funções relacionadas com Relatórios e Métricas
// ATUALIZADO: Usar exportações nomeadas para evitar conflito com FindMetricsCriteriaArgs de './types'
// e para incluir funções que faltavam.
export {
    fetchAndPrepareReportData,
    getRecentPostObjects,
    getDailySnapshotsForMetric,
    getRecentPostObjectsWithAggregatedMetrics,
    getTopPostsByMetric,
    getMetricDetails,
    findMetricsByCriteria // ADICIONADO: Exportando a função que faltava agora
    // Adicione outras exportações de reportService aqui, conforme necessário
    // CERTIFIQUE-SE DE NÃO REEXPORTAR 'FindMetricsCriteriaArgs' daqui se ele já vem de './types'.
} from './reportService';
// Se você tiver certeza que './reportService.ts' não exporta 'FindMetricsCriteriaArgs'
// (e o erro é mais complexo devido a reexportações aninhadas),
// pode ser necessário investigar './reportService.ts' também.
// Se for mais simples e './reportService.ts' não deveria exportar tipos que já estão em './types.ts',
// a correção seria remover a exportação de FindMetricsCriteriaArgs de dentro de './reportService.ts'.

// Funções relacionadas com a Comunidade de Inspiração
export * from './communityService';

// Funções relacionadas com AdDeals (Negócios de Publicidade)
export * from './adDealService';

// Funções relacionadas com AccountInsights (Insights da Conta)
export * from './accountInsightService';

// A função de conexão `connectToDatabase` de './connection' é geralmente para uso interno
// dos serviços acima e não precisa ser exportada aqui, a menos que haja um caso de uso específico
// para controlá-la externamente, o que é raro.
// Se precisar dela publicamente:
// export { connectToDatabase } from './connection';

// As funções de './helpers' são, por definição, auxiliares internas e,
// geralmente, não devem fazer parte da API pública do dataService.
// Se alguma delas precisar ser pública, pode ser reexportada, mas isso deve ser avaliado.
// Exemplo (não recomendado a menos que necessário):
// export { getUserProfileSegment } from './helpers';

logger.info('[dataService][index] Módulos do dataService carregados e prontos para uso.');
