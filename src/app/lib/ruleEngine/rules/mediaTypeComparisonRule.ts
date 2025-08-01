// src/app/lib/ruleEngine/rules/mediaTypeComparisonRule.ts
// MODIFICADO: v4 - Corrigido tipo de retorno da função extratora e import de IMetricStats.
// MODIFICADO: v3 - Adicionado tratamento para retorno null de calculateAverageMetric.
// MODIFICADO: v2 - Refatorado para usar stats.total_interactions.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IMediaTypeComparisonDetails, IMediaTypePerformance } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
// MODIFICADO: IMetricStats importado de @/app/models/Metric
import { IMetricStats } from '@/app/models/Metric'; 
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';
import { parseISO, isValid as isValidDate } from 'date-fns';

const RULE_ID = 'media_type_performance_comparison_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

// Constantes específicas da regra
const MEDIA_TYPE_LOOKBACK_DAYS = 30;
const MEDIA_TYPE_MIN_POSTS_PER_TYPE = 3;
const METRIC_TO_USE_FOR_PERFORMANCE: keyof IMetricStats = 'total_interactions';
const MEDIA_TYPE_SIGNIFICANT_DIFFERENCE_THRESHOLD = 0.25;

function getValidDate(dateInput: Date | string | undefined, postId?: string, tag?: string): Date | null {
    const logTag = tag || RULE_TAG_BASE;
    if (!dateInput) {
        return null;
    }
    if (dateInput instanceof Date) {
        if (isValidDate(dateInput)) return dateInput;
        if (postId) logger.warn(`${logTag} Post ${postId} tem objeto Date inválido: ${dateInput}`);
        return null;
    }
    if (typeof dateInput === 'string') {
        try {
            const parsedDate = parseISO(dateInput);
            if (isValidDate(parsedDate)) return parsedDate;
            if (postId) logger.warn(`${logTag} Post ${postId} tem string de data inválida para parseISO: ${dateInput}`);
            return null;
        } catch (e) {
            if (postId) logger.warn(`${logTag} Post ${postId} erro ao parsear string de data: ${dateInput}`, e);
            return null;
        }
    }
    if (postId) logger.warn(`${logTag} Post ${postId} tem data em formato inesperado: ${typeof dateInput}`);
    return null;
}

