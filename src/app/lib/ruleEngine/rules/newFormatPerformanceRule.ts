// src/app/lib/ruleEngine/rules/newFormatPerformanceRule.ts
// MODIFICADO: v5 - Alterada métrica de performance de 'impressions' para 'views'.
// MODIFICADO: v4 - Corrigido tipo de retorno da função extratora e import de IMetricStats.
// MODIFICADO: v3 - Adicionado tratamento para retorno null de calculateAverageMetric.
// MODIFICADO: v2 - Refatorado para usar stats.impressions diretamente.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { INewFormatPerformanceDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, isValid as isValidDate } from 'date-fns';
import { IMetricStats } from '@/app/models/Metric'; 
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';

const RULE_ID = 'new_format_performance_spike_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

// Constantes específicas da regra
const NEW_FORMAT_LOOKBACK_DAYS = 60;
const NEW_FORMAT_MAX_POSTS_CONSIDERED_NEW = 3;
const NEW_FORMAT_MIN_POSTS_FOR_COMPARISON_AVG = 5;
const NEW_FORMAT_PERFORMANCE_THRESHOLD_POSITIVE = 1.5;
const NEW_FORMAT_PERFORMANCE_THRESHOLD_NEGATIVE = 0.7;
// MODIFICADO: Métrica alterada para 'views'
const METRIC_TO_USE_FOR_PERFORMANCE: keyof IMetricStats = 'views'; 

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

