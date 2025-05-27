// src/app/lib/ruleEngine/rules/bestDayFormatEngagementRule.ts
// MODIFICADO: v6 - Corrigida derivação de metricValue para garantir que seja sempre number.
// MODIFICADO: v5 - Corrigido tipo de retorno da função extratora para calculateAverageMetric.
// MODIFICADO: v4 - Corrigido import de IMetricStats.
// MODIFICADO: v3 - Adicionado tratamento para retorno null de calculateAverageMetric.
// MODIFICADO: v2 - Refatorado para usar stats.total_interactions.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IBestDayFormatDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, getDay, isValid as isValidDate } from 'date-fns';
import { IMetricStats } from '@/app/models/Metric'; 
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';

const RULE_ID = 'best_day_format_engagement_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

// Constantes da Regra
const BEST_DAY_FORMAT_LOOKBACK_DAYS = 90;
const BEST_DAY_FORMAT_MIN_POSTS_PER_SLOT = 3;
const BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_FORMAT_AVG = 1.3;
const BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_OVERALL_AVG = 1.5;
const BEST_DAY_FORMAT_RECENT_POST_THRESHOLD_WEEKS = 2;
const METRIC_TO_USE_FOR_PERFORMANCE: keyof IMetricStats = 'total_interactions';

function getDayName(date: Date): string {
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dayIndex = getDay(date);
    return dayNames[dayIndex] || "Dia Desconhecido";
}

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

interface SlotPerformance {
    format: string;
    dayOfWeek: number;
    dayName: string;
    totalMetricValue: number;
    count: number;
    avgMetricValue: number;
    postsInSlot: PostObjectForAverage[];
}

