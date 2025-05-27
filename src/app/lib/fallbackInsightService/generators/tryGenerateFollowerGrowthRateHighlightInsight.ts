// @/app/lib/fallbackInsightService/generators/tryGenerateFollowerGrowthRateHighlightInsight.ts
import { logger } from '@/app/lib/logger';
import type { IUserModel, IEnrichedReport, PotentialInsight } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES, GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    HISTORICAL_FOLLOWER_GROWTH_RATE_MIN_THRESHOLD
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight destacando a taxa de crescimento de seguidores, se for significativa.
 */
export async function tryGenerateFollowerGrowthRateHighlightInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateFollowerGrowthRateHighlightInsight] User ${user._id}:`;
    const historicalData = enrichedReport?.historicalComparisons;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (
        historicalData &&
        typeof historicalData.followerGrowthRateShortTerm === 'number' &&
        historicalData.followerGrowthRateShortTerm >= HISTORICAL_FOLLOWER_GROWTH_RATE_MIN_THRESHOLD
    ) {
        // Verifica se o insight FOLLOWER_GROWTH mais completo (que inclui a taxa) já cobriria isso.
        // Este insight só deve aparecer se o FOLLOWER_GROWTH não for acionado com a taxa,
        // o que é improvável dada a lógica atual, mas mantido por precaução ou futuras alterações.
        // A lógica original de `getFallbackInsight` já prioriza FOLLOWER_GROWTH.
        // No entanto, se FOLLOWER_GROWTH fosse alterado para não mencionar a taxa em alguns casos, este seria útil.
        // Por ora, a condição é a mesma, o que pode levar a redundância se a ordem no orquestrador não for gerenciada.
        // O orquestrador deve chamar `tryGenerateFollowerGrowthInsight` antes deste.

        const growthRatePercentage = (historicalData.followerGrowthRateShortTerm * 100).toFixed(1);
        logger.info(`${TAG} Insight de destaque de taxa de crescimento de seguidores gerado: ${growthRatePercentage}%.`);
        return {
            text: `Olá ${userNameForMsg}, que ótima notícia! 🚀 Sua taxa de crescimento de seguidores está em ${growthRatePercentage}% nos últimos ${GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS} dias. Isso é um indicativo muito positivo de que suas estratégias estão funcionando e seu perfil está cada vez mais atraente. Para manter esse ritmo, que tal analisarmos quais tipos de conteúdo ou ações recentes podem ter contribuído para esse aumento?`,
            type: FALLBACK_INSIGHT_TYPES.FOLLOWER_GROWTH_RATE_HIGHLIGHT
        };
    }
    logger.debug(`${TAG} Taxa de crescimento de seguidores não atingiu o limiar para destaque ou dados insuficientes.`);
    return null;
}
