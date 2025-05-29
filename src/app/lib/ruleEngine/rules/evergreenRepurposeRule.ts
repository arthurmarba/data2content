// src/app/lib/ruleEngine/rules/evergreenRepurposeRule.ts
// MODIFICADO: v1.1 - Adicionado originalPlatformPostId aos details do evento.
// MODIFICADO: Adicionado log de versão para depuração.
// MODIFICADO: Atualizado para usar post.postDate e tratamento seguro de datas.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IEvergreenRepurposeDetails } from '@/app/models/User'; // IEvergreenRepurposeDetails já tem originalPlatformPostId?
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, subMonths, isBefore, isValid as isValidDate } from 'date-fns'; 
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils'; // PostObjectForAverage agora tem instagramMediaId?
import {
    UNTAPPED_POTENTIAL_PERFORMANCE_METRIC 
} from '@/app/lib/constants';
import { IMetricStats } from '@/app/models/Metric'; // Import IMetricStats

const RULE_ID = 'evergreen_repurpose_suggestion_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

const EVERGREEN_MIN_POST_AGE_MONTHS = 6;
const EVERGREEN_MAX_POST_AGE_MONTHS = 18; 
const EVERGREEN_PERFORMANCE_MULTIPLIER = 1.5; 
const EVERGREEN_MIN_POSTS_FOR_HISTORICAL_AVG = 10;
const EVERGREEN_RECENT_REPOST_THRESHOLD_DAYS = 90; 

