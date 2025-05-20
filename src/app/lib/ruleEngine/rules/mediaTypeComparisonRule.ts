// src/app/lib/ruleEngine/rules/mediaTypeComparisonRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IMediaTypeComparisonDetails, IMediaTypePerformance } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';
import {
    // Defina constantes para esta regra se necessário, ex:
    // MEDIA_TYPE_COMPARISON_LOOKBACK_DAYS, MEDIA_TYPE_COMPARISON_MIN_POSTS_PER_TYPE,
    // MEDIA_TYPE_COMPARISON_METRIC_KEY
    FORMAT_PERFORMANCE_METRIC_KEY, // Reutilizando, mas idealmente uma métrica mais de topo de funil como 'reach' ou 'totalImpressions'
} from '@/app/lib/constants';

const RULE_ID = 'media_type_performance_comparison_v1';

// Constantes específicas da regra
const MEDIA_TYPE_LOOKBACK_DAYS = 30;
const MEDIA_TYPE_MIN_POSTS_PER_TYPE = 3;
// Métrica chave para comparação. 'totalEngagement' ou 'totalImpressions' ou 'reach' podem ser boas opções.
// Ou uma taxa como engajamento / alcance.
const MEDIA_TYPE_COMPARISON_METRIC_KEY: keyof PostObjectForAverage | string = 'totalEngagement'; // Ou 'totalImpressions'
const MEDIA_TYPE_SIGNIFICANT_DIFFERENCE_THRESHOLD = 0.25; // 25% de diferença para ser considerado significativo

