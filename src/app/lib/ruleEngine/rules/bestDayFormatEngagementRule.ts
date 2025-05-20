// src/app/lib/ruleEngine/rules/bestDayFormatEngagementRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IBestDayFormatDetails } from '@/app/models/User'; // Importa a nova interface
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, getDay, format as formatDateFns } from 'date-fns'; // getDay para dia da semana, format para nome do dia
import { ptBR } from 'date-fns/locale'; // Para obter o nome do dia da semana em português
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';

const RULE_ID = 'best_day_format_engagement_v1';

// Constantes da Regra
const BEST_DAY_FORMAT_LOOKBACK_DAYS = 90; // Dias de histórico para análise
const BEST_DAY_FORMAT_MIN_POSTS_PER_SLOT = 3; // Mínimo de posts numa combinação Formato/Dia para ser considerada
const BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_FORMAT_AVG = 1.3; // Ex: 30% acima da média do formato
const BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_OVERALL_AVG = 1.5; // Ex: 50% acima da média geral
const BEST_DAY_FORMAT_RECENT_POST_THRESHOLD_WEEKS = 2; // Semanas para verificar se o slot foi usado recentemente
const BEST_DAY_FORMAT_METRIC_KEY: keyof PostObjectForAverage = 'totalEngagement'; // Métrica principal para engajamento (ou 'stats.engagementRate' se disponível e preferível)

// Helper para obter o nome do dia da semana em português
function getDayName(date: Date): string {
    // getDay retorna 0 para Domingo, 1 para Segunda, ..., 6 para Sábado
    // O array abaixo mapeia isso para nomes em português.
    // Alternativamente, pode-se usar formatDateFns(date, 'EEEE', { locale: ptBR });
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return dayNames[getDay(date)]!;
}

