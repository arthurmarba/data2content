// @/app/lib/fallbackInsightService/generators/tryGenerateAvgReachInsight.ts
import { parseISO, subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, PotentialInsight, DailySnapshot, PostObject } from '../fallbackInsight.types';
import { calculateAverageMetricFromPosts } from '../utils/calculateAverageMetricFromPosts';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    AVG_REACH_MIN_FOR_INSIGHT,
    AVG_REACH_MIN_DAY1_REACH_FOR_MENTION
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre o alcance médio dos posts recentes.
 * Inclui um detalhe granular sobre o desempenho inicial de alcance do post mais recente.
 * OTIMIZADO: Adiciona menção a dailyFollows e, se for Reel, currentReelsAvgWatchTime.
 */
export async function tryGenerateAvgReachInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null,
    daysLookback: number
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateAvgReachInsight_Optimized] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    const postsToConsider = enrichedReport?.recentPosts?.filter(p => {
        const postDate = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
        return postDate >= subDays(new Date(), daysLookback) && p.stats && typeof p.stats.reach === 'number';
    });

    if (!postsToConsider || postsToConsider.length === 0) {
        logger.debug(`${TAG} Sem posts recentes com dados de alcance para analisar.`);
        return null;
    }

    const avgReach = calculateAverageMetricFromPosts(
        postsToConsider,
        stats => stats.reach
    );

    if (avgReach !== null && avgReach > AVG_REACH_MIN_FOR_INSIGHT) {
        let granularDetailText = "";
        let additionalImpactText = ""; // Para dailyFollows, etc.
        let reelSpecificText = ""; // Para métricas de Reels

        const sortedPosts = [...postsToConsider].sort((a, b) =>
            (b.postDate instanceof Date ? b.postDate.getTime() : parseISO(b.postDate as string).getTime()) -
            (a.postDate instanceof Date ? a.postDate.getTime() : parseISO(a.postDate as string).getTime())
        );
        const mostRecentPostWithReach = sortedPosts[0] as PostObject; // Cast para PostObject para acessar 'type'

        if (mostRecentPostWithReach?._id) {
            try {
                const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(mostRecentPostWithReach._id.toString(), user._id.toString());
                const day1Snapshot = snapshots.find(s => s.dayNumber === 1);
                if (day1Snapshot) {
                    if (typeof day1Snapshot.dailyReach === 'number' && day1Snapshot.dailyReach >= AVG_REACH_MIN_DAY1_REACH_FOR_MENTION) {
                        const postDesc = mostRecentPostWithReach.description?.substring(0, 30) || "seu post mais recente";
                        const postLink = mostRecentPostWithReach.platformPostId ? `https://www.instagram.com/p/${mostRecentPostWithReach.platformPostId}/` : "";
                        granularDetailText = ` Seu post mais recente, "${postDesc}..." ${postLink ? `(${postLink})` : ''}, por exemplo, já alcançou ${day1Snapshot.dailyReach.toFixed(0)} pessoas só no primeiro dia!`;

                        // Otimização: Adicionar menção a novos seguidores
                        if (typeof day1Snapshot.dailyFollows === 'number' && day1Snapshot.dailyFollows > 0) {
                            additionalImpactText = ` Além disso, gerou ${day1Snapshot.dailyFollows} novo(s) seguidor(es) nesse dia.`;
                        }

                        // Otimização: Se for um Reel, adicionar tempo médio de visualização
                        if ((mostRecentPostWithReach.type === 'REEL' || mostRecentPostWithReach.type === 'VIDEO') &&
                            typeof day1Snapshot.currentReelsAvgWatchTime === 'number' && day1Snapshot.currentReelsAvgWatchTime > 0) {
                            reelSpecificText = ` E quem viu, assistiu em média por ${(day1Snapshot.currentReelsAvgWatchTime / 1000).toFixed(1)} segundos.`;
                        }
                    }
                }
            } catch (e: any) {
                logger.warn(`${TAG} Erro ao buscar snapshot para ${mostRecentPostWithReach._id}: ${e.message}`);
            }
        }
        logger.info(`${TAG} Insight de média de alcance gerado. Média: ${avgReach.toFixed(0)}.`);
        return {
            text: `Falando em alcance, ${userNameForMsg}, seus posts atingiram em média ${avgReach.toFixed(0)} pessoas nos últimos ${daysLookback} dias.${granularDetailText}${additionalImpactText}${reelSpecificText} Isso mostra o quão longe seu conteúdo está chegando! Você tem alguma estratégia em mente para ampliar ainda mais essa visibilidade?`,
            type: FALLBACK_INSIGHT_TYPES.AVG_REACH_METRIC
        };
    }
    logger.debug(`${TAG} Média de alcance (${avgReach?.toFixed(0)}) não atingiu o limiar (${AVG_REACH_MIN_FOR_INSIGHT}).`);
    return null;
}