export const mediaTypeComparisonRule: IRule = {
    id: RULE_ID,
    name: 'Comparativo de Performance por Tipo de Mídia',
    description: 'Compara a performance média entre diferentes tipos de mídia (IMAGE, VIDEO, REEL, CAROUSEL_ALBUM) e destaca qual está performando melhor ou pior.',
    priority: 6,
    lookbackDays: MEDIA_TYPE_LOOKBACK_DAYS,
    dataRequirements: [], // Apenas allUserPosts
    resendCooldownDays: 28,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts } = context;
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        if (allUserPosts.length < MEDIA_TYPE_MIN_POSTS_PER_TYPE * 2) { // Precisa de posts suficientes para pelo menos dois tipos
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise comparativa de tipos de mídia.`);
            return { isMet: false };
        }

        const performanceByMediaType: IMediaTypePerformance[] = [];
        const postsByType: Record<string, PostObjectForAverage[]> = {};

        allUserPosts.forEach(post => {
            if (post.type && post.type !== 'UNKNOWN' && post.type !== 'STORY') { // Ignora tipos desconhecidos ou stories para esta análise
                if (!postsByType[post.type]) {
                    postsByType[post.type] = [];
                }
                postsByType[post.type]!.push(post);
            }
        });

        let typesAnalyzedCount = 0;
        for (const type in postsByType) {
            const postsInType = postsByType[type]!;
            if (postsInType.length >= MEDIA_TYPE_MIN_POSTS_PER_TYPE) {
                const avgMetricValue = calculateAverageMetric(postsInType, MEDIA_TYPE_COMPARISON_METRIC_KEY as keyof PostObjectForAverage);
                performanceByMediaType.push({
                    type,
                    avgMetricValue,
                    postCount: postsInType.length,
                    metricUsed: String(MEDIA_TYPE_COMPARISON_METRIC_KEY)
                });
                typesAnalyzedCount++;
            }
        }

        if (typesAnalyzedCount < 2) { // Precisa de pelo menos dois tipos com dados suficientes para comparar
            logger.debug(`${detectionTAG} Menos de dois tipos de mídia com posts suficientes para comparação.`);
            return { isMet: false };
        }

        // Ordena por performance para fácil identificação do melhor/pior
        performanceByMediaType.sort((a, b) => b.avgMetricValue - a.avgMetricValue);

        const bestPerforming = performanceByMediaType[0];
        const worstPerforming = performanceByMediaType[performanceByMediaType.length - 1];
        
        // Verifica se a diferença entre o melhor e o pior é significativa
        let isSignificantDifference = false;
        if (bestPerforming && worstPerforming && worstPerforming.avgMetricValue > 0) { // Evita divisão por zero
            if ((bestPerforming.avgMetricValue / worstPerforming.avgMetricValue - 1) >= MEDIA_TYPE_SIGNIFICANT_DIFFERENCE_THRESHOLD) {
                isSignificantDifference = true;
            }
        } else if (bestPerforming && worstPerforming && worstPerforming.avgMetricValue === 0 && bestPerforming.avgMetricValue > 0) {
            isSignificantDifference = true; // Se o pior é zero e o melhor não, é significativo
        }


        if (isSignificantDifference) {
            logger.debug(`${detectionTAG} Condição ATENDIDA. Diferença significativa encontrada entre tipos de mídia.`);
            const overallAverage = calculateAverageMetric(allUserPosts.filter(p => p.type && p.type !== 'UNKNOWN' && p.type !== 'STORY'), MEDIA_TYPE_COMPARISON_METRIC_KEY as keyof PostObjectForAverage);
            return {
                isMet: true,
                data: {
                    performanceByMediaType,
                    bestPerformingType: bestPerforming ? { type: bestPerforming.type, avgMetricValue: bestPerforming.avgMetricValue } : undefined,
                    worstPerformingType: worstPerforming ? { type: worstPerforming.type, avgMetricValue: worstPerforming.avgMetricValue } : undefined,
                    overallAverage,
                    metricUsed: String(MEDIA_TYPE_COMPARISON_METRIC_KEY)
                }
            };
        }

        logger.debug(`${detectionTAG} Nenhuma diferença significativa encontrada na performance entre tipos de mídia.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        if (!conditionData || !Array.isArray(conditionData.performanceByMediaType) || !conditionData.metricUsed) {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }

        const { performanceByMediaType, bestPerformingType, worstPerformingType, overallAverage, metricUsed } = conditionData as IMediaTypeComparisonDetails;
        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento.`);

        const details: IMediaTypeComparisonDetails = {
            performanceByMediaType: performanceByMediaType.map(p => ({...p, avgMetricValue: parseFloat(p.avgMetricValue.toFixed(2))})),
            bestPerformingType: bestPerformingType ? { ...bestPerformingType, avgMetricValue: parseFloat(bestPerformingType.avgMetricValue.toFixed(2))} : undefined,
            worstPerformingType: worstPerformingType ? { ...worstPerformingType, avgMetricValue: parseFloat(worstPerformingType.avgMetricValue.toFixed(2))} : undefined,
            overallAverage: overallAverage ? parseFloat(overallAverage.toFixed(2)) : undefined,
            metricUsed
        };
        
        let messageForAI = `Radar Tuca Comparando Formatos! 📊 Analisei o desempenho dos seus posts recentes por tipo de mídia, usando a métrica "${metricUsed}":\n`;
        details.performanceByMediaType.forEach(item => {
            messageForAI += `\n- **${item.type}** (${item.postCount} posts): Média de ${item.avgMetricValue.toFixed(1)} ${metricUsed}.`;
        });

        if (bestPerformingType && worstPerformingType && bestPerformingType.type !== worstPerformingType.type) {
            const diffPercentage = worstPerformingType.avgMetricValue > 0 ? ((bestPerformingType.avgMetricValue / worstPerformingType.avgMetricValue -1) * 100) : 100;
            messageForAI += `\n\nSeus posts do tipo **${bestPerformingType.type}** estão performando cerca de ${diffPercentage.toFixed(0)}% melhor que os do tipo **${worstPerformingType.type}**. `;
            messageForAI += `Pode ser interessante focar mais em conteúdo ${bestPerformingType.type} ou investigar por que ${worstPerformingType.type} não está performando tão bem.`;
        } else if (bestPerformingType) {
            messageForAI += `\n\nSeus posts do tipo **${bestPerformingType.type}** estão com o melhor desempenho atualmente!`;
        }
        if (details.overallAverage) {
            messageForAI += `\nPara referência, sua média geral de ${metricUsed} considerando todos os tipos foi de ${details.overallAverage.toFixed(1)}.`;
        }


        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
