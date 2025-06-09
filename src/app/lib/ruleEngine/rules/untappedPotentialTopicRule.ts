// src/app/lib/ruleEngine/rules/untappedPotentialTopicRule.ts
// MODIFICADO: v5.2 - Adicionado postLink na messageForAI para corrigir links quebrados.
// MODIFICADO: v5.1 - Adicionado platformPostId aos details do evento.
// MODIFICADO: v5 - Alterada métrica de performance para 'views' (via constants) e atualizada messageForAI.
// MODIFICADO: v4 - Corrigido tipo de retorno da função extratora e import de IMetricStats.
// MODIFICADO: v3 - Adicionado tratamento para retorno null de calculateAverageMetric.
// MODIFICADO: v2 - Refatorado para usar UNTAPPED_POTENTIAL_PERFORMANCE_METRIC a partir de stats.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IUntappedPotentialTopicDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, isValid as isValidDate } from 'date-fns';
import {
    UNTAPPED_POTENTIAL_PAST_LOOKBACK_DAYS,
    UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS,
    UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY,
    UNTAPPED_POTENTIAL_PERFORMANCE_METRIC, 
    UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD,
    UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER
} from '@/app/lib/constants';
import { IMetricStats } from '@/app/models/Metric'; 
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';

const RULE_ID = 'untapped_potential_topic_v2';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

const METRIC_TO_USE_FOR_PERFORMANCE: keyof IMetricStats = UNTAPPED_POTENTIAL_PERFORMANCE_METRIC;

