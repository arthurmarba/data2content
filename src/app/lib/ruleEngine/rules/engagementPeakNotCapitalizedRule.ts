// src/app/lib/ruleEngine/rules/engagementPeakNotCapitalizedRule.ts
// MODIFICADO: v2.2 - Adicionado postLink na messageForAI para corrigir links quebrados.
// MODIFICADO: v2.1 - Adicionado platformPostId aos details do evento.
// MODIFICADO: v2 - Corrigida métrica para 'comments' de stats e tratamento de null.
// MODIFICADO: Adicionado log de versão para depuração.
// MODIFICADO: Atualizado para usar post.postDate e tratamento seguro de datas.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types'; 
import { IEngagementPeakNotCapitalizedDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, isValid as isValidDate } from 'date-fns';
import {
    ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS,
    ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS,
    ENGAGEMENT_PEAK_MIN_ABSOLUTE_COMMENTS,
    ENGAGEMENT_PEAK_COMMENT_MULTIPLIER,
} from '@/app/lib/constants';
import { IMetricStats } from '@/app/models/Metric'; 
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';

const RULE_ID = 'engagement_peak_not_capitalized_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;
const HISTORICAL_COMMENT_AVG_LOOKBACK_DAYS = 60;
const METRIC_FOR_COMMENTS: keyof IMetricStats = 'comments';

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

export const engagementPeakNotCapitalizedRule: IRule = {
    id: RULE_ID,
    name: 'Pico de Comentários Não Capitalizado',
    description: 'Identifica posts recentes com um número de comentários significativamente acima da média, sugerindo oportunidade de follow-up.',
    priority: 9,
    lookbackDays: Math.max(ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS, HISTORICAL_COMMENT_AVG_LOOKBACK_DAYS),
    dataRequirements: [], 
    resendCooldownDays: 14,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const currentRuleVersion = "engagementPeakNotCapitalizedRule_v2.2"; 
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição... Usando métrica: ${METRIC_FOR_COMMENTS}`);

        const postsToCheck = allUserPosts
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) })) 
            .filter(item => {
                if (!item.postDateObj) return false;
                if (!item.post.stats) {
                    logger.warn(`${detectionTAG} Post ${item.post._id} sem 'stats', pulando na filtragem de postsToCheck.`);
                    return false;
                }
                const ageInDays = differenceInDays(today, item.postDateObj);
                return ageInDays >= ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS && ageInDays <= ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS;
            })
            .sort((a,b) => { 
                const commentsA = Number(a.post.stats?.[METRIC_FOR_COMMENTS] || 0);
                const commentsB = Number(b.post.stats?.[METRIC_FOR_COMMENTS] || 0);
                return commentsB - commentsA;
            })
            .map(item => item.post); 

        if (postsToCheck.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post encontrado no intervalo de idade [${ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS}-${ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS}] dias.`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${postsToCheck.length} posts encontrados para análise de pico de comentários.`);

        const historicalPostsForAvg = allUserPosts
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) })) 
            .filter(item => {
                if (!item.postDateObj) return false;
                if (!item.post.stats) {
                    logger.warn(`${detectionTAG} Post ${item.post._id} sem 'stats', pulando na filtragem de historicalPostsForAvg.`);
                    return false;
                }
                return differenceInDays(today, item.postDateObj) <= HISTORICAL_COMMENT_AVG_LOOKBACK_DAYS;
            })
            .map(item => item.post);

        if (historicalPostsForAvg.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post encontrado para calcular a média histórica de comentários.`);
            return { isMet: false }; 
        }
        
        const metricExtractor = (p: PostObjectForAverage): number | undefined => {
            const value = p.stats?.[METRIC_FOR_COMMENTS];
            if (typeof value === 'number' && !isNaN(value)) {
                return value;
            }
            return undefined;
        };
        const averageComments = calculateAverageMetric(
            historicalPostsForAvg,
            metricExtractor 
        );

        if (averageComments === null) {
            logger.warn(`${detectionTAG} Média histórica de comentários (${METRIC_FOR_COMMENTS}) não pôde ser calculada (calculateAverageMetric retornou null).`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} Média histórica de comentários (${METRIC_FOR_COMMENTS}): ${averageComments.toFixed(1)} (baseado em ${historicalPostsForAvg.length} posts).`);

        for (const post of postsToCheck) {
            const postComments = Number(post.stats?.[METRIC_FOR_COMMENTS] || 0);

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
            }
        }
        logger.debug(`${detectionTAG} Nenhuma condição atendida após verificar todos os posts elegíveis.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
        if (!conditionData || !conditionData.post || typeof conditionData.postComments !== 'number' || typeof conditionData.averageComments !== 'number') {
            logger.error(`${actionTAG} conditionData inválido ou incompleto.`);
            return null;
        }

        const post = conditionData.post as PostObjectForAverage;
        const postComments = conditionData.postComments as number;
        const averageComments = conditionData.averageComments as number;
        
        logger.info(`${actionTAG} Gerando evento para post ${post._id}. InstagramMediaId: ${post.instagramMediaId}`);

        const postDescriptionExcerptText = post.description ? post.description.substring(0, 70) : undefined;
        const postDescriptionForAI = post.description ? `"${post.description.substring(0, 70)}..."` : "um post recente";

        const details: IEngagementPeakNotCapitalizedDetails = {
            postId: post._id,
            platformPostId: post.instagramMediaId,
            postDescriptionExcerpt: postDescriptionExcerptText,
            comments: postComments,
            averageComments: averageComments, 
            postType: post.type,
            format: post.format,
            proposal: post.proposal,
            context: post.context,
        };

        // --- CORREÇÃO AQUI ---
        // Incluído o 'post.postLink' para garantir que a IA tenha o link correto para incluir na mensagem final.
        const messageForAI = `Radar Mobi detectou: Seu post (${post.postLink}) sobre ${postDescriptionForAI} gerou bastante conversa, com ${postComments} comentários! Isso é bem acima da sua média de ${averageComments.toFixed(1)}. Parece que sua audiência tem perguntas ou muito interesse no tema. Já considerou fazer um conteúdo de follow-up ou responder mais diretamente aos comentários para manter essa chama acesa?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
