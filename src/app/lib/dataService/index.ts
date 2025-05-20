/**
 * @fileoverview Ponto de entrada para o dataService modularizado.
 * Agrega e reexporta funcionalidades dos submódulos de serviço
 * (userService, reportService, communityService, etc.),
 * tipos e constantes partilhadas.
 * @version 2.14.4
 */

// ------------------------------------------------------------------
// Reexportar Tipos e Interfaces Públicos
// ------------------------------------------------------------------
// Todos os tipos e interfaces que são usados pela "API pública" do dataService
// devem ser exportados a partir de './types'.
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
export * from './reportService';

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

// Para que o logger.info acima funcione, o logger precisa estar disponível neste escopo.
// Se não estiver (porque não é um módulo em si, mas sim um utilitário),
// pode remover esta linha de log ou importá-lo aqui também.
// Exemplo:
import { logger } from '@/app/lib/logger'; // Ajuste o caminho se necessário