export const newFormatPerformanceRule: IRule = {
    id: RULE_ID,
    name: 'Desempenho Incomum de Novo Formato',
    description: 'Detecta quando um formato de conteúdo recentemente experimentado tem um desempenho drasticamente diferente da média.',
    priority: 7,
    lookbackDays: NEW_FORMAT_LOOKBACK_DAYS,
    dataRequirements: [],
    resendCooldownDays: 21,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const currentRuleVersion = "newFormatPerformanceRule_v_CANVAS_METRIC_VIEWS_26_05_04_00"; // Nova string de versão
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição... Usando métrica: ${METRIC_TO_USE_FOR_PERFORMANCE}`);

        if (allUserPosts.length < NEW_FORMAT_MIN_POSTS_FOR_COMPARISON_AVG + 1) {
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise de desempenho de novo formato.`);
            return { isMet: false };
        }

        const postsByFormat: Record<string, PostObjectForAverage[]> = {};
        allUserPosts.forEach(post => {
            const postDateObj = getValidDate(post.postDate, post._id, detectionTAG);
            if (post.format && postDateObj && post.stats) { 
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
            
            postsInFormat.sort((a,b) => {
                const dateA = getValidDate(a.postDate, a._id, detectionTAG);
                const dateB = getValidDate(b.postDate, b._id, detectionTAG);
                if (!dateA || !dateB) return 0;
                return dateB.getTime() - dateA.getTime();
            });

            if (postsInFormat.length <= NEW_FORMAT_MAX_POSTS_CONSIDERED_NEW) {
                const allRecent = postsInFormat.every(p => {
                    const postDateObj = getValidDate(p.postDate, p._id, detectionTAG);
                    return postDateObj && differenceInDays(today, postDateObj) <= NEW_FORMAT_LOOKBACK_DAYS;
                });
                if(allRecent && postsInFormat.length > 0) {
                    newFormatCandidates.push({ formatName, posts: postsInFormat });
                } else if (postsInFormat.length > 0) {
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

        const metricExtractor = (post: PostObjectForAverage): number | undefined => {
            const value = post.stats?.[METRIC_TO_USE_FOR_PERFORMANCE];
            if (typeof value === 'number' && !isNaN(value)) {
                return value;
            }
            return undefined;
        };

        const referenceAvgPerformance = calculateAverageMetric(
            establishedFormatsPosts,
            metricExtractor
        );

        if (referenceAvgPerformance === null) {
            logger.debug(`${detectionTAG} Média de referência de performance (${METRIC_TO_USE_FOR_PERFORMANCE}) não pôde ser calculada (calculateAverageMetric retornou null). Pulando.`);
            return { isMet: false };
        }
        if (referenceAvgPerformance <= 0) {
             logger.debug(`${detectionTAG} Média de referência de performance (${METRIC_TO_USE_FOR_PERFORMANCE}) é zero ou negativa (${referenceAvgPerformance}). Pulando.`);
            return { isMet: false };
        }
        
        logger.debug(`${detectionTAG} Média de referência de performance (formatos estabelecidos): ${referenceAvgPerformance.toFixed(1)} usando métrica ${METRIC_TO_USE_FOR_PERFORMANCE}.`);

        for (const candidate of newFormatCandidates) {
            if (candidate.posts.length === 0) continue;

            const avgPerformanceNewFormat = calculateAverageMetric(
                candidate.posts,
                metricExtractor
            );

            if (avgPerformanceNewFormat === null) {
                logger.debug(`${detectionTAG} Não foi possível calcular a performance média (${METRIC_TO_USE_FOR_PERFORMANCE}) para o novo formato '${candidate.formatName}' (calculateAverageMetric retornou null).`);
                continue;
            }
            logger.debug(`${detectionTAG} Formato '${candidate.formatName}' (novo, ${candidate.posts.length} posts) - Média (${METRIC_TO_USE_FOR_PERFORMANCE}): ${avgPerformanceNewFormat.toFixed(1)}.`);

            let isPositiveAlert = false;
            let conditionMet = false;

            if (avgPerformanceNewFormat > referenceAvgPerformance * NEW_FORMAT_PERFORMANCE_THRESHOLD_POSITIVE) {
                conditionMet = true;
                isPositiveAlert = true;
            } else if (avgPerformanceNewFormat < referenceAvgPerformance * NEW_FORMAT_PERFORMANCE_THRESHOLD_NEGATIVE && avgPerformanceNewFormat > 0) { 
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
                        metricUsed: METRIC_TO_USE_FOR_PERFORMANCE,
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
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
        if (!conditionData) { 
            logger.error(`${actionTAG} conditionData inválido.`);
            return null;
        }

        const { formatName, avgPerformanceNewFormat, referenceAvgPerformance, metricUsed, numberOfPostsInNewFormat, isPositiveAlert } = conditionData;
        
        if (typeof formatName !== 'string' ||
            typeof avgPerformanceNewFormat !== 'number' || 
            typeof referenceAvgPerformance !== 'number' || 
            typeof metricUsed !== 'string' ||
            typeof numberOfPostsInNewFormat !== 'number' ||
            typeof isPositiveAlert !== 'boolean') {
            logger.error(`${actionTAG} Tipos de dados inválidos em conditionData: ${JSON.stringify(conditionData)}`);
            return null;
        }
        
        logger.info(`${actionTAG} Gerando evento para novo formato '${formatName}'.`);

        const details: INewFormatPerformanceDetails = {
            formatName,
            avgPerformanceNewFormat: parseFloat(avgPerformanceNewFormat.toFixed(2)),
            referenceAvgPerformance: parseFloat(referenceAvgPerformance.toFixed(2)),
            metricUsed, // Agora será 'views'
            numberOfPostsInNewFormat,
            isPositiveAlert
        };
        
        let messageForAI: string;
        const percentageDiff = referenceAvgPerformance > 0 ? Math.abs((avgPerformanceNewFormat / referenceAvgPerformance - 1) * 100) : (avgPerformanceNewFormat > 0 ? 100 : 0);

        // MODIFICADO: Ajustado metricDisplayName para 'views'
        let metricDisplayName = metricUsed;
        if (metricUsed === 'views') {
            metricDisplayName = 'visualizações';
        } else if (metricUsed === 'total_interactions') {
            metricDisplayName = 'interações totais';
        } else if (metricUsed === 'impressions') { // Mantido para caso a constante seja revertida
            metricDisplayName = 'impressões';
        }


        if (isPositiveAlert) {
            messageForAI = `Radar Tuca de Olho na Inovação! ✨ Seu novo formato de conteúdo "${formatName}" está com um desempenho incrível! Com ${numberOfPostsInNewFormat} post(s) analisado(s), a média de ${metricDisplayName} foi de ${avgPerformanceNewFormat.toFixed(0)}, cerca de ${percentageDiff.toFixed(0)}% acima da sua média de referência (${referenceAvgPerformance.toFixed(0)}). Parece que sua audiência adorou a novidade! Continue assim!`;
        } else {
            messageForAI = `Radar Tuca Analisando Experimentos! 🔬 Notei que sua recente experiência com o formato "${formatName}" (${numberOfPostsInNewFormat} post(s)) teve um desempenho em ${metricDisplayName} de ${avgPerformanceNewFormat.toFixed(0)}, que ficou cerca de ${percentageDiff.toFixed(0)}% abaixo da sua média de referência (${referenceAvgPerformance.toFixed(0)}). Que tal analisarmos juntos o que pode ter influenciado ou testarmos uma abordagem diferente para este formato?`;
        }

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