function getValidDate(dateInput: Date | string | undefined, postId?: string, tag?: string): Date | null {
    const logTag = tag || RULE_TAG_BASE;
    if (!dateInput) {
        if (postId) logger.warn(`${logTag} Post ${postId} não tem data definida.`);
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

export const evergreenRepurposeRule: IRule = {
    id: RULE_ID,
    name: 'Sugestão de Reutilização de Conteúdo Evergreen',
    description: 'Identifica posts antigos de alta performance e sugere reutilizá-los.',
    priority: 5, 
    lookbackDays: EVERGREEN_MAX_POST_AGE_MONTHS * 31, 
    dataRequirements: [], 
    resendCooldownDays: 45,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const currentRuleVersion = "evergreenRepurposeRule_v1.1_CANVAS_PLATFORMPOSTID"; 
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição...`);

        const minDate = subMonths(today, EVERGREEN_MAX_POST_AGE_MONTHS);
        const maxDate = subMonths(today, EVERGREEN_MIN_POST_AGE_MONTHS);

        const candidatePosts = allUserPosts
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) })) 
            .filter(item => {
                if (!item.postDateObj) return false;
                // Garante que post.stats existe antes de tentar acessá-lo
                if (!item.post.stats) {
                    logger.warn(`${detectionTAG} Post ${item.post._id} sem 'stats', pulando na filtragem de candidatePosts.`);
                    return false;
                }
                return isBefore(item.postDateObj, maxDate) && item.postDateObj >= minDate;
            })
            .map(item => item.post);

        if (candidatePosts.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post encontrado no intervalo de idade para análise evergreen.`);
            return { isMet: false };
        }

        const historicalPostsForAvg = allUserPosts
            .map(p => ({ post: p, postDateObj: getValidDate(p.postDate, p._id, detectionTAG) })) 
            .filter(item => {
                if (!item.postDateObj) return false;
                 // Garante que post.stats existe
                if (!item.post.stats) {
                    logger.warn(`${detectionTAG} Post ${item.post._id} sem 'stats', pulando na filtragem de historicalPostsForAvg.`);
                    return false;
                }
                return item.postDateObj < maxDate; 
            })
            .map(item => item.post);

        if (historicalPostsForAvg.length < EVERGREEN_MIN_POSTS_FOR_HISTORICAL_AVG) {
            logger.debug(`${detectionTAG} Posts históricos insuficientes (${historicalPostsForAvg.length}) para calcular média de referência.`);
            return { isMet: false };
        }
        
        // Usando a constante UNTAPPED_POTENTIAL_PERFORMANCE_METRIC que é uma keyof IMetricStats
        const metricExtractor = (p: PostObjectForAverage): number | undefined => {
            const value = p.stats?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC];
            if (typeof value === 'number' && !isNaN(value)) {
                return value;
            }
            return undefined;
        };
        const historicalAvgPerformance = calculateAverageMetric(historicalPostsForAvg, metricExtractor);

        if (historicalAvgPerformance === null || historicalAvgPerformance === 0) { 
             logger.debug(`${detectionTAG} Média histórica de performance (${UNTAPPED_POTENTIAL_PERFORMANCE_METRIC}) é zero ou não pôde ser calculada. Pulando.`);
             return { isMet: false };
        }

        candidatePosts.sort((a, b) => { 
            // Acessa a métrica via a.stats e b.stats
            const perfA = Number(a.stats?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] || 0);
            const perfB = Number(b.stats?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] || 0);
            return perfB - perfA;
        });

        for (const oldPost of candidatePosts) {
            // Acessa a métrica via oldPost.stats
            const oldPostPerformance = Number(oldPost.stats?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] || 0);

            if (oldPostPerformance > historicalAvgPerformance * EVERGREEN_PERFORMANCE_MULTIPLIER) {
                const recentPosts = allUserPosts
                    .map(p => ({ post: p, postDateObj: getValidDate(p.postDate, p._id, detectionTAG) })) 
                    .filter(item => {
                        if (!item.postDateObj) return false;
                        return differenceInDays(today, item.postDateObj) <= EVERGREEN_RECENT_REPOST_THRESHOLD_DAYS;
                    })
                    .map(item => item.post);

                const isRecentlyReposted = recentPosts.some(rp => 
                    (rp.format && rp.format === oldPost.format) && 
                    (rp.proposal && rp.proposal === oldPost.proposal)
                );

                if (isRecentlyReposted) {
                    logger.debug(`${detectionTAG} Post evergreen potencial ${oldPost._id} parece ter sido revisitado recentemente.`);
                    continue;
                }
                
                logger.debug(`${detectionTAG} Condição ATENDIDA para post evergreen ${oldPost._id}. Performance: ${oldPostPerformance}, Média Histórica: ${historicalAvgPerformance}`);
                return {
                    isMet: true,
                    data: {
                        originalPost: oldPost as PostObjectForAverage, // originalPost é PostObjectForAverage e deve ter instagramMediaId
                        originalPostMetricValue: oldPostPerformance,
                        originalPostMetricName: String(UNTAPPED_POTENTIAL_PERFORMANCE_METRIC)
                    }
                };
            }
        }

        logger.debug(`${detectionTAG} Nenhuma condição para sugestão de conteúdo evergreen atendida.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
        if (!conditionData || !conditionData.originalPost) {
            logger.error(`${actionTAG} conditionData inválido ou incompleto.`);
            return null;
        }

        const originalPost = conditionData.originalPost as PostObjectForAverage; // originalPost agora tem instagramMediaId?
        const originalPostMetricValue = conditionData.originalPostMetricValue as number;
        const originalPostMetricName = conditionData.originalPostMetricName as string;
        
        logger.info(`${actionTAG} Gerando evento para reutilização do post ${originalPost._id}. InstagramMediaId: ${originalPost.instagramMediaId}`);
        
        const originalPostDateObj = getValidDate(originalPost.postDate, originalPost._id, actionTAG);
        if (!originalPostDateObj) {
            logger.error(`${actionTAG} Data inválida para originalPost ${originalPost._id}. Não é possível gerar alerta.`);
            return null;
        }

        // Usando originalPost.description que foi adicionado a PostObjectForAverage
        const postDescriptionExcerpt = originalPost.description ? originalPost.description.substring(0, 70) : "um post antigo";
        const suggestionTypes: IEvergreenRepurposeDetails['suggestionType'][] = ['tbt', 'new_angle', 'story_series'];
        const randomSuggestionType = suggestionTypes[Math.floor(Math.random() * suggestionTypes.length)]!;

        const details: IEvergreenRepurposeDetails = {
            originalPostId: originalPost._id,
            originalPlatformPostId: originalPost.instagramMediaId, // <-- MODIFICAÇÃO PRINCIPAL AQUI
            originalPostDate: originalPostDateObj, 
            originalPostDescriptionExcerpt: postDescriptionExcerpt,
            originalPostMetricValue,
            originalPostMetricName,
            suggestionType: randomSuggestionType
        };
        
        let suggestionText = "";
        switch(randomSuggestionType) {
            case 'tbt':
                suggestionText = `Que tal um #tbt relembrando ele?`;
                break;
            case 'new_angle':
                suggestionText = `Você poderia criar um novo conteúdo explorando uma nova perspectiva sobre o assunto.`;
                break;
            case 'story_series':
                suggestionText = `Pode ser uma ótima ideia para uma série de stories, aprofundando os pontos principais!`;
                break;
            default:
                suggestionText = `Que tal revisitá-lo?`;
        }

        const messageForAI = `Radar Tuca Recomenda: Lembra daquele seu post sobre "${postDescriptionExcerpt}" que teve um ótimo desempenho (${originalPostMetricName}: ${originalPostMetricValue.toFixed(0)})? O conteúdo parece ainda ser super relevante! ${suggestionText}`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details // detailsForLog já aceita IEvergreenRepurposeDetails com originalPlatformPostId
        };
    }
};
