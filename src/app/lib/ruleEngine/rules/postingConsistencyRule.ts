// src/app/lib/ruleEngine/rules/postingConsistencyRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IPostingConsistencyDetails } from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, subDays } from 'date-fns';
import { PostObjectForAverage } from '@/app/lib/utils';
// Importar constantes do arquivo central
import {
    // Adicione aqui constantes específicas para esta regra se necessário,
    // por exemplo, POSTING_CONSISTENCY_LOOKBACK_WEEKS, POSTING_CONSISTENCY_ALERT_THRESHOLD_DAYS
} from '@/app/lib/constants';

const RULE_ID = 'posting_consistency_check_v1';

// Constantes específicas da regra (podem ser movidas para constants.ts)
const CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG = 4; // Semanas para calcular a frequência média anterior
const CONSISTENCY_CHECK_PERIOD_DAYS = 7;    // Período recente para verificar a quebra de padrão
const CONSISTENCY_ALERT_THRESHOLD_DAYS_INCREASE = 3; // Alerta se a média de dias entre posts aumentar em X ou mais
const CONSISTENCY_MIN_POSTS_FOR_AVG = 3; // Mínimo de posts no período de lookback para calcular média

export const postingConsistencyRule: IRule = {
    id: RULE_ID,
    name: 'Verificação de Consistência de Postagem',
    description: 'Analisa a frequência de postagens e alerta se houve uma quebra significativa na consistência.',
    priority: 7, // Prioridade média
    lookbackDays: CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG * 7 + CONSISTENCY_CHECK_PERIOD_DAYS, // Ex: 4*7 + 7 = 35 dias
    dataRequirements: [], // Apenas allUserPosts
    resendCooldownDays: 7,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today } = context;
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        if (allUserPosts.length < CONSISTENCY_MIN_POSTS_FOR_AVG) {
            logger.debug(`${detectionTAG} Posts insuficientes (${allUserPosts.length}) para análise de consistência.`);
            return { isMet: false };
        }

        // Ordenar posts por data, do mais antigo para o mais recente
        const sortedPosts = [...allUserPosts].sort((a, b) => 
            (a.createdAt instanceof Date ? a.createdAt.getTime() : parseISO(a.createdAt as string).getTime()) -
            (b.createdAt instanceof Date ? b.createdAt.getTime() : parseISO(b.createdAt as string).getTime())
        );

        const lookbackStartDateForAvg = subDays(today, CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG * 7);
        
        const postsForAvgCalculation = sortedPosts.filter(p => {
            const postDate = p.createdAt instanceof Date ? p.createdAt : parseISO(p.createdAt as string);
            return postDate >= lookbackStartDateForAvg && postDate < subDays(today, CONSISTENCY_CHECK_PERIOD_DAYS); // Exclui o período de checagem mais recente
        });

        if (postsForAvgCalculation.length < CONSISTENCY_MIN_POSTS_FOR_AVG) {
            logger.debug(`${detectionTAG} Posts insuficientes (${postsForAvgCalculation.length}) no período de lookback para calcular a frequência média anterior.`);
            return { isMet: false };
        }

        let totalDaysBetweenPosts = 0;
        for (let i = 1; i < postsForAvgCalculation.length; i++) {
            const dateCurrent = postsForAvgCalculation[i]!.createdAt instanceof Date ? postsForAvgCalculation[i]!.createdAt : parseISO(postsForAvgCalculation[i]!.createdAt as string);
            const datePrevious = postsForAvgCalculation[i-1]!.createdAt instanceof Date ? postsForAvgCalculation[i-1]!.createdAt : parseISO(postsForAvgCalculation[i-1]!.createdAt as string);
            totalDaysBetweenPosts += differenceInDays(dateCurrent, datePrevious);
        }
        const previousAverageFrequencyDays = postsForAvgCalculation.length > 1 ? totalDaysBetweenPosts / (postsForAvgCalculation.length - 1) : CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG * 7;
        logger.debug(`${detectionTAG} Frequência média anterior: a cada ${previousAverageFrequencyDays.toFixed(1)} dias.`);

        const lastPostDate = sortedPosts[sortedPosts.length - 1]?.createdAt;
        if (!lastPostDate) {
            logger.debug(`${detectionTAG} Não foi possível determinar a data do último post.`);
            return { isMet: false };
        }
        const daysSinceLastPost = differenceInDays(today, (lastPostDate instanceof Date ? lastPostDate : parseISO(lastPostDate as string)));

        // Condição: Se o tempo desde o último post exceder significativamente a frequência média anterior
        if (daysSinceLastPost > previousAverageFrequencyDays + CONSISTENCY_ALERT_THRESHOLD_DAYS_INCREASE && daysSinceLastPost > CONSISTENCY_CHECK_PERIOD_DAYS / 2) {
             // E se a média anterior não for absurdamente alta (ex: postava a cada 30 dias)
            if (previousAverageFrequencyDays < (CONSISTENCY_LOOKBACK_WEEKS_FOR_AVG * 7) / 2) { // Evita alerta se já postava muito esporadicamente
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
        if (!conditionData || typeof conditionData.daysSinceLastPost !== 'number') {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }

        const { previousAverageFrequencyDays, daysSinceLastPost } = conditionData;
        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento.`);

        const details: IPostingConsistencyDetails = {
            previousAverageFrequencyDays: parseFloat(previousAverageFrequencyDays?.toFixed(1) ?? '0'),
            daysSinceLastPost,
            breakInPattern: true
        };
        
        let messageForAI = `Radar Tuca Alerta: Percebi que já faz ${daysSinceLastPost} dias desde o seu último post. `;
        if (previousAverageFrequencyDays && previousAverageFrequencyDays > 0 && previousAverageFrequencyDays < 15) { // Se havia uma frequência razoável antes
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