export const mediaTypeComparisonRule: IRule = {
    id: RULE_ID,
    name: 'Comparativo de Performance por Tipo de Mídia',
    description: 'Compara a performance média entre diferentes tipos de mídia (IMAGE, VIDEO, REEL, CAROUSEL_ALBUM) e destaca qual está performando melhor ou pior.',
    priority: 6,
    lookbackDays: MEDIA_TYPE_LOOKBACK_DAYS,
    dataRequirements: [],
    resendCooldownDays: 28,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts } = context;
        const currentRuleVersion = "mediaTypeComparisonRule_v_CANVAS_EXTRACTOR_FIX_26_05_03_30"; // Nova string de versão
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição... Usando métrica: ${METRIC_TO_USE_FOR_PERFORMANCE}`);

        if (allUserPosts.length < MEDIA_TYPE_MIN_POSTS_PER_TYPE * 2) {
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise comparativa de tipos de mídia.`);
            return { isMet: false };
        }

        const performanceByMediaType: IMediaTypePerformance[] = [];
        const postsByType: Record<string, PostObjectForAverage[]> = {};

        allUserPosts.forEach(post => {
            const postDateObj = getValidDate(post.postDate, post._id, detectionTAG);
            if (post.type && post.type !== 'UNKNOWN' && post.type !== 'STORY' && postDateObj && post.stats) {
                if (!postsByType[post.type]) {
                    postsByType[post.type] = [];
                }
                postsByType[post.type]!.push(post);
            }
        });

        // MODIFICADO: Definindo a função extratora com tipo de retorno explícito
        const metricExtractor = (p: PostObjectForAverage): number | undefined => {
            const value = p.stats?.[METRIC_TO_USE_FOR_PERFORMANCE];
            if (typeof value === 'number' && !isNaN(value)) {
                return value;
            }
            return undefined;
        };

        let typesAnalyzedCount = 0;
        for (const type in postsByType) {
            const postsInType = postsByType[type]!;
            if (postsInType.length >= MEDIA_TYPE_MIN_POSTS_PER_TYPE) {
                const avgMetricValue = calculateAverageMetric(
                    postsInType,
                    metricExtractor // Usando a função extratora definida
                );
                
                if (avgMetricValue === null) {
                    logger.debug(`${detectionTAG} Média (${METRIC_TO_USE_FOR_PERFORMANCE}) para o tipo ${type} não pôde ser calculada (calculateAverageMetric retornou null).`);
                    continue; 
                }
                performanceByMediaType.push({
                    type,
                    avgMetricValue,
                    postCount: postsInType.length,
                    metricUsed: METRIC_TO_USE_FOR_PERFORMANCE
                });
                typesAnalyzedCount++;
            }
        }

        if (typesAnalyzedCount < 2) {
            logger.debug(`${detectionTAG} Menos de dois tipos de mídia com posts suficientes ou métricas válidas para comparação.`);
            return { isMet: false };
        }

        performanceByMediaType.sort((a, b) => b.avgMetricValue - a.avgMetricValue);

        const bestPerforming = performanceByMediaType[0];
        const worstPerforming = performanceByMediaType[performanceByMediaType.length - 1];
        
        let isSignificantDifference = false;
        if (bestPerforming && worstPerforming && bestPerforming.type !== worstPerforming.type) {
            if (worstPerforming.avgMetricValue > 0) {
                if ((bestPerforming.avgMetricValue / worstPerforming.avgMetricValue - 1) >= MEDIA_TYPE_SIGNIFICANT_DIFFERENCE_THRESHOLD) {
                    isSignificantDifference = true;
                }
            } else if (bestPerforming.avgMetricValue > 0) { 
                isSignificantDifference = true;
            }
        }

        if (isSignificantDifference) {
            logger.debug(`${detectionTAG} Condição ATENDIDA. Diferença significativa encontrada entre tipos de mídia.`);
            const allValidPostsForOverallAvg = allUserPosts.filter(p => {
                const postDateObj = getValidDate(p.postDate, p._id, detectionTAG);
                return p.type && p.type !== 'UNKNOWN' && p.type !== 'STORY' && postDateObj && p.stats;
            });
            
            const overallAverage = calculateAverageMetric(
                allValidPostsForOverallAvg,
                metricExtractor // Usando a função extratora definida
            );

            return {
                isMet: true,
                data: {
                    performanceByMediaType,
                    bestPerformingType: bestPerforming ? { type: bestPerforming.type, avgMetricValue: bestPerforming.avgMetricValue } : undefined,
                    worstPerformingType: worstPerforming ? { type: worstPerforming.type, avgMetricValue: worstPerforming.avgMetricValue } : undefined,
                    overallAverage: overallAverage, 
                    metricUsed: METRIC_TO_USE_FOR_PERFORMANCE
                }
            };
        }

        logger.debug(`${detectionTAG} Nenhuma diferença significativa encontrada na performance entre tipos de mídia.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
        if (!conditionData || !Array.isArray(conditionData.performanceByMediaType) || !conditionData.metricUsed) {
            logger.error(`${actionTAG} conditionData inválido ou incompleto: ${JSON.stringify(conditionData)}`);
            return null;
        }

        const { performanceByMediaType, bestPerformingType, worstPerformingType, overallAverage, metricUsed } = conditionData as IMediaTypeComparisonDetails;
        
        if (typeof metricUsed !== 'string') {
             logger.error(`${actionTAG} metricUsed inválido em conditionData: ${JSON.stringify(conditionData)}`);
            return null;
        }

        logger.info(`${actionTAG} Gerando evento.`);

        const formatPerformanceData = (item: IMediaTypePerformance) => ({
            ...item,
            avgMetricValue: typeof item.avgMetricValue === 'number' ? parseFloat(item.avgMetricValue.toFixed(2)) : 0 
        });

        const details: IMediaTypeComparisonDetails = {
            performanceByMediaType: performanceByMediaType.map(formatPerformanceData),
            bestPerformingType: bestPerformingType && typeof bestPerformingType.avgMetricValue === 'number' ? 
                { ...bestPerformingType, avgMetricValue: parseFloat(bestPerformingType.avgMetricValue.toFixed(2))} : undefined,
            worstPerformingType: worstPerformingType && typeof worstPerformingType.avgMetricValue === 'number' ? 
                { ...worstPerformingType, avgMetricValue: parseFloat(worstPerformingType.avgMetricValue.toFixed(2))} : undefined,
            overallAverage: typeof overallAverage === 'number' ? parseFloat(overallAverage.toFixed(2)) : undefined, 
            metricUsed
        };
        
        let metricDisplayName = metricUsed;
        if (metricUsed === 'total_interactions') {
            metricDisplayName = 'interações totais';
        } else if (metricUsed === 'impressions') {
            metricDisplayName = 'impressões';
        }

        let messageForAI = `Radar Mobi Comparando Formatos! 📊 Analisei o desempenho dos seus posts recentes por tipo de mídia, usando a métrica "${metricDisplayName}":\n`;
        details.performanceByMediaType.forEach(item => {
            messageForAI += `\n- **${item.type}** (${item.postCount} posts): Média de ${item.avgMetricValue.toFixed(0)} ${metricDisplayName}.`;
        });

        if (details.bestPerformingType && details.worstPerformingType && details.bestPerformingType.type !== details.worstPerformingType.type) {
            let diffPercentage = 0;
            if (details.worstPerformingType.avgMetricValue > 0) { 
                diffPercentage = ((details.bestPerformingType.avgMetricValue / details.worstPerformingType.avgMetricValue -1) * 100);
            } else if (details.bestPerformingType.avgMetricValue > 0) {
                diffPercentage = 100;
            }

            if (diffPercentage >= (MEDIA_TYPE_SIGNIFICANT_DIFFERENCE_THRESHOLD * 100) || (details.worstPerformingType.avgMetricValue === 0 && details.bestPerformingType.avgMetricValue > 0) ) {
                 messageForAI += `\n\nSeus posts do tipo **${details.bestPerformingType.type}** estão performando cerca de ${diffPercentage.toFixed(0)}% melhor que os do tipo **${details.worstPerformingType.type}**. `;
                 messageForAI += `Pode ser interessante focar mais em conteúdo ${details.bestPerformingType.type} ou investigar por que ${details.worstPerformingType.type} não está performando tão bem.`;
            }
        } else if (details.bestPerformingType) {
            messageForAI += `\n\nSeus posts do tipo **${details.bestPerformingType.type}** estão com o melhor desempenho atualmente!`;
        }
        
        if (details.overallAverage !== undefined) { 
            messageForAI += `\nPara referência, sua média geral de ${metricDisplayName} considerando todos os tipos foi de ${details.overallAverage.toFixed(0)}.`;
        }

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
