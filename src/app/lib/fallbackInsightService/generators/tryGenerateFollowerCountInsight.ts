// @/app/lib/fallbackInsightService/generators/tryGenerateFollowerCountInsight.ts
import { logger } from '@/app/lib/logger';
import type { IUserModel, IEnrichedReport, IAccountInsight, PotentialInsight } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    FOLLOWER_GROWTH_ABS_THRESHOLD, // Usado para verificar se o crescimento já foi/será mencionado
    HISTORICAL_FOLLOWER_GROWTH_RATE_MIN_THRESHOLD // Usado para verificar se o crescimento já foi/será mencionado
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight simples sobre a contagem atual de seguidores,
 * apenas se um insight de crescimento mais detalhado não for aplicável.
 */
export async function tryGenerateFollowerCountInsight(
    user: IUserModel,
    latestAccountInsights: IAccountInsight | null,
    enrichedReport: IEnrichedReport | null // enrichedReport é usado para verificar se o crescimento já foi mencionado
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateFollowerCountInsight] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    // Verifica se um insight de crescimento de seguidores mais específico já foi ou será gerado.
    // Se sim, este insight mais genérico sobre a contagem total não é necessário.
    const growthAlreadyMentionedOrWillBe =
        (enrichedReport?.historicalComparisons?.followerChangeShortTerm &&
            enrichedReport.historicalComparisons.followerChangeShortTerm > FOLLOWER_GROWTH_ABS_THRESHOLD) ||
        (enrichedReport?.historicalComparisons?.followerGrowthRateShortTerm &&
            enrichedReport.historicalComparisons.followerGrowthRateShortTerm >= HISTORICAL_FOLLOWER_GROWTH_RATE_MIN_THRESHOLD);

    if (!growthAlreadyMentionedOrWillBe && latestAccountInsights?.followersCount && latestAccountInsights.followersCount > 0) {
        logger.info(`${TAG} Insight de contagem de seguidores gerado: ${latestAccountInsights.followersCount}.`);
        return {
            text: `Sua comunidade está crescendo, ${userNameForMsg}! Atualmente você conta com ${latestAccountInsights.followersCount} seguidores acompanhando seu trabalho. Cada um deles é uma conexão valiosa!`,
            type: FALLBACK_INSIGHT_TYPES.FOLLOWER_COUNT
        };
    }
    if (growthAlreadyMentionedOrWillBe) {
        logger.debug(`${TAG} Insight de contagem de seguidores não gerado pois um insight de crescimento mais específico é aplicável.`);
    } else {
        logger.debug(`${TAG} Condições para insight de contagem de seguidores não atendidas (followersCount: ${latestAccountInsights?.followersCount}).`);
    }
    return null;
}
