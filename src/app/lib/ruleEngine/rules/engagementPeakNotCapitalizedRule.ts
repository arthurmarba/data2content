// src/app/lib/ruleEngine/rules/engagementPeakNotCapitalizedRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types'; // Ajuste o caminho se necessário
import { IEngagementPeakNotCapitalizedDetails } from '@/app/models/User'; // Ajuste o caminho se necessário
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays } from 'date-fns';
import {
    ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS,
    ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS,
    ENGAGEMENT_PEAK_MIN_ABSOLUTE_COMMENTS,
    ENGAGEMENT_PEAK_COMMENT_MULTIPLIER,
    // Constante para o lookback da média histórica de comentários, ex: 60 dias
    // Se não existir, defina uma ou use um valor fixo.
    // Ex: HISTORICAL_COMMENT_AVG_LOOKBACK_DAYS = 60
} from '@/app/lib/constants';
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';

const RULE_ID = 'engagement_peak_not_capitalized_v1';
// Definindo uma constante para o lookback da média de comentários se não vier de `constants.ts`
const HISTORICAL_COMMENT_AVG_LOOKBACK_DAYS = 60;


export const engagementPeakNotCapitalizedRule: IRule = {
    id: RULE_ID,
    name: 'Pico de Comentários Não Capitalizado',
    description: 'Identifica posts recentes com um número de comentários significativamente acima da média, sugerindo oportunidade de follow-up.',
    priority: 9,
    // O lookback precisa cobrir os posts para checagem de pico e os posts para a média histórica
    lookbackDays: Math.max(ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS, HISTORICAL_COMMENT_AVG_LOOKBACK_DAYS),
    dataRequirements: [], // Nenhum além de allUserPosts
    resendCooldownDays: 14,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        const postsToCheck = allUserPosts.filter(post => {
            const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            const ageInDays = differenceInDays(today, postDate);
            return ageInDays >= ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS && ageInDays <= ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS;
        }).sort((a,b) => { // Ordena por comentários, decrescente, para avaliar os mais comentados primeiro
            // Usa totalComments que já é populado por getRecentPostObjectsWithAggregatedMetrics
            const commentsA = a.totalComments ?? 0;
            const commentsB = b.totalComments ?? 0;
            return commentsB - commentsA;
        });

        if (postsToCheck.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post encontrado no intervalo de idade [${ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS}-${ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS}] dias.`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${postsToCheck.length} posts encontrados para análise de pico de comentários.`);

        // Filtra posts para calcular a média histórica de comentários
        const historicalPostsForAvg = allUserPosts.filter(post => {
            const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            return differenceInDays(today, postDate) <= HISTORICAL_COMMENT_AVG_LOOKBACK_DAYS;
        });

        if (historicalPostsForAvg.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post encontrado para calcular a média histórica de comentários.`);
            return { isMet: false }; // Não há base para comparação
        }
        
        // ATUALIZADO: Usa a chave 'totalComments' para calculateAverageMetric,
        // pois getRecentPostObjectsWithAggregatedMetrics já popula este campo.
        const averageComments = calculateAverageMetric(
            historicalPostsForAvg,
            'totalComments' // Chave da métrica de comentários em PostObjectForAverage
        );
        logger.debug(`${detectionTAG} Média histórica de comentários: ${averageComments.toFixed(1)} (baseado em ${historicalPostsForAvg.length} posts).`);


        for (const post of postsToCheck) {
            // Usa totalComments que já é populado por getRecentPostObjectsWithAggregatedMetrics
            const postComments = post.totalComments ?? 0;

            if (postComments >= ENGAGEMENT_PEAK_MIN_ABSOLUTE_COMMENTS && postComments > averageComments * ENGAGEMENT_PEAK_COMMENT_MULTIPLIER) {
                logger.debug(`${detectionTAG} Condição ATENDIDA para post ${post._id} (Comentários: ${postComments}).`);
                return {
                    isMet: true,
                    data: {
                        post: post as PostObjectForAverage,
                        postComments,
                        averageComments
                    }
                };
            } else {
                // logger.debug(`${detectionTAG} Condição NÃO atendida para post ${post._id} (Comentários: ${postComments}, Média: ${averageComments.toFixed(1)}, Limiar Multiplicador: ${ENGAGEMENT_PEAK_COMMENT_MULTIPLIER}, Mín Absoluto: ${ENGAGEMENT_PEAK_MIN_ABSOLUTE_COMMENTS}).`);
            }
        }
        logger.debug(`${detectionTAG} Nenhuma condição atendida após verificar todos os posts elegíveis.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        if (!conditionData || !conditionData.post || typeof conditionData.postComments !== 'number' || typeof conditionData.averageComments !== 'number') {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }

        const post = conditionData.post as PostObjectForAverage;
        const postComments = conditionData.postComments as number;
        const averageComments = conditionData.averageComments as number;
        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento para post ${post._id}.`);

        const postDescriptionExcerptText = post.description ? post.description.substring(0, 70) : undefined;
        const postDescriptionForAI = post.description ? `"${post.description.substring(0, 70)}..."` : "um post recente";

        const details: IEngagementPeakNotCapitalizedDetails = {
            postId: post._id,
            postDescriptionExcerpt: postDescriptionExcerptText,
            comments: postComments,
            averageComments: averageComments, // Já é número
            postType: post.type,
            format: post.format,
            proposal: post.proposal,
            context: post.context,
        };

        const messageForAI = `Radar Tuca detectou: Seu post ${postDescriptionForAI} gerou bastante conversa, com ${postComments} comentários! Isso é bem acima da sua média de ${averageComments.toFixed(1)}. Parece que sua audiência tem perguntas ou muito interesse no tema. Já considerou fazer um conteúdo de follow-up ou responder mais diretamente aos comentários para manter essa chama acesa?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
