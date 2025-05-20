// src/app/lib/ruleEngine/rules/newFormatPerformanceRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { INewFormatPerformanceDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, subDays } from 'date-fns';
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';
import {
    // Exemplo: UNTAPPED_POTENTIAL_PERFORMANCE_METRIC pode ser uma boa métrica chave aqui também
    // ou defina uma nova constante para a métrica de performance desta regra.
    FORMAT_PERFORMANCE_METRIC_KEY, // Usando uma métrica já definida para formatos
} from '@/app/lib/constants';

const RULE_ID = 'new_format_performance_spike_v1';

// Constantes específicas da regra
const NEW_FORMAT_LOOKBACK_DAYS = 60; // Período para identificar "novos" formatos
const NEW_FORMAT_MAX_POSTS_CONSIDERED_NEW = 3; // Até quantos posts um formato é considerado "novo"
const NEW_FORMAT_MIN_POSTS_FOR_COMPARISON_AVG = 5; // Mínimo de posts para calcular a média de formatos estabelecidos
const NEW_FORMAT_PERFORMANCE_THRESHOLD_POSITIVE = 1.5; // Novo formato é 50% melhor
const NEW_FORMAT_PERFORMANCE_THRESHOLD_NEGATIVE = 0.7; // Novo formato é 30% pior (70% da média)