export const bestDayFormatEngagementRule: IRule = {
    id: RULE_ID,
    name: 'Melhor Dia e Formato para Engajamento',
    description: 'Identifica combinações de Dia da Semana e Formato que consistentemente geram maior engajamento e alerta se não foram usados recentemente.',
    priority: 6,
    lookbackDays: BEST_DAY_FORMAT_LOOKBACK_DAYS,
    dataRequirements: [],
    resendCooldownDays: 28,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const currentRuleVersion = "bestDayFormatEngagementRule_v_CANVAS_METRIC_VALUE_FIX_26_05_03_15"; // Nova string de versão
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição...`);

        if (allUserPosts.length < BEST_DAY_FORMAT_MIN_POSTS_PER_SLOT * 3) {
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise de melhor dia/formato.`);
            return { isMet: false };
        }

        const metricExtractor = (post: PostObjectForAverage): number | undefined => {
            const value = post.stats?.[METRIC_TO_USE_FOR_PERFORMANCE];
            if (typeof value === 'number' && !isNaN(value)) {
                return value;
            }
            return undefined;
        };

        const overallAvgPerformance = calculateAverageMetric(
            allUserPosts,
            metricExtractor
        );

        if (overallAvgPerformance === null) {
            logger.debug(`${detectionTAG} Média geral de performance (${METRIC_TO_USE_FOR_PERFORMANCE}) não pôde ser calculada (calculateAverageMetric retornou null). Pulando regra.`);
            return { isMet: false };
        }
        if (overallAvgPerformance === 0) {
             logger.debug(`${detectionTAG} Média geral de performance (${METRIC_TO_USE_FOR_PERFORMANCE}) é zero. A regra pode não ser significativa. Pulando regra.`);
            return { isMet: false };
        }

        const performanceBySlot: SlotPerformance[] = [];
        const postsByFormat: Record<string, PostObjectForAverage[]> = {};

        allUserPosts.forEach(post => {
            if (!post.format) return;
            const postDateObj = getValidDate(post.postDate, post._id, detectionTAG);
            if (!postDateObj) return;
            if (!post.stats) {
                logger.warn(`${detectionTAG} Post ${post._id} não possui 'stats', pulando na agregação de slot.`);
                return;
            }

            const dayOfWeek = getDay(postDateObj);
            const dayName = getDayName(postDateObj);
            
            // MODIFICADO: Garantir que metricValue seja sempre um número
            const rawMetricValue = post.stats?.[METRIC_TO_USE_FOR_PERFORMANCE];
            const metricValue = (typeof rawMetricValue === 'number' && !isNaN(rawMetricValue)) ? rawMetricValue : 0;

            let slot = performanceBySlot.find(s => s.format === post.format && s.dayOfWeek === dayOfWeek);
            if (!slot) {
                slot = { format: post.format, dayOfWeek, dayName, totalMetricValue: 0, count: 0, avgMetricValue: 0, postsInSlot: [] };
                performanceBySlot.push(slot);
            }
            slot.totalMetricValue += metricValue; // Agora metricValue é garantidamente um número
            slot.count++;
            slot.postsInSlot.push(post);

            if (!postsByFormat[post.format]) {
                postsByFormat[post.format] = [];
            }
            postsByFormat[post.format]!.push(post);
        });

        const promisingSlots: Array<SlotPerformance & { formatAvg: number | null, daysSinceLastUsedInSlot: number }> = [];

        for (const slot of performanceBySlot) {
            if (slot.count < BEST_DAY_FORMAT_MIN_POSTS_PER_SLOT) continue;
            slot.avgMetricValue = slot.totalMetricValue / slot.count;

            const formatPosts = postsByFormat[slot.format];
            const formatAvg = formatPosts ? calculateAverageMetric(
                formatPosts,
                metricExtractor
            ) : overallAvgPerformance; 

            if (formatAvg === null) {
                logger.warn(`${detectionTAG} Média do formato ${slot.format} (${METRIC_TO_USE_FOR_PERFORMANCE}) não pôde ser calculada (calculateAverageMetric retornou null).`);
                continue; 
            }
            
            if (slot.avgMetricValue > formatAvg * BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_FORMAT_AVG &&
                slot.avgMetricValue > overallAvgPerformance * BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_OVERALL_AVG) {
                
                slot.postsInSlot.sort((a,b) => {
                    const dateA = getValidDate(a.postDate, a._id, detectionTAG);
                    const dateB = getValidDate(b.postDate, b._id, detectionTAG);
                    if (!dateA || !dateB) return 0;
                    return dateB.getTime() - dateA.getTime();
                });
                
                const lastUsedPostInSlot = slot.postsInSlot[0];
                const lastUsedDateInSlot = lastUsedPostInSlot ? getValidDate(lastUsedPostInSlot.postDate, lastUsedPostInSlot._id, detectionTAG) : null;
                const daysSinceLastUsedInSlot = lastUsedDateInSlot ? differenceInDays(today, lastUsedDateInSlot) : Infinity;

                if (daysSinceLastUsedInSlot > BEST_DAY_FORMAT_RECENT_POST_THRESHOLD_WEEKS * 7) {
                    promisingSlots.push({ ...slot, formatAvg, daysSinceLastUsedInSlot });
                }
            }
        }

        if (promisingSlots.length === 0) {
            logger.debug(`${detectionTAG} Nenhum slot promissor e não utilizado recentemente encontrado.`);
            return { isMet: false };
        }

        promisingSlots.sort((a, b) => {
            const gainA = a.avgMetricValue / (a.formatAvg === null || a.formatAvg === 0 ? 1 : a.formatAvg);
            const gainB = b.avgMetricValue / (b.formatAvg === null || b.formatAvg === 0 ? 1 : b.formatAvg);
            if (gainB !== gainA) return gainB - gainA;
            return b.daysSinceLastUsedInSlot - a.daysSinceLastUsedInSlot;
        });

        const bestSlot = promisingSlots[0]!;
        const bestSlotFormatAvg = bestSlot.formatAvg as number; 

        logger.debug(`${detectionTAG} Condição ATENDIDA. Melhor slot: Formato ${bestSlot.format} às ${bestSlot.dayName}. Média slot (${METRIC_TO_USE_FOR_PERFORMANCE}): ${bestSlot.avgMetricValue.toFixed(1)}, Média formato (${METRIC_TO_USE_FOR_PERFORMANCE}): ${bestSlotFormatAvg.toFixed(1)}, Dias desde último uso: ${bestSlot.daysSinceLastUsedInSlot}`);
        
        return {
            isMet: true,
            data: {
                bestCombination: {
                    format: bestSlot.format,
                    dayOfWeek: bestSlot.dayName,
                    avgEngValue: bestSlot.avgMetricValue,
                    metricUsed: METRIC_TO_USE_FOR_PERFORMANCE,
                    referenceAvgEngValue: bestSlotFormatAvg, 
                },
                daysSinceLastUsedInSlot: bestSlot.daysSinceLastUsedInSlot
            }
        };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
         if (!conditionData || !conditionData.bestCombination || typeof conditionData.daysSinceLastUsedInSlot !== 'number') {
            logger.error(`${actionTAG} conditionData inválido ou incompleto.`);
            return null;
        }

        const { bestCombination, daysSinceLastUsedInSlot } = conditionData;
        const { format, dayOfWeek, avgEngValue, metricUsed, referenceAvgEngValue } = bestCombination;

        if (typeof format !== 'string' ||
            typeof dayOfWeek !== 'string' ||
            typeof avgEngValue !== 'number' || 
            typeof metricUsed !== 'string' ||
            typeof referenceAvgEngValue !== 'number') { 
            logger.error(`${actionTAG} Tipos de dados inválidos em bestCombination: ${JSON.stringify(bestCombination)}`);
            return null;
        }

        logger.info(`${actionTAG} Gerando evento.`);

        const details: IBestDayFormatDetails = {
            format,
            dayOfWeek,
            avgEngRate: parseFloat(avgEngValue.toFixed(2)),
            metricUsed,
            referenceAvgEngRate: parseFloat(referenceAvgEngValue.toFixed(2)),
            daysSinceLastUsedInSlot
        };
        
        const percentageSuperior = referenceAvgEngValue > 0 ? ((avgEngValue / referenceAvgEngValue - 1) * 100) : (avgEngValue > 0 ? 100 : 0);
        
        let metricDisplayName = metricUsed;
        if (metricUsed === 'total_interactions') {
            metricDisplayName = 'interações totais';
        } else if (metricUsed === 'impressions') {
            metricDisplayName = 'impressões';
        }

        const messageForAI = `Radar Tuca de olho! Percebi que seus posts no formato **${format}** costumam ter um ótimo desempenho de ${metricDisplayName} às **${dayOfWeek}s**, cerca de ${percentageSuperior.toFixed(0)}% acima da média para esse formato! Faz ${daysSinceLastUsedInSlot} dias que você não posta um "${format}" nesse dia. Que tal planejar algo para a próxima ${dayOfWeek}?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
