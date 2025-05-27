// src/app/lib/ruleEngine/rules/evergreenRepurposeRule.ts
// MODIFICADO: Adicionado log de versão para depuração.
// MODIFICADO: Atualizado para usar post.postDate e tratamento seguro de datas.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IEvergreenRepurposeDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, subMonths, isBefore, isValid as isValidDate } from 'date-fns'; // Adicionado isValidDate
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils'; // PostObjectForAverage já usa postDate
import {
    UNTAPPED_POTENTIAL_PERFORMANCE_METRIC // Reutilizando uma métrica de performance existente
} from '@/app/lib/constants';

const RULE_ID = 'evergreen_repurpose_suggestion_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

// Constantes específicas da regra (podem ser movidas para constants.ts se não estiverem lá)
const EVERGREEN_MIN_POST_AGE_MONTHS = 6;
const EVERGREEN_MAX_POST_AGE_MONTHS = 18; 
const EVERGREEN_PERFORMANCE_MULTIPLIER = 1.5; 
const EVERGREEN_MIN_POSTS_FOR_HISTORICAL_AVG = 10;
const EVERGREEN_RECENT_REPOST_THRESHOLD_DAYS = 90; 

// Função auxiliar para obter um objeto Date válido a partir de um campo Date | string
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
        // LOG DE VERSÃO ADICIONADO
        const currentRuleVersion = "evergreenRepurposeRule_v_CANVAS_LOG_25_05_22_10"; // String de versão única
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição...`);

        const minDate = subMonths(today, EVERGREEN_MAX_POST_AGE_MONTHS);
        const maxDate = subMonths(today, EVERGREEN_MIN_POST_AGE_MONTHS);

        const candidatePosts = allUserPosts
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) })) // MODIFICADO: Usa post.postDate
            .filter(item => {
                if (!item.postDateObj) return false;
                return isBefore(item.postDateObj, maxDate) && item.postDateObj >= minDate;
            })
            .map(item => item.post);

        if (candidatePosts.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post encontrado no intervalo de idade para análise evergreen.`);
            return { isMet: false };
        }

        const historicalPostsForAvg = allUserPosts
            .map(p => ({ post: p, postDateObj: getValidDate(p.postDate, p._id, detectionTAG) })) // MODIFICADO: Usa post.postDate
            .filter(item => {
                if (!item.postDateObj) return false;
                return item.postDateObj < maxDate; 
            })
            .map(item => item.post);

        if (historicalPostsForAvg.length < EVERGREEN_MIN_POSTS_FOR_HISTORICAL_AVG) {
            logger.debug(`${detectionTAG} Posts históricos insuficientes (${historicalPostsForAvg.length}) para calcular média de referência.`);
            return { isMet: false };
        }
        
        const historicalAvgPerformance = calculateAverageMetric(historicalPostsForAvg, UNTAPPED_POTENTIAL_PERFORMANCE_METRIC as keyof PostObjectForAverage);
        if (historicalAvgPerformance === null || historicalAvgPerformance === 0) { // Adicionada verificação de null
             logger.debug(`${detectionTAG} Média histórica de performance é zero ou não pôde ser calculada. Pulando.`);
             return { isMet: false };
        }

        candidatePosts.sort((a, b) => { 
            const perfA = ((a as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (a.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number;
            const perfB = ((b as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (b.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number;
            return perfB - perfA;
        });

        for (const oldPost of candidatePosts) {
            const oldPostPerformance = ((oldPost as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (oldPost.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number;

            if (oldPostPerformance > historicalAvgPerformance * EVERGREEN_PERFORMANCE_MULTIPLIER) {
                const recentPosts = allUserPosts
                    .map(p => ({ post: p, postDateObj: getValidDate(p.postDate, p._id, detectionTAG) })) // MODIFICADO: Usa post.postDate
                    .filter(item => {
                        if (!item.postDateObj) return false;
                        return differenceInDays(today, item.postDateObj) <= EVERGREEN_RECENT_REPOST_THRESHOLD_DAYS;
                    })
                    .map(item => item.post);

                const isRecentlyReposted = recentPosts.some(rp => 
                    (rp.format && rp.format === oldPost.format) && 
                    (rp.proposal && rp.proposal === oldPost.proposal)
                    // Poderia adicionar verificação de contexto também se relevante: && (rp.context && rp.context === oldPost.context)
                );

                if (isRecentlyReposted) {
                    logger.debug(`${detectionTAG} Post evergreen potencial ${oldPost._id} parece ter sido revisitado recentemente.`);
                    continue;
                }
                
                logger.debug(`${detectionTAG} Condição ATENDIDA para post evergreen ${oldPost._id}. Performance: ${oldPostPerformance}, Média Histórica: ${historicalAvgPerformance}`);
                return {
                    isMet: true,
                    data: {
                        originalPost: oldPost as PostObjectForAverage,
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

        const originalPost = conditionData.originalPost as PostObjectForAverage;
        const originalPostMetricValue = conditionData.originalPostMetricValue as number;
        const originalPostMetricName = conditionData.originalPostMetricName as string;
        
        logger.info(`${actionTAG} Gerando evento para reutilização do post ${originalPost._id}.`);

        // MODIFICADO: Usa getValidDate com originalPost.postDate
        const originalPostDateObj = getValidDate(originalPost.postDate, originalPost._id, actionTAG);
        if (!originalPostDateObj) {
            logger.error(`${actionTAG} Data inválida para originalPost ${originalPost._id}. Não é possível gerar alerta.`);
            return null;
        }

        const postDescriptionExcerpt = originalPost.description ? originalPost.description.substring(0, 70) : "um post antigo";
        const suggestionTypes: IEvergreenRepurposeDetails['suggestionType'][] = ['tbt', 'new_angle', 'story_series'];
        const randomSuggestionType = suggestionTypes[Math.floor(Math.random() * suggestionTypes.length)]!;

        const details: IEvergreenRepurposeDetails = {
            originalPostId: originalPost._id,
            originalPostDate: originalPostDateObj, // Usa o objeto Date validado
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
            detailsForLog: details
        };
    }
};
