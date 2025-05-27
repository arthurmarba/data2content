// @/app/lib/fallbackInsightService/generators/tryGenerateTotalPostsInsight.ts
import { parseISO, subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import type { IUserModel, IEnrichedReport, PotentialInsight, PostObject } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import { BASE_SERVICE_TAG } from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre o número total de posts no período de lookback.
 */
export async function tryGenerateTotalPostsInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null,
    daysLookback: number // Período para contagem de posts
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateTotalPostsInsight] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    // Filtra os posts recentes para contar apenas aqueles dentro do período de lookback
    const postsInPeriod = enrichedReport?.recentPosts?.filter((p: PostObject) => {
        const postTimestamp = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
        return postTimestamp >= subDays(new Date(), daysLookback);
    }).length || 0;

    if (postsInPeriod > 0) {
        logger.info(`${TAG} Insight de total de posts gerado: ${postsInPeriod} posts nos últimos ${daysLookback} dias.`);
        return {
            text: `Mantendo o ritmo, ${userNameForMsg}! Você compartilhou ${postsInPeriod} posts com sua audiência nos últimos ${daysLookback} dias. Uma boa frequência é fundamental para se manter relevante e presente na mente dos seus seguidores.`,
            type: FALLBACK_INSIGHT_TYPES.TOTAL_POSTS
        };
    }
    logger.debug(`${TAG} Nenhuma condição para insight de total de posts atendida (Posts no período: ${postsInPeriod}).`);
    return null;
}
