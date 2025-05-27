// src/app/lib/ruleEngine/rules/postingConsistencyRule.ts
// MODIFICADO: Adicionado log de versão para depuração.
// MODIFICADO: Atualizado para usar post.postDate e tratamento seguro de datas.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IPostingConsistencyDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, subDays, isValid as isValidDate } from 'date-fns'; 
import { PostObjectForAverage } from '@/app/lib/utils'; 
import {
    // Adicione aqui constantes específicas para esta regra se necessário,
} from '@/app/lib/constants';

const RULE_ID = 'posting_consistency_check_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

// Constantes específicas da regra (podem ser movidas para constants.ts)
const CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG = 4; 
const CONSISTENCY_CHECK_PERIOD_DAYS = 7;    
const CONSISTENCY_ALERT_THRESHOLD_DAYS_INCREASE = 3; 
const CONSISTENCY_MIN_POSTS_FOR_AVG = 3; 

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

export const postingConsistencyRule: IRule = {
    id: RULE_ID,
    name: 'Verificação de Consistência de Postagem',
    description: 'Analisa a frequência de postagens e alerta se houve uma quebra significativa na consistência.',
    priority: 7, 
    lookbackDays: CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG * 7 + CONSISTENCY_CHECK_PERIOD_DAYS, 
    dataRequirements: [], 
    resendCooldownDays: 7,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        // LOG DE VERSÃO ADICIONADO
        const currentRuleVersion = "postingConsistencyRule_v_CANVAS_LOG_25_05_21_22"; // String de versão única
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição...`);

        if (allUserPosts.length < CONSISTENCY_MIN_POSTS_FOR_AVG) {
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise de consistência.`);
            return { isMet: false };
        }

        const validPostsWithDate = allUserPosts
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) })) 
            .filter(item => item.postDateObj !== null) as { post: PostObjectForAverage; postDateObj: Date }[];

        if (validPostsWithDate.length < CONSISTENCY_MIN_POSTS_FOR_AVG) {
            logger.debug(`${detectionTAG} Posts válidos com data insuficientes (${validPostsWithDate.length}) para análise de consistência.`);
            return { isMet: false };
        }
        
        const sortedPostsWithDate = [...validPostsWithDate].sort((a, b) => 
            a.postDateObj.getTime() - b.postDateObj.getTime()
        );

        const lookbackStartDateForAvg = subDays(today, CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG * 7);
        
        const postsForAvgCalculation = sortedPostsWithDate.filter(item => {
            return item.postDateObj >= lookbackStartDateForAvg && item.postDateObj < subDays(today, CONSISTENCY_CHECK_PERIOD_DAYS); 
        });

        if (postsForAvgCalculation.length < CONSISTENCY_MIN_POSTS_FOR_AVG) {
            logger.debug(`${detectionTAG} Posts insuficientes (${postsForAvgCalculation.length}) no período de lookback para calcular a frequência média anterior.`);
            return { isMet: false };
        }

        let totalDaysBetweenPosts = 0;
        for (let i = 1; i < postsForAvgCalculation.length; i++) {
            const dateCurrent = postsForAvgCalculation[i]!.postDateObj;
            const datePrevious = postsForAvgCalculation[i-1]!.postDateObj;
            totalDaysBetweenPosts += differenceInDays(dateCurrent, datePrevious);
        }
        const previousAverageFrequencyDays = postsForAvgCalculation.length > 1 ? totalDaysBetweenPosts / (postsForAvgCalculation.length - 1) : CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG * 7;
        logger.debug(`${detectionTAG} Frequência média anterior: a cada ${previousAverageFrequencyDays.toFixed(1)} dias.`);

        const lastPostItem = sortedPostsWithDate[sortedPostsWithDate.length - 1];
        if (!lastPostItem) { 
            logger.debug(`${detectionTAG} Não foi possível determinar a data do último post (array ordenado vazio).`);
            return { isMet: false };
        }
        const lastPostDateObj = lastPostItem.postDateObj; 
        const daysSinceLastPost = differenceInDays(today, lastPostDateObj);

        if (daysSinceLastPost > previousAverageFrequencyDays + CONSISTENCY_ALERT_THRESHOLD_DAYS_INCREASE && daysSinceLastPost > CONSISTENCY_CHECK_PERIOD_DAYS / 2) {
            if (previousAverageFrequencyDays < (CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG * 7) / 2) { 
                logger.debug(`${detectionTAG} Condição ATENDIDA. Dias desde último post: ${daysSinceLastPost}, Média anterior: ${previousAverageFrequencyDays.toFixed(1)}`);
                return {
                    isMet: true,
                    data: {
                        previousAverageFrequencyDays,
                        daysSinceLastPost,
                        breakInPattern: true
                    }
                };
            }
        }

        logger.debug(`${detectionTAG} Condição NÃO atendida. Dias desde último post: ${daysSinceLastPost}.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
        if (!conditionData || typeof conditionData.daysSinceLastPost !== 'number') {
            logger.error(`${actionTAG} conditionData inválido ou incompleto. Data: ${JSON.stringify(conditionData)}`);
            return null;
        }

        const { previousAverageFrequencyDays, daysSinceLastPost } = conditionData;
        
        logger.info(`${actionTAG} Gerando evento.`);

        const details: IPostingConsistencyDetails = {
            previousAverageFrequencyDays: parseFloat(previousAverageFrequencyDays?.toFixed(1) ?? '0'),
            daysSinceLastPost,
            breakInPattern: true
        };
        
        let messageForAI = `Radar Tuca Alerta: Percebi que já faz ${daysSinceLastPost} dias desde o seu último post. `;
        if (previousAverageFrequencyDays && previousAverageFrequencyDays > 0 && previousAverageFrequencyDays < 15) { 
            messageForAI += `Antes, você costumava postar em média a cada ${previousAverageFrequencyDays.toFixed(0)} dias. Manter uma consistência pode ajudar muito seu alcance e engajamento. Aconteceu algo ou precisa de ideias?`;
        } else {
            messageForAI += `Manter uma presença regular no Instagram é importante para o crescimento. Que tal planejar seu próximo conteúdo?`;
        }

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
