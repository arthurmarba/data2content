// src/app/lib/ruleEngine/rules/forgottenFormatRule.ts
// MODIFICADO: v6 - Alterada métrica de performance para 'views' (via constants) e atualizada messageForAI.
// MODIFICADO: v5 - Corrigido erro de escopo de variável (perfData -> perf).
// MODIFICADO: v4 - Corrigido tipo de retorno da função extratora e import de IMetricStats.
// MODIFICADO: v3 - Adicionado tratamento para overallAvgPerformance nulo ou <= 0.
// MODIFICADO: v2 - Refatorado para usar FORMAT_PERFORMANCE_METRIC_KEY (de constants.ts) a partir de stats.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IForgottenFormatDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, isValid as isValidDate } from 'date-fns';
import {
    FORMAT_ANALYSIS_PERIOD_DAYS,
    FORMAT_UNUSED_THRESHOLD_DAYS,
    FORMAT_MIN_POSTS_FOR_AVG,
    FORMAT_PERFORMANCE_METRIC_KEY, // Espera-se 'views' de IMetricStats de constants.ts
    FORMAT_PROMISSING_THRESHOLD_MULTIPLIER
} from '@/app/lib/constants';
import { IMetricStats } from '@/app/models/Metric'; 
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';

const RULE_ID = 'forgotten_format_promising_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

// A métrica é definida pela constante global FORMAT_PERFORMANCE_METRIC_KEY
const METRIC_TO_USE_FOR_PERFORMANCE: keyof IMetricStats = FORMAT_PERFORMANCE_METRIC_KEY;

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

