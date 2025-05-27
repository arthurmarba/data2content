// @/app/lib/fallbackInsightService/generators/tryGenerateAvgLikesInsight.ts
import { parseISO, subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, PotentialInsight, DailySnapshot } from '../fallbackInsight.types';
import { calculateAverageMetricFromPosts } from '../utils/calculateAverageMetricFromPosts';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    AVG_LIKES_MIN_FOR_INSIGHT,
    AVG_LIKES_MIN_DAY1_LIKES_FOR_MENTION
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre a média de curtidas dos posts recentes.
 * Inclui um detalhe granular sobre o desempenho inicial do post mais recente com curtidas.
 * OTIMIZADO: Adiciona menção a dailyFollows se relevante.
 */
export async function tryGenerateAvgLikesInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null,
    daysLookback: number
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateAvgLikesInsight_Optimized] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    const postsToConsider = enrichedReport?.recentPosts?.filter(p => {
        const postDate = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
        return postDate >= subDays(new Date(), daysLookback) && p.stats && typeof p.stats.likes === 'number';
    });

    if (!postsToConsider || postsToConsider.length === 0) {
        logger.debug(`${TAG} Sem posts recentes com dados de curtidas para analisar.`);
        return null;
    }

    const avgLikes = calculateAverageMetricFromPosts(
        postsToConsider,
        stats => stats.likes
    );

    if (avgLikes !== null && avgLikes > AVG_LIKES_MIN_FOR_INSIGHT) {
        let granularDetailText = "";
        let additionalImpactText = ""; // Para dailyFollows, etc.

        const sortedPosts = [...postsToConsider].sort((a, b) =>
            (b.postDate instanceof Date ? b.postDate.getTime() : parseISO(b.postDate as string).getTime()) -
            (a.postDate instanceof Date ? a.postDate.getTime() : parseISO(a.postDate as string).getTime())
        );
        const mostRecentPostWithLikes = sortedPosts[0];

        if (mostRecentPostWithLikes?._id) {
            try {
                const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(mostRecentPostWithLikes._id.toString(), user._id.toString());
                const day1Snapshot = snapshots.find(s => s.dayNumber === 1);
                if (day1Snapshot) {
                    if (typeof day1Snapshot.dailyLikes === 'number' && day1Snapshot.dailyLikes >= AVG_LIKES_MIN_DAY1_LIKES_FOR_MENTION) {
                        const postDesc = mostRecentPostWithLikes.description?.substring(0, 30) || "seu post mais recente";
                        const postLink = mostRecentPostWithLikes.platformPostId ? `https://www.instagram.com/p/${mostRecentPostWithLikes.platformPostId}/` : "";
                        granularDetailText = ` Por exemplo, seu post "${postDesc}..." ${postLink ? `(${postLink})` : ''} já começou bem, conquistando ${day1Snapshot.dailyLikes} curtidas logo no primeiro dia!`;

                        // Otimização: Adicionar menção a novos seguidores
                        if (typeof day1Snapshot.dailyFollows === 'number' && day1Snapshot.dailyFollows > 0) {
                            additionalImpactText = ` Ele também trouxe ${day1Snapshot.dailyFollows} novo(s) seguidor(es) nesse dia.`;
                        }
                    }
                }
            } catch (e: any) {
                logger.warn(`${TAG} Erro ao buscar snapshot para ${mostRecentPostWithLikes._id}: ${e.message}`);
            }
        }
        logger.info(`${TAG} Insight de média de curtidas gerado. Média: ${avgLikes.toFixed(0)}.`);
        return {
            text: `Em média, ${userNameForMsg}, seus posts tiveram ${avgLikes.toFixed(0)} curtidas nos últimos ${daysLookback} dias.${granularDetailText}${additionalImpactText} É um bom termômetro do que seu público mais aprecia! Você tem notado algum padrão nos tipos de conteúdo que recebem mais curtidas?`,
            type: FALLBACK_INSIGHT_TYPES.AVG_LIKES_METRIC
        };
    }
    logger.debug(`${TAG} Média de curtidas (${avgLikes?.toFixed(0)}) não atingiu o limiar (${AVG_LIKES_MIN_FOR_INSIGHT}).`);
    return null;
}
