// src/app/lib/ruleEngine/rules/forgottenFormatRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types'; // Ajuste o caminho se necessário
import { IForgottenFormatDetails } from '@/app/models/User'; // Ajuste o caminho se necessário
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays } from 'date-fns';
import {
    FORMAT_ANALYSIS_PERIOD_DAYS,
    FORMAT_UNUSED_THRESHOLD_DAYS,
    FORMAT_MIN_POSTS_FOR_AVG, // Mínimo de posts em um formato para ser considerado
    FORMAT_PERFORMANCE_METRIC_KEY, // Chave da métrica de performance em PostObjectForAverage (ex: 'stats.engagementRate')
    FORMAT_PROMISSING_THRESHOLD_MULTIPLIER
} from '@/app/lib/constants';
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils'; // calculateAverageMetric pode ser útil

const RULE_ID = 'forgotten_format_promising_v1';

export const forgottenFormatRule: IRule = {
    id: RULE_ID,
    name: 'Formato Promissor Esquecido',
    description: 'Identifica classificações de conteúdo (formatos) que tiveram bom desempenho no passado mas não foram usados recentemente.',
    priority: 8,
    lookbackDays: FORMAT_ANALYSIS_PERIOD_DAYS, // e.g., 90 dias
    dataRequirements: [], // Nenhum além de allUserPosts
    resendCooldownDays: 21,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        // O relatório sugere FORMAT_MIN_POSTS_FOR_AVG (e.g. 3) para allUserPosts.
        // Mas é mais importante ter posts suficientes para a análise de *cada formato*.
        // Vamos manter um mínimo geral para allUserPosts também.
        if (allUserPosts.length < (FORMAT_MIN_POSTS_FOR_AVG * 2)) { // Ex: se min por formato é 3, precisa de pelo menos 6 posts totais
            logger.debug(`${detectionTAG} Não há posts suficientes (${allUserPosts.length}) no período de ${FORMAT_ANALYSIS_PERIOD_DAYS} dias para análise de formato.`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${allUserPosts.length} posts encontrados para análise de formato esquecido.`);

        const formatPerformance: {
            [key: string]: { totalMetricValue: number, count: number, lastUsed: Date, postsInFormat: PostObjectForAverage[] }
        } = {};

        for (const post of allUserPosts) {
            const currentFormat = post.format; // A classificação do conteúdo
            if (!currentFormat) {
                // logger.warn(`${detectionTAG} Post ${post._id} sem 'format' (classificação) definido, pulando na análise de formato.`);
                continue;
            }
            if (!formatPerformance[currentFormat]) {
                formatPerformance[currentFormat] = { totalMetricValue: 0, count: 0, lastUsed: new Date(0), postsInFormat: [] };
            }
            const perf = formatPerformance[currentFormat]!;
            // Acessar a métrica de performance dinamicamente
            const metricValue = (post as any)[FORMAT_PERFORMANCE_METRIC_KEY] ?? (post.stats as any)?.[FORMAT_PERFORMANCE_METRIC_KEY];


            if (typeof metricValue === 'number' && !isNaN(metricValue)) {
                perf.totalMetricValue += metricValue;
                perf.count++;
                perf.postsInFormat.push(post);
            }
            const postCreatedAt = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            if (postCreatedAt > perf.lastUsed) {
                perf.lastUsed = postCreatedAt;
            }
        }

        let bestForgottenFormatInfo: { format: string, avgMetric: number, daysSinceLastUsed: number } | null = null;

        for (const formatKey in formatPerformance) {
            const perfData = formatPerformance[formatKey]!;
            if (perfData.count < FORMAT_MIN_POSTS_FOR_AVG) { // Mínimo de posts para considerar um formato
                // logger.debug(`${detectionTAG} Formato '${formatKey}' tem apenas ${perfData.count} posts, mínimo é ${FORMAT_MIN_POSTS_FOR_AVG}. Pulando.`);
                continue;
            }

            const avgMetric = perfData.count > 0 ? perfData.totalMetricValue / perfData.count : 0;
            const daysSinceLastUsed = differenceInDays(today, perfData.lastUsed);

            if (daysSinceLastUsed > FORMAT_UNUSED_THRESHOLD_DAYS) {
                // logger.debug(`${detectionTAG} Formato '${formatKey}' (avg: ${avgMetric.toFixed(1)}, dias desde último uso: ${daysSinceLastUsed}) é candidato a esquecido.`);
                if (!bestForgottenFormatInfo || avgMetric > bestForgottenFormatInfo.avgMetric) {
                    bestForgottenFormatInfo = { format: formatKey, avgMetric, daysSinceLastUsed };
                }
            }
        }

        if (bestForgottenFormatInfo) {
            logger.debug(`${detectionTAG} Melhor formato esquecido: ${bestForgottenFormatInfo.format} (Média ${FORMAT_PERFORMANCE_METRIC_KEY}: ${bestForgottenFormatInfo.avgMetric.toFixed(1)}, Não usado há ${bestForgottenFormatInfo.daysSinceLastUsed} dias).`);
            
            const overallAvgPerformance = calculateAverageMetric(allUserPosts, FORMAT_PERFORMANCE_METRIC_KEY as keyof PostObjectForAverage);
            logger.debug(`${detectionTAG} Média geral de ${FORMAT_PERFORMANCE_METRIC_KEY}: ${overallAvgPerformance.toFixed(1)}.`);

            if (bestForgottenFormatInfo.avgMetric > (overallAvgPerformance * FORMAT_PROMISSING_THRESHOLD_MULTIPLIER) && bestForgottenFormatInfo.avgMetric > 0) {
                logger.debug(`${detectionTAG} Condição ATENDIDA.`);
                return {
                    isMet: true,
                    data: {
                        format: bestForgottenFormatInfo.format,
                        avgMetric: bestForgottenFormatInfo.avgMetric,
                        daysSinceLastUsed: bestForgottenFormatInfo.daysSinceLastUsed,
                        overallAvgPerformance,
                        metricUsed: FORMAT_PERFORMANCE_METRIC_KEY
                    }
                };
            } else {
                logger.debug(`${detectionTAG} Formato esquecido ${bestForgottenFormatInfo.format} (avg ${FORMAT_PERFORMANCE_METRIC_KEY}: ${bestForgottenFormatInfo.avgMetric.toFixed(1)}) não atingiu o limiar "promissor" (${(overallAvgPerformance * FORMAT_PROMISSING_THRESHOLD_MULTIPLIER).toFixed(1)}) em relação à média geral (${overallAvgPerformance.toFixed(1)}).`);
            }
        }
        logger.debug(`${detectionTAG} Nenhum formato promissor esquecido encontrado.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        if (!conditionData || !conditionData.format || typeof conditionData.avgMetric !== 'number' || typeof conditionData.daysSinceLastUsed !== 'number' || typeof conditionData.overallAvgPerformance !== 'number' || !conditionData.metricUsed) {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }
        const { format, avgMetric, daysSinceLastUsed, overallAvgPerformance, metricUsed } = conditionData;
        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento.`);

        const percentageSuperior = overallAvgPerformance > 0 ? ((avgMetric / overallAvgPerformance - 1) * 100) : (avgMetric > 0 ? 100 : 0);

        const details: IForgottenFormatDetails = {
            format,
            avgMetricValue: avgMetric,
            overallAvgPerformance,
            metricUsed,
            daysSinceLastUsed,
            percentageSuperior
        };

        const messageForAI = `Radar Tuca de olho! 👀 Percebi que faz uns ${daysSinceLastUsed} dias que você não usa o formato **${format}**. No passado, posts nesse formato tiveram um desempenho (${metricUsed}) em média ${percentageSuperior.toFixed(0)}% superior à sua média geral (${avgMetric.toFixed(0)} vs ${overallAvgPerformance.toFixed(0)} ${metricUsed}). Que tal revisitar esse formato?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