export const forgottenFormatRule: IRule = {
    id: RULE_ID,
    name: 'Formato Promissor Esquecido',
    description: 'Identifica classificações de conteúdo (formatos) que tiveram bom desempenho no passado mas não foram usados recentemente.',
    priority: 8,
    lookbackDays: FORMAT_ANALYSIS_PERIOD_DAYS,
    dataRequirements: [],
    resendCooldownDays: 21,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const currentRuleVersion = "forgottenFormatRule_v_CANVAS_METRIC_VIEWS_26_05_04_10"; // Nova string de versão
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição... Usando métrica: ${METRIC_TO_USE_FOR_PERFORMANCE}`); // Agora deve logar 'views'

        if (allUserPosts.length < (FORMAT_MIN_POSTS_FOR_AVG * 2)) {
            logger.debug(`${detectionTAG} Não há posts suficientes (${allUserPosts.length}) no período de ${FORMAT_ANALYSIS_PERIOD_DAYS} dias para análise de formato.`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${allUserPosts.length} posts encontrados para análise de formato esquecido.`);

        const formatPerformance: {
            [key: string]: { totalMetricValue: number, count: number, lastUsed: Date, postsInFormat: PostObjectForAverage[] }
        } = {};

        for (const post of allUserPosts) {
            const currentFormat = post.format;
            if (!currentFormat) {
                continue;
            }
            if (!post.stats) {
                logger.warn(`${detectionTAG} Post ${post._id} não possui 'stats', pulando na agregação de formato.`);
                continue;
            }
            if (!formatPerformance[currentFormat]) {
                formatPerformance[currentFormat] = { totalMetricValue: 0, count: 0, lastUsed: new Date(0), postsInFormat: [] };
            }
            const perf = formatPerformance[currentFormat]!;
            const rawMetricValue = post.stats?.[METRIC_TO_USE_FOR_PERFORMANCE]; // Usará 'views'
            const metricValue = (typeof rawMetricValue === 'number' && !isNaN(rawMetricValue)) ? rawMetricValue : 0;

            if (metricValue > 0 || perf.count === 0) { 
                 if (typeof metricValue === 'number' && !isNaN(metricValue)) { 
                    perf.totalMetricValue += metricValue;
                    perf.count++;
                    perf.postsInFormat.push(post);
                }
            } else if (typeof metricValue === 'number' && !isNaN(metricValue)) { 
                 perf.count++; 
                 perf.postsInFormat.push(post);
            }
            
            const postDateObj = getValidDate(post.postDate, post._id, detectionTAG);
            if (postDateObj && postDateObj > perf.lastUsed) {
                perf.lastUsed = postDateObj;
            }
        }

        let bestForgottenFormatInfo: { format: string, avgMetric: number, daysSinceLastUsed: number } | null = null;

        for (const formatKey in formatPerformance) {
            const perfData = formatPerformance[formatKey];
            if (!perfData || perfData.count < FORMAT_MIN_POSTS_FOR_AVG) {
                continue;
            }

            const avgMetric = perfData.count > 0 ? perfData.totalMetricValue / perfData.count : 0;
            const daysSinceLastUsed = perfData.lastUsed.getTime() === new Date(0).getTime() ? Infinity : differenceInDays(today, perfData.lastUsed);

            if (daysSinceLastUsed > FORMAT_UNUSED_THRESHOLD_DAYS) {
                if (!bestForgottenFormatInfo || avgMetric > bestForgottenFormatInfo.avgMetric) {
                    bestForgottenFormatInfo = { format: formatKey, avgMetric, daysSinceLastUsed };
                }
            }
        }

        if (bestForgottenFormatInfo) {
            logger.debug(`${detectionTAG} Melhor formato esquecido: ${bestForgottenFormatInfo.format} (Média ${METRIC_TO_USE_FOR_PERFORMANCE}: ${bestForgottenFormatInfo.avgMetric.toFixed(1)}, Não usado há ${bestForgottenFormatInfo.daysSinceLastUsed} dias).`);
            
            const metricExtractor = (p: PostObjectForAverage): number | undefined => {
                const value = p.stats?.[METRIC_TO_USE_FOR_PERFORMANCE]; // Usará 'views'
                if (typeof value === 'number' && !isNaN(value)) {
                    return value;
                }
                return undefined;
            };
            
            const overallAvgPerformance = calculateAverageMetric(
                allUserPosts.filter(p => !!p.stats), 
                metricExtractor
            );

            if (overallAvgPerformance === null) {
                logger.warn(`${detectionTAG} Média geral de performance (${METRIC_TO_USE_FOR_PERFORMANCE}) não pôde ser calculada (calculateAverageMetric retornou null).`);
                return { isMet: false };
            }
            if (overallAvgPerformance <= 0 && bestForgottenFormatInfo.avgMetric <=0) { 
                logger.debug(`${detectionTAG} Média geral de performance (${METRIC_TO_USE_FOR_PERFORMANCE}) e do formato esquecido são zero ou negativas. Pulando regra.`);
                return { isMet: false };
            }
            logger.debug(`${detectionTAG} Média geral de ${METRIC_TO_USE_FOR_PERFORMANCE}: ${overallAvgPerformance.toFixed(1)}.`);

            if (bestForgottenFormatInfo.avgMetric > (overallAvgPerformance * FORMAT_PROMISSING_THRESHOLD_MULTIPLIER)) {
                 // A condição original `&& bestForgottenFormatInfo.avgMetric > 0` é redundante se overallAvgPerformance é > 0
                 // e o multiplicador é > 1, ou se overallAvgPerformance é <=0 mas avgMetric é > 0.
                 // Mantendo a lógica original de que o formato esquecido precisa ter tido alguma performance.
                if (bestForgottenFormatInfo.avgMetric > 0) {
                    logger.debug(`${detectionTAG} Condição ATENDIDA.`);
                    return {
                        isMet: true,
                        data: {
                            format: bestForgottenFormatInfo.format,
                            avgMetric: bestForgottenFormatInfo.avgMetric,
                            daysSinceLastUsed: bestForgottenFormatInfo.daysSinceLastUsed,
                            overallAvgPerformance,
                            metricUsed: METRIC_TO_USE_FOR_PERFORMANCE as string
                        }
                    };
                } else {
                     logger.debug(`${detectionTAG} Formato esquecido ${bestForgottenFormatInfo.format} teve média de performance zero ou negativa, não considerando como promissor.`);
                }
            } else {
                logger.debug(`${detectionTAG} Formato esquecido ${bestForgottenFormatInfo.format} (avg ${METRIC_TO_USE_FOR_PERFORMANCE}: ${bestForgottenFormatInfo.avgMetric.toFixed(1)}) não atingiu o limiar "promissor" (${(overallAvgPerformance * FORMAT_PROMISSING_THRESHOLD_MULTIPLIER).toFixed(1)}) em relação à média geral (${overallAvgPerformance.toFixed(1)}).`);
            }
        }
        logger.debug(`${detectionTAG} Nenhum formato promissor esquecido encontrado.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
        if (!conditionData || !conditionData.format || typeof conditionData.avgMetric !== 'number' || typeof conditionData.daysSinceLastUsed !== 'number' || typeof conditionData.overallAvgPerformance !== 'number' || !conditionData.metricUsed) {
            logger.error(`${actionTAG} conditionData inválido ou incompleto.`);
            return null;
        }
        const { format, avgMetric, daysSinceLastUsed, overallAvgPerformance, metricUsed } = conditionData;
        
        logger.info(`${actionTAG} Gerando evento.`);

        const percentageSuperior = overallAvgPerformance > 0 ? ((avgMetric / overallAvgPerformance - 1) * 100) : (avgMetric > 0 ? 100 : 0);

        const details: IForgottenFormatDetails = {
            format,
            avgMetricValue: avgMetric,
            overallAvgPerformance,
            metricUsed, // Será 'views' se FORMAT_PERFORMANCE_METRIC_KEY foi atualizado em constants.ts
            daysSinceLastUsed,
            percentageSuperior
        };
        
        // MODIFICADO: Ajustado metricDisplayName para incluir 'views'
        let metricDisplayName = metricUsed;
        if (metricUsed === 'total_interactions') {
            metricDisplayName = 'interações totais';
        } else if (metricUsed === 'impressions') {
            metricDisplayName = 'impressões';
        } else if (metricUsed === 'views') {
            metricDisplayName = 'visualizações';
        }

        const messageForAI = `Radar Tuca de olho! 👀 Percebi que faz uns ${daysSinceLastUsed} dias que você não usa o formato **${format}**. No passado, posts nesse formato tiveram um desempenho (${metricDisplayName}) em média ${percentageSuperior.toFixed(0)}% superior à sua média geral (${avgMetric.toFixed(0)} vs ${overallAvgPerformance.toFixed(0)} ${metricDisplayName}). Que tal revisitar esse formato?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
