// src/app/lib/ruleEngine/rules/evergreenRepurposeRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IEvergreenRepurposeDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, subMonths, isBefore } from 'date-fns';
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';
// Importar constantes do arquivo central
import {
    // Adicione aqui constantes específicas para esta regra se necessário,
    // por exemplo, EVERGREEN_MIN_POST_AGE_MONTHS, EVERGREEN_PERFORMANCE_MULTIPLIER
    UNTAPPED_POTENTIAL_PERFORMANCE_METRIC // Reutilizando uma métrica de performance existente
} from '@/app/lib/constants';

const RULE_ID = 'evergreen_repurpose_suggestion_v1';

// Constantes específicas da regra
const EVERGREEN_MIN_POST_AGE_MONTHS = 6;
const EVERGREEN_MAX_POST_AGE_MONTHS = 18; // Não pegar posts excessivamente antigos
const EVERGREEN_PERFORMANCE_MULTIPLIER = 1.5; // Post deve ser X% acima da média da sua época
const EVERGREEN_MIN_POSTS_FOR_HISTORICAL_AVG = 10;
const EVERGREEN_RECENT_REPOST_THRESHOLD_DAYS = 90; // Não sugerir se algo similar foi postado nos últimos 90 dias

export const evergreenRepurposeRule: IRule = {
    id: RULE_ID,
    name: 'Sugestão de Reutilização de Conteúdo Evergreen',
    description: 'Identifica posts antigos de alta performance e sugere reutilizá-los.',
    priority: 5, // Prioridade um pouco mais baixa
    lookbackDays: EVERGREEN_MAX_POST_AGE_MONTHS * 31, // Aproximadamente
    dataRequirements: [], // Apenas allUserPosts
    resendCooldownDays: 45,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        const minDate = subMonths(today, EVERGREEN_MAX_POST_AGE_MONTHS);
        const maxDate = subMonths(today, EVERGREEN_MIN_POST_AGE_MONTHS);

        const candidatePosts = allUserPosts.filter(post => {
            if (!post.createdAt) return false;
            const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            return isBefore(postDate, maxDate) && postDate >= minDate;
        });

        if (candidatePosts.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post encontrado no intervalo de idade para análise evergreen.`);
            return { isMet: false };
        }

        // Calcular média de performance da época dos posts candidatos
        // Poderia ser mais sofisticado, pegando posts do mesmo período dos candidatos
        const historicalPostsForAvg = allUserPosts.filter(p => {
            if (!p.createdAt) return false;
            const pDate = p.createdAt instanceof Date ? p.createdAt : parseISO(p.createdAt as string);
            return pDate < maxDate; // Posts mais antigos que o limite superior dos candidatos
        });

        if (historicalPostsForAvg.length < EVERGREEN_MIN_POSTS_FOR_HISTORICAL_AVG) {
            logger.debug(`${detectionTAG} Posts históricos insuficientes para calcular média de referência.`);
            return { isMet: false };
        }
        
        const historicalAvgPerformance = calculateAverageMetric(historicalPostsForAvg, UNTAPPED_POTENTIAL_PERFORMANCE_METRIC as keyof PostObjectForAverage);
        if (historicalAvgPerformance === 0) {
             logger.debug(`${detectionTAG} Média histórica de performance é zero. Pulando.`);
             return { isMet: false };
        }

        candidatePosts.sort((a, b) => { // Priorizar posts com maior performance
            const perfA = ((a as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (a.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number;
            const perfB = ((b as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (b.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number;
            return perfB - perfA;
        });

        for (const oldPost of candidatePosts) {
            const oldPostPerformance = ((oldPost as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (oldPost.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number;

            if (oldPostPerformance > historicalAvgPerformance * EVERGREEN_PERFORMANCE_MULTIPLIER) {
                // Verificar se um post com tema/formato similar foi postado recentemente
                const recentPosts = allUserPosts.filter(p => {
                    if (!p.createdAt) return false;
                    const pDate = p.createdAt instanceof Date ? p.createdAt : parseISO(p.createdAt as string);
                    return differenceInDays(today, pDate) <= EVERGREEN_RECENT_REPOST_THRESHOLD_DAYS;
                });

                const isRecentlyReposted = recentPosts.some(rp => 
                    (rp.format && rp.format === oldPost.format) && 
                    (rp.proposal && rp.proposal === oldPost.proposal)
                );

                if (isRecentlyReposted) {
                    logger.debug(`${detectionTAG} Post evergreen potencial ${oldPost._id} parece ter sido revisitado recentemente.`);
                    continue;
                }
                
                // (Opcional mais complexo) Inferir se é "evergreen" pela descrição ou tipo. Por agora, focamos na performance.

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
        if (!conditionData || !conditionData.originalPost) {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }

        const originalPost = conditionData.originalPost as PostObjectForAverage;
        const originalPostMetricValue = conditionData.originalPostMetricValue as number;
        const originalPostMetricName = conditionData.originalPostMetricName as string;
        
        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento para reutilização do post ${originalPost._id}.`);

        const postDescriptionExcerpt = originalPost.description ? originalPost.description.substring(0, 70) : "um post antigo";
        const suggestionTypes: IEvergreenRepurposeDetails['suggestionType'][] = ['tbt', 'new_angle', 'story_series'];
        const randomSuggestionType = suggestionTypes[Math.floor(Math.random() * suggestionTypes.length)]!;

        const details: IEvergreenRepurposeDetails = {
            originalPostId: originalPost._id,
            originalPostDate: originalPost.createdAt instanceof Date ? originalPost.createdAt : parseISO(originalPost.createdAt as string),
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