interface SlotPerformance {
    format: string;
    dayOfWeek: number; // 0 para Domingo, ..., 6 para Sábado
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
    dataRequirements: [], // Assume allUserPosts tem format e a métrica de engajamento
    resendCooldownDays: 28,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        if (allUserPosts.length < BEST_DAY_FORMAT_MIN_POSTS_PER_SLOT * 3) { // Um mínimo de posts totais
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise de melhor dia/formato.`);
            return { isMet: false };
        }

        const overallAvgPerformance = calculateAverageMetric(allUserPosts, BEST_DAY_FORMAT_METRIC_KEY);
        if (overallAvgPerformance === 0 && allUserPosts.length > 0) { // Evitar divisão por zero e alertas se não houver engajamento
            logger.debug(`${detectionTAG} Média geral de performance é zero. Pulando regra.`);
            return { isMet: false };
        }

        const performanceBySlot: SlotPerformance[] = [];
        const postsByFormat: Record<string, PostObjectForAverage[]> = {};

        allUserPosts.forEach(post => {
            if (!post.format || !post.createdAt) return;
            const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            const dayOfWeek = getDay(postDate); // 0 = Domingo, 1 = Segunda ...
            const dayName = getDayName(postDate);
            const metricValue = (post as any)[BEST_DAY_FORMAT_METRIC_KEY] ?? (post.stats as any)?.[BEST_DAY_FORMAT_METRIC_KEY] ?? 0;

            if (typeof metricValue !== 'number') return;

            let slot = performanceBySlot.find(s => s.format === post.format && s.dayOfWeek === dayOfWeek);
            if (!slot) {
                slot = { format: post.format, dayOfWeek, dayName, totalMetricValue: 0, count: 0, avgMetricValue: 0, postsInSlot: [] };
                performanceBySlot.push(slot);
            }
            slot.totalMetricValue += metricValue;
            slot.count++;
            slot.postsInSlot.push(post);

            if (!postsByFormat[post.format]) {
                postsByFormat[post.format] = [];
            }
            postsByFormat[post.format]!.push(post);
        });

        const promisingSlots: Array<SlotPerformance & { formatAvg: number, daysSinceLastUsedInSlot: number }> = [];

        for (const slot of performanceBySlot) {
            if (slot.count < BEST_DAY_FORMAT_MIN_POSTS_PER_SLOT) continue;
            slot.avgMetricValue = slot.totalMetricValue / slot.count;

            const formatPosts = postsByFormat[slot.format];
            const formatAvg = formatPosts ? calculateAverageMetric(formatPosts, BEST_DAY_FORMAT_METRIC_KEY) : overallAvgPerformance;

            if (slot.avgMetricValue > formatAvg * BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_FORMAT_AVG &&
                slot.avgMetricValue > overallAvgPerformance * BEST_DAY_FORMAT_SUPERIORITY_MULTIPLIER_VS_OVERALL_AVG) {
                
                slot.postsInSlot.sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
                const lastUsedDateInSlot = slot.postsInSlot[0]?.createdAt;
                const daysSinceLastUsedInSlot = lastUsedDateInSlot ? differenceInDays(today, new Date(lastUsedDateInSlot as string)) : Infinity;

                if (daysSinceLastUsedInSlot > BEST_DAY_FORMAT_RECENT_POST_THRESHOLD_WEEKS * 7) {
                    promisingSlots.push({ ...slot, formatAvg, daysSinceLastUsedInSlot });
                }
            }
        }

        if (promisingSlots.length === 0) {
            logger.debug(`${detectionTAG} Nenhum slot promissor e não utilizado recentemente encontrado.`);
            return { isMet: false };
        }

        // Priorizar o slot com maior "ganho" sobre a média do formato, ou o mais "esquecido"
        promisingSlots.sort((a, b) => {
            const gainA = a.avgMetricValue / (a.formatAvg || 1); // Evitar divisão por zero
            const gainB = b.avgMetricValue / (b.formatAvg || 1);
            if (gainB !== gainA) return gainB - gainA;
            return b.daysSinceLastUsedInSlot - a.daysSinceLastUsedInSlot; // Desempate pelo mais esquecido
        });

        const bestSlot = promisingSlots[0]!;
        logger.debug(`${detectionTAG} Condição ATENDIDA. Melhor slot: Formato ${bestSlot.format} às ${bestSlot.dayName}. Média slot: ${bestSlot.avgMetricValue.toFixed(1)}, Média formato: ${bestSlot.formatAvg.toFixed(1)}, Dias desde último uso: ${bestSlot.daysSinceLastUsedInSlot}`);
        
        return {
            isMet: true,
            data: {
                bestCombination: {
                    format: bestSlot.format,
                    dayOfWeek: bestSlot.dayName, // Passar o nome do dia
                    avgEngRate: bestSlot.avgMetricValue,
                    metricUsed: BEST_DAY_FORMAT_METRIC_KEY,
                    referenceAvgEngRate: bestSlot.formatAvg, // Média do formato como referência
                },
                daysSinceLastUsedInSlot: bestSlot.daysSinceLastUsedInSlot
            }
        };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
         if (!conditionData || !conditionData.bestCombination || typeof conditionData.daysSinceLastUsedInSlot !== 'number') {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }

        const { bestCombination, daysSinceLastUsedInSlot } = conditionData;
        const { format, dayOfWeek, avgEngRate, metricUsed, referenceAvgEngRate } = bestCombination;

        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento.`);

        const details: IBestDayFormatDetails = {
            format,
            dayOfWeek,
            avgEngRate: parseFloat(avgEngRate.toFixed(2)),
            metricUsed,
            referenceAvgEngRate: parseFloat(referenceAvgEngRate.toFixed(2)),
            daysSinceLastUsedInSlot
        };
        
        const percentageSuperior = referenceAvgEngRate > 0 ? ((avgEngRate / referenceAvgEngRate - 1) * 100) : (avgEngRate > 0 ? 100 : 0);

        const messageForAI = `Radar Tuca de olho! Percebi que seus posts no formato **${format}** costumam ter um ótimo desempenho de ${metricUsed} às **${dayOfWeek}s**, cerca de ${percentageSuperior.toFixed(0)}% acima da média para esse formato! Faz ${daysSinceLastUsedInSlot} dias que você não posta um "${format}" nesse dia. Que tal planejar algo para a próxima ${dayOfWeek}?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
