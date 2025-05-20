// src/app/lib/ruleEngine/rules/untappedPotentialTopicRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types'; // Ajuste o caminho se necessário
import { IUntappedPotentialTopicDetails } from '@/app/models/User'; // Ajuste o caminho se necessário
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays } from 'date-fns';
import {
    UNTAPPED_POTENTIAL_PAST_LOOKBACK_DAYS,
    UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS,
    UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY, 
    UNTAPPED_POTENTIAL_PERFORMANCE_METRIC, 
    UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD, 
    UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER
} from '@/app/lib/constants';
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';

const RULE_ID = 'untapped_potential_topic_v2'; 

function normalizeString(str?: string): string {
    return (str || '').trim().toLowerCase();
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
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        if (allUserPosts.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY * 2) { 
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise completa.`);
            return { isMet: false };
        }

        const recentPosts: PostObjectForAverage[] = [];
        const olderPostsAnalysisPool: PostObjectForAverage[] = [];

        for (const post of allUserPosts) {
            const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            if (differenceInDays(today, postDate) <= UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS) {
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
            const valA = (a as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (a.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0;
            const valB = (b as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (b.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0;
            return valB - valA;
        });
        
        const percentileIndexFloat = olderPostsAnalysisPool.length * (1 - UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD); 
        const percentileIndex = Math.min(Math.max(0, Math.floor(percentileIndexFloat)), olderPostsAnalysisPool.length - 1);
        
        const performanceThresholdValue = (olderPostsAnalysisPool[percentileIndex] as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (olderPostsAnalysisPool[percentileIndex]?.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0;

        const highPerformingOldPosts = olderPostsAnalysisPool.filter(post => {
            const perfValue = (post as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (post.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0;
            return perfValue >= performanceThresholdValue && perfValue > 0;
        });

        if (highPerformingOldPosts.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post antigo de alto desempenho encontrado no top ${((1 - UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD) * 100).toFixed(0)}% (limiar de performance: ${performanceThresholdValue}).`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${highPerformingOldPosts.length} posts antigos de alto desempenho candidatos (limiar: ${performanceThresholdValue}).`);

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

            let referenceAveragePerformance: number;
            const recentPostsSameFormat = recentPosts.filter(p => normalizeString(p.format) === oldFormatNorm);

            if (recentPostsSameFormat.length >= UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY) {
                referenceAveragePerformance = calculateAverageMetric(recentPostsSameFormat, UNTAPPED_POTENTIAL_PERFORMANCE_METRIC as keyof PostObjectForAverage);
            } else {
                referenceAveragePerformance = calculateAverageMetric(recentPosts, UNTAPPED_POTENTIAL_PERFORMANCE_METRIC as keyof PostObjectForAverage); 
            }

            const oldPostPerformance = ((oldPost as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (oldPost.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number;

            if (oldPostPerformance > referenceAveragePerformance * UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER && oldPostPerformance > 0) {
                logger.debug(`${detectionTAG} Condição ATENDIDA para post ${oldPost._id}.`);
                return {
                    isMet: true,
                    data: {
                        oldPost: oldPost as PostObjectForAverage,
                        referenceAveragePerformance,
                    }
                };
            }
        }
        logger.debug(`${detectionTAG} Nenhuma condição atendida após verificar todos os posts antigos de alto desempenho.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user, today } = context;
         if (!conditionData || !conditionData.oldPost || typeof conditionData.referenceAveragePerformance !== 'number') {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }

        const oldPost = conditionData.oldPost as PostObjectForAverage;
        const referenceAveragePerformance = conditionData.referenceAveragePerformance as number;
        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento para post ${oldPost._id}.`);

        const performanceValue = (((oldPost as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (oldPost.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0)) as number;
        const daysSincePosted = differenceInDays(today, oldPost.createdAt instanceof Date ? oldPost.createdAt : parseISO(oldPost.createdAt as string));
        const postDescriptionExcerptText = oldPost.description ? oldPost.description.substring(0, 70) : undefined;
        const postDescriptionForAI = oldPost.description ? `"${oldPost.description.substring(0, 70)}..."` : "um post anterior";

        const details: IUntappedPotentialTopicDetails = {
            postId: oldPost._id,
            postDescriptionExcerpt: postDescriptionExcerptText,
            performanceMetric: String(UNTAPPED_POTENTIAL_PERFORMANCE_METRIC), // <-- CORRIGIDO AQUI
            performanceValue,
            referenceAverage: referenceAveragePerformance,
            daysSincePosted,
            postType: oldPost.type,
            format: oldPost.format,
            proposal: oldPost.proposal,
            context: oldPost.context,
        };

        const messageForAI = `Radar Tuca detectou: Lembra do seu post ${postDescriptionForAI} (classificado como ${oldPost.format || 'N/D'})? Ele teve um ótimo desempenho (${performanceValue.toFixed(0)} ${String(UNTAPPED_POTENTIAL_PERFORMANCE_METRIC)}) há cerca de ${daysSincePosted} dias, superando a média recente de posts similares (${referenceAveragePerformance.toFixed(1)})! Parece que o tema/formato (Proposta: ${oldPost.proposal || 'N/D'} / Contexto: ${oldPost.context || 'N/D'}) ressoou bem e não foi revisitado. Que tal explorar essa ideia novamente?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
