// @/app/lib/fallbackInsightService/generators/tryGenerateRecentReachLevelInsight.ts
import { logger } from '@/app/lib/logger';
import type { IUserModel, IEnrichedReport, PotentialInsight } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES, GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    HISTORICAL_RECENT_REACH_MIN_VALUE
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre o nível de alcance recente,
 * com base em dados históricos de curto prazo.
 */
export async function tryGenerateRecentReachLevelInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateRecentReachLevelInsight] User ${user._id}:`;
    const historicalData = enrichedReport?.historicalComparisons;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (
        historicalData &&
        typeof historicalData.avgReachPerPostShortTerm === 'number' &&
        historicalData.avgReachPerPostShortTerm >= HISTORICAL_RECENT_REACH_MIN_VALUE
    ) {
        const avgReach = historicalData.avgReachPerPostShortTerm.toFixed(0);
        logger.info(`${TAG} Insight de destaque de nível de alcance recente gerado: ${avgReach} pessoas/post.`);
        return {
            text: `Boas notícias, ${userNameForMsg}! Em média, seus posts alcançaram ${avgReach} pessoas nos últimos ${GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS} dias. Um bom alcance como este é uma excelente base, pois aumenta suas chances de fechar parcerias de publicidade e conquistar novos clientes. Lembre-se que alinhar esse alcance com um posicionamento claro para o público certo é fundamental para que essas oportunidades se concretizem! Que tal pensarmos em estratégias para refinar ainda mais quem você está alcançando ou como converter essa visibilidade em resultados para seus objetivos? 🎯`,
            type: FALLBACK_INSIGHT_TYPES.RECENT_REACH_LEVEL
        };
    }
    logger.debug(`${TAG} Dados insuficientes ou abaixo do limiar para insight de nível de alcance recente (Alcance: ${historicalData?.avgReachPerPostShortTerm?.toFixed(0)}, Limiar: ${HISTORICAL_RECENT_REACH_MIN_VALUE}).`);
    return null;
}
