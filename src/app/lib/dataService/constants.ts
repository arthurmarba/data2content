/**
 * @fileoverview Constantes utilizadas pelo dataService.
 * @version 2.14.5 (Adiciona constantes para períodos de análise de crescimento)
 */

// Número de dias padrão para buscar métricas ao gerar relatórios.
export const DEFAULT_METRICS_FETCH_DAYS = 180;

// Limite em dias para considerar um usuário como "novo".
export const NEW_USER_THRESHOLD_DAYS = 90;

// --- NOVAS CONSTANTES PARA ANÁLISE DE CRESCIMENTO ---
/**
 * Número de dias para retroceder ao analisar o crescimento de curto prazo (histórico recente).
 * Exemplo: 90 dias.
 */
export const GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS = 90;

/**
 * Número de meses para retroceder ao analisar tendências de crescimento de longo prazo.
 * Exemplo: 6 meses.
 */
export const GROWTH_ANALYSIS_PERIOD_LONG_TERM_MONTHS = 6;