function normalizeString(str?: string): string {
    return (str || '').trim().toLowerCase();
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

export const untappedPotentialTopicRule: IRule = {
    id: RULE_ID,
    name: 'Tópico de Potencial Não Explorado (Refinado)',
    description: 'Identifica posts antigos de alta performance cujo tema/formato/proposta/contexto não foi revisitado recentemente e que são superiores à média recente.',
    priority: 7,
    lookbackDays: UNTAPPED_POTENTIAL_PAST_LOOKBACK_DAYS,
    dataRequirements: [],
    resendCooldownDays: 30,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const currentRuleVersion = "untappedPotentialTopicRule_v5.2"; 
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição... Usando métrica: ${METRIC_TO_USE_FOR_PERFORMANCE}`);

        if (allUserPosts.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY * 2) {
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise completa.`);
            return { isMet: false };
        }

        const recentPosts: PostObjectForAverage[] = [];
        const olderPostsAnalysisPool: PostObjectForAverage[] = [];

        for (const post of allUserPosts) {
            const postDateObj = getValidDate(post.postDate, post._id, detectionTAG);
            if (!postDateObj) {
                logger.warn(`${detectionTAG} Post ${post._id} com data inválida ou ausente, pulando na divisão de pools.`);
                continue;
            }
            if (!post.stats) {
                logger.warn(`${detectionTAG} Post ${post._id} não possui 'stats', pulando.`);
                continue;
            }
            if (differenceInDays(today, postDateObj) <= UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS) {
                recentPosts.push(post);
            } else {
                olderPostsAnalysisPool.push(post);
            }
        }

        if (olderPostsAnalysisPool.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY || recentPosts.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY) {
            logger.debug(`${detectionTAG} Posts insuficientes nos pools (Antigos: ${olderPostsAnalysisPool.length}, Recentes: ${recentPosts.length}). Mínimo por pool: ${UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY}.`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} Posts antigos para análise: ${olderPostsAnalysisPool.length}, Posts recentes para referência: ${recentPosts.length}`);

        olderPostsAnalysisPool.sort((a, b) => {
            const valA = Number(a.stats?.[METRIC_TO_USE_FOR_PERFORMANCE] || 0);
            const valB = Number(b.stats?.[METRIC_TO_USE_FOR_PERFORMANCE] || 0);
            return valB - valA;
        });
        
        const percentileIndexFloat = olderPostsAnalysisPool.length * (1 - UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD);
        const percentileIndex = Math.min(Math.max(0, Math.floor(percentileIndexFloat)), olderPostsAnalysisPool.length - 1);
        
        const performanceThresholdValue = Number(olderPostsAnalysisPool[percentileIndex]?.stats?.[METRIC_TO_USE_FOR_PERFORMANCE] || 0);

        const highPerformingOldPosts = olderPostsAnalysisPool.filter(post => {
            const perfValue = Number(post.stats?.[METRIC_TO_USE_FOR_PERFORMANCE] || 0);
            return perfValue >= performanceThresholdValue && perfValue > 0;
        });

        if (highPerformingOldPosts.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post antigo de alto desempenho encontrado no top ${((1 - UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD) * 100).toFixed(0)}% (limiar de performance ${METRIC_TO_USE_FOR_PERFORMANCE}: ${performanceThresholdValue}).`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${highPerformingOldPosts.length} posts antigos de alto desempenho candidatos (limiar ${METRIC_TO_USE_FOR_PERFORMANCE}: ${performanceThresholdValue}).`);

        const metricExtractor = (p: PostObjectForAverage): number | undefined => {
            const value = p.stats?.[METRIC_TO_USE_FOR_PERFORMANCE]; 
            if (typeof value === 'number' && !isNaN(value)) {
                return value;
            }
            return undefined;
        };

        for (const oldPost of highPerformingOldPosts) {
            const oldFormatNorm = normalizeString(oldPost.format);
            const oldProposalNorm = normalizeString(oldPost.proposal);
            const oldContextNorm = normalizeString(oldPost.context);

            const hasSimilarRecentPost = recentPosts.some(recentPost =>
                normalizeString(recentPost.format) === oldFormatNorm &&
                normalizeString(recentPost.proposal) === oldProposalNorm &&
                normalizeString(recentPost.context) === oldContextNorm
            );

            if (hasSimilarRecentPost) {
                continue;
            }

            let referenceAveragePerformance: number | null;
            const recentPostsSameFormat = recentPosts.filter(p => normalizeString(p.format) === oldFormatNorm && p.stats);
            
            if (recentPostsSameFormat.length >= UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY) {
                referenceAveragePerformance = calculateAverageMetric(recentPostsSameFormat, metricExtractor);
            } else {
                referenceAveragePerformance = calculateAverageMetric(recentPosts.filter(p => !!p.stats), metricExtractor);
            }
            
            if (referenceAveragePerformance === null) {
                logger.warn(`${detectionTAG} Média de referência (${METRIC_TO_USE_FOR_PERFORMANCE}) para post ${oldPost._id} (formato ${oldFormatNorm}) não pôde ser calculada (calculateAverageMetric retornou null).`);
                continue; 
            } else {
                const refAvgPerfNumber: number = referenceAveragePerformance;
                const oldPostMetricValue = Number(oldPost.stats?.[METRIC_TO_USE_FOR_PERFORMANCE] || 0);

                if (refAvgPerfNumber <= 0 && oldPostMetricValue <=0) {
                    logger.debug(`${detectionTAG} Média de referência (${METRIC_TO_USE_FOR_PERFORMANCE}) e performance do post antigo são zero ou negativas. Pulando post ${oldPost._id}.`);
                    continue;
                }
                logger.debug(`${detectionTAG} Post ${oldPost._id}: Média de referência (${METRIC_TO_USE_FOR_PERFORMANCE}, ${recentPostsSameFormat.length >= UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY ? 'formato' : 'geral'}): ${refAvgPerfNumber.toFixed(1)}`);

                const oldPostPerformance = Number(oldPost.stats?.[METRIC_TO_USE_FOR_PERFORMANCE] || 0);

                if (oldPostPerformance > refAvgPerfNumber * UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER && oldPostPerformance > 0) {
                    logger.debug(`${detectionTAG} Condição ATENDIDA para post ${oldPost._id}.`);
                    return {
                        isMet: true,
                        data: {
                            oldPost: oldPost,
                            referenceAveragePerformance: refAvgPerfNumber, 
                        }
                    };
                } else {
                     logger.debug(`${detectionTAG} Post antigo ${oldPost._id} (Perf ${METRIC_TO_USE_FOR_PERFORMANCE}:${oldPostPerformance.toFixed(1)}) não foi significativamente superior à média de referência (${refAvgPerfNumber.toFixed(1)} * ${UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER}).`);
                }
            }
        }
        logger.debug(`${detectionTAG} Nenhuma condição atendida após verificar todos os posts antigos de alto desempenho.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user, today } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
         if (!conditionData || !conditionData.oldPost || typeof conditionData.referenceAveragePerformance !== 'number') { 
            logger.error(`${actionTAG} conditionData inválido ou incompleto: ${JSON.stringify(conditionData)}`);
            return null;
        }

        const oldPost = conditionData.oldPost as PostObjectForAverage;
        const referenceAveragePerformance = conditionData.referenceAveragePerformance as number;
        
        logger.info(`${actionTAG} Gerando evento para post ${oldPost._id}. InstagramMediaId: ${oldPost.instagramMediaId}`);

        const performanceValue = Number(oldPost.stats?.[METRIC_TO_USE_FOR_PERFORMANCE] || 0);
        
        const oldPostDateObj = getValidDate(oldPost.postDate, oldPost._id, actionTAG);
        if (!oldPostDateObj) {
            logger.error(`${actionTAG} Data inválida para oldPost ${oldPost._id}. Não é possível gerar alerta.`);
            return null;
        }
        const daysSincePosted = differenceInDays(today, oldPostDateObj);
        
        const postDescriptionExcerptText = oldPost.description ? oldPost.description.substring(0, 70) : undefined;
        const postDescriptionForAI = oldPost.description ? `"${oldPost.description.substring(0, 70)}..."` : "um post anterior";

        const details: IUntappedPotentialTopicDetails = {
            postId: oldPost._id,
            platformPostId: oldPost.instagramMediaId,
            postDescriptionExcerpt: postDescriptionExcerptText,
            performanceMetric: METRIC_TO_USE_FOR_PERFORMANCE as string,
            performanceValue,
            referenceAverage: referenceAveragePerformance,
            daysSincePosted,
            postType: oldPost.type,
            format: oldPost.format,
            proposal: oldPost.proposal,
            context: oldPost.context,
        };
        
        let metricDisplayName = METRIC_TO_USE_FOR_PERFORMANCE as string;
        if (METRIC_TO_USE_FOR_PERFORMANCE === 'total_interactions') {
            metricDisplayName = 'interações totais';
        } else if (METRIC_TO_USE_FOR_PERFORMANCE === 'impressions') {
            metricDisplayName = 'impressões';
        } else if (METRIC_TO_USE_FOR_PERFORMANCE === 'views') {
            metricDisplayName = 'visualizações';
        }

        // --- CORREÇÃO AQUI ---
        // Incluído o 'oldPost.postLink' para garantir que a IA tenha o link correto para incluir na mensagem final.
        const messageForAI = `Radar Tuca detectou: Lembra do seu post ${postDescriptionForAI} (${oldPost.postLink}) (classificado como ${oldPost.format || 'N/D'})? Ele teve um ótimo desempenho (${performanceValue.toFixed(0)} ${metricDisplayName}) há cerca de ${daysSincePosted} dias, superando a média recente de posts similares (${referenceAveragePerformance.toFixed(1)})! Parece que o tema/formato (Proposta: ${oldPost.proposal || 'N/D'} / Contexto: ${oldPost.context || 'N/D'}) ressoou bem e não foi revisitado. Que tal explorar essa ideia novamente?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
