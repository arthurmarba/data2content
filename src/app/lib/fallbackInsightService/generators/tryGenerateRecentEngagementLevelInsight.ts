// @/app/lib/fallbackInsightService/generators/tryGenerateRecentEngagementLevelInsight.ts
import { logger } from '@/app/lib/logger';
import type { IUserModel, IEnrichedReport, PotentialInsight } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES, GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    HISTORICAL_RECENT_ENGAGEMENT_MIN_VALUE
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre o nível de engajamento recente,
 * com base em dados históricos de curto prazo.
 */
export async function tryGenerateRecentEngagementLevelInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateRecentEngagementLevelInsight] User ${user._id}:`;
    const historicalData = enrichedReport?.historicalComparisons;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (
        historicalData &&
        typeof historicalData.avgEngagementPerPostShortTerm === 'number' &&
        historicalData.avgEngagementPerPostShortTerm >= HISTORICAL_RECENT_ENGAGEMENT_MIN_VALUE
    ) {
        const avgEngagement = historicalData.avgEngagementPerPostShortTerm.toFixed(0);
        logger.info(`${TAG} Insight de destaque de nível de engajamento recente gerado: ${avgEngagement} interações/post.`);
        return {
            text: `Olá ${userNameForMsg}! Dei uma olhada no seu desempenho recente e notei que, nos últimos ${GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS} dias, seus posts alcançaram uma média de ${avgEngagement} interações cada. Isso é um ótimo sinal de que você está construindo uma conexão sólida com sua audiência! Para manter essa chama acesa e quem sabe até aumentá-la, que tal experimentar algumas enquetes nos stories ou legendas que incentivem seus seguidores a compartilhar as opiniões deles? Conteúdo que gera conversa costuma ser muito bem recebido! 😉`,
            type: FALLBACK_INSIGHT_TYPES.RECENT_ENGAGEMENT_LEVEL
        };
    }
    logger.debug(`${TAG} Dados insuficientes ou abaixo do limiar para insight de nível de engajamento recente (Engajamento: ${historicalData?.avgEngagementPerPostShortTerm?.toFixed(0)}, Limiar: ${HISTORICAL_RECENT_ENGAGEMENT_MIN_VALUE}).`);
    return null;
}
