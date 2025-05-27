// @/app/lib/fallbackInsightService/generators/tryGenerateFollowerGrowthInsight.ts
import { logger } from '@/app/lib/logger';
import type { IUserModel, IEnrichedReport, IAccountInsight, PotentialInsight } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES, GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    FOLLOWER_GROWTH_ABS_THRESHOLD,
    HISTORICAL_FOLLOWER_GROWTH_RATE_MIN_THRESHOLD
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre o crescimento de seguidores, mencionando a variação absoluta e a taxa de crescimento.
 */
export async function tryGenerateFollowerGrowthInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null,
    latestAccountInsights: IAccountInsight | null, // Parâmetro mantido para consistência da assinatura, embora não usado diretamente aqui.
    daysLookback: number // Parâmetro mantido para consistência da assinatura, embora não usado diretamente aqui.
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateFollowerGrowthInsight] User ${user._id}:`;
    const historicalData = enrichedReport?.historicalComparisons;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (
        historicalData &&
        typeof historicalData.followerChangeShortTerm === 'number' &&
        historicalData.followerChangeShortTerm > FOLLOWER_GROWTH_ABS_THRESHOLD &&
        typeof historicalData.followerGrowthRateShortTerm === 'number' &&
        historicalData.followerGrowthRateShortTerm >= HISTORICAL_FOLLOWER_GROWTH_RATE_MIN_THRESHOLD
    ) {
        const followerChange = historicalData.followerChangeShortTerm;
        const growthRatePercentage = (historicalData.followerGrowthRateShortTerm * 100).toFixed(1);

        logger.info(`${TAG} Insight de crescimento de seguidores (com taxa) gerado. Abs: ${followerChange}, Taxa: ${growthRatePercentage}%.`);
        return {
            text: `Excelentes notícias sobre o crescimento da sua comunidade, ${userNameForMsg}! 🎉 Nos últimos ${GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS} dias, você não só conquistou ${followerChange} novos seguidores, como isso representa um aumento de ${growthRatePercentage}% no seu total! É um ótimo sinal de que suas estratégias recentes estão ressoando e atraindo mais pessoas para o seu perfil. Mantenha esse ímpeto! Que tal pensarmos juntos em como dar as boas-vindas e engajar esses novos membros da sua comunidade?`,
            type: FALLBACK_INSIGHT_TYPES.FOLLOWER_GROWTH
        };
    } else if (
        historicalData &&
        typeof historicalData.followerChangeShortTerm === 'number' &&
        historicalData.followerChangeShortTerm > FOLLOWER_GROWTH_ABS_THRESHOLD
    ) {
        const followerChange = historicalData.followerChangeShortTerm;
        logger.info(`${TAG} Insight de crescimento de seguidores (apenas absoluto) gerado: ${followerChange}.`);
        return {
            text: `Ótimas notícias sobre o crescimento da sua comunidade, ${userNameForMsg}! Percebi que você conquistou ${followerChange} novos seguidores nos últimos ${GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS} dias. Isso é um sinal positivo de que suas estratégias recentes estão atraindo mais pessoas para o seu perfil. Continue com o bom trabalho! 👍 Que tal aproveitarmos esse momento para pensar em como engajar esses novos seguidores?`,
            type: FALLBACK_INSIGHT_TYPES.FOLLOWER_GROWTH
        };
    }

    logger.debug(`${TAG} Nenhuma condição para crescimento de seguidores atendida.`);
    return null;
}