export const newFormatPerformanceRule: IRule = {
    id: RULE_ID,
    name: 'Desempenho Incomum de Novo Formato',
    description: 'Detecta quando um formato de conteúdo recentemente experimentado tem um desempenho drasticamente diferente da média.',
    priority: 7,
    lookbackDays: NEW_FORMAT_LOOKBACK_DAYS,
    dataRequirements: [], // Apenas allUserPosts
    resendCooldownDays: 21,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        if (allUserPosts.length < NEW_FORMAT_MIN_POSTS_FOR_COMPARISON_AVG + 1) {
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise de desempenho de novo formato.`);
            return { isMet: false };
        }

        const postsByFormat: Record<string, PostObjectForAverage[]> = {};
        allUserPosts.forEach(post => {
            if (post.format && post.createdAt) {
                if (!postsByFormat[post.format]) {
                    postsByFormat[post.format] = [];
                }
                postsByFormat[post.format]!.push(post);
            }
        });

        const establishedFormatsPosts: PostObjectForAverage[] = [];
        const newFormatCandidates: Array<{ formatName: string, posts: PostObjectForAverage[] }> = [];

        for (const formatName in postsByFormat) {
            const postsInFormat = postsByFormat[formatName]!;
            // Ordena por data para pegar os mais recentes primeiro
            postsInFormat.sort((a,b) => 
                (b.createdAt instanceof Date ? b.createdAt.getTime() : parseISO(b.createdAt as string).getTime()) -
                (a.createdAt instanceof Date ? a.createdAt.getTime() : parseISO(a.createdAt as string).getTime())
            );

            if (postsInFormat.length <= NEW_FORMAT_MAX_POSTS_CONSIDERED_NEW) {
                // Considera "novo" se todos os posts nesse formato são recentes (dentro do lookback)
                // e o número de posts é pequeno.
                const allRecent = postsInFormat.every(p => {
                    const postDate = p.createdAt instanceof Date ? p.createdAt : parseISO(p.createdAt as string);
                    return differenceInDays(today, postDate) <= NEW_FORMAT_LOOKBACK_DAYS;
                });
                if(allRecent) {
                    newFormatCandidates.push({ formatName, posts: postsInFormat });
                } else {
                    establishedFormatsPosts.push(...postsInFormat);
                }
            } else {
                establishedFormatsPosts.push(...postsInFormat);
            }
        }

        if (newFormatCandidates.length === 0) {
            logger.debug(`${detectionTAG} Nenhum formato "novo" identificado.`);
            return { isMet: false };
        }

        if (establishedFormatsPosts.length < NEW_FORMAT_MIN_POSTS_FOR_COMPARISON_AVG) {
            logger.debug(`${detectionTAG} Posts insuficientes em formatos estabelecidos (${establishedFormatsPosts.length}) para calcular média de referência.`);
            return { isMet: false };
        }

        const referenceAvgPerformance = calculateAverageMetric(establishedFormatsPosts, FORMAT_PERFORMANCE_METRIC_KEY as keyof PostObjectForAverage);
        if (referenceAvgPerformance <= 0) { // Evita alertas se a performance de referência for zero ou negativa
            logger.debug(`${detectionTAG} Média de referência de performance é zero ou negativa. Pulando.`);
            return { isMet: false };
        }
        
        logger.debug(`${detectionTAG} Média de referência de performance (formatos estabelecidos): ${referenceAvgPerformance.toFixed(1)} usando métrica ${String(FORMAT_PERFORMANCE_METRIC_KEY)}.`);

        for (const candidate of newFormatCandidates) {
            if (candidate.posts.length === 0) continue; // Segurança

            const avgPerformanceNewFormat = calculateAverageMetric(candidate.posts, FORMAT_PERFORMANCE_METRIC_KEY as keyof PostObjectForAverage);
            logger.debug(`${detectionTAG} Formato '${candidate.formatName}' (novo, ${candidate.posts.length} posts) - Média: ${avgPerformanceNewFormat.toFixed(1)}.`);

            let isPositiveAlert = false;
            let conditionMet = false;

            if (avgPerformanceNewFormat > referenceAvgPerformance * NEW_FORMAT_PERFORMANCE_THRESHOLD_POSITIVE) {
                conditionMet = true;
                isPositiveAlert = true;
            } else if (avgPerformanceNewFormat < referenceAvgPerformance * NEW_FORMAT_PERFORMANCE_THRESHOLD_NEGATIVE && avgPerformanceNewFormat > 0) { // Evita alerta se a performance do novo formato for zero
                conditionMet = true;
                isPositiveAlert = false;
            }

            if (conditionMet) {
                logger.debug(`${detectionTAG} Condição ATENDIDA para formato '${candidate.formatName}'. Positivo: ${isPositiveAlert}`);
                return {
                    isMet: true,
                    data: {
                        formatName: candidate.formatName,
                        avgPerformanceNewFormat,
                        referenceAvgPerformance,
                        metricUsed: String(FORMAT_PERFORMANCE_METRIC_KEY),
                        numberOfPostsInNewFormat: candidate.posts.length,
                        isPositiveAlert
                    }
                };
            }
        }

        logger.debug(`${detectionTAG} Nenhuma condição para desempenho incomum de novo formato atendida.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        if (!conditionData) {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido.`);
            return null;
        }

        const { formatName, avgPerformanceNewFormat, referenceAvgPerformance, metricUsed, numberOfPostsInNewFormat, isPositiveAlert } = conditionData;
        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento para novo formato '${formatName}'.`);

        const details: INewFormatPerformanceDetails = {
            formatName,
            avgPerformanceNewFormat: parseFloat(avgPerformanceNewFormat.toFixed(2)),
            referenceAvgPerformance: parseFloat(referenceAvgPerformance.toFixed(2)),
            metricUsed,
            numberOfPostsInNewFormat,
            isPositiveAlert
        };
        
        let messageForAI: string;
        const percentageDiff = referenceAvgPerformance > 0 ? Math.abs((avgPerformanceNewFormat / referenceAvgPerformance - 1) * 100) : 100;

        if (isPositiveAlert) {
            messageForAI = `Radar Tuca de Olho na Inovação! ✨ Seu novo formato de conteúdo "${formatName}" está com um desempenho incrível! Com ${numberOfPostsInNewFormat} post(s) analisado(s), a média de ${metricUsed} foi de ${avgPerformanceNewFormat.toFixed(1)}, cerca de ${percentageDiff.toFixed(0)}% acima da sua média de referência (${referenceAvgPerformance.toFixed(1)}). Parece que sua audiência adorou a novidade! Continue assim!`;
        } else {
            messageForAI = `Radar Tuca Analisando Experimentos! 🔬 Notei que sua recente experiência com o formato "${formatName}" (${numberOfPostsInNewFormat} post(s)) teve um desempenho em ${metricUsed} de ${avgPerformanceNewFormat.toFixed(1)}, que ficou cerca de ${percentageDiff.toFixed(0)}% abaixo da sua média de referência (${referenceAvgPerformance.toFixed(1)}). Que tal analisarmos juntos o que pode ter influenciado ou testarmos uma abordagem diferente para este formato?`;
        }

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
