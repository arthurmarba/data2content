// @/app/lib/fallbackInsightService/generators/tryGenerateTopPostInsight.ts
// MODIFICADO: v1.1 - Alterado para usar o campo postLink diretamente, em vez de construir a URL manualmente.
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, PotentialInsight, IMetricModel, DailySnapshot, PostObject } from '../fallbackInsight.types';
import { mapDayNumberToText } from '../utils/mapDayNumberToText';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    TOP_POST_METRIC_MULTIPLIER,
    AVG_LIKES_MIN_FOR_INSIGHT,
    AVG_REACH_MIN_FOR_INSIGHT
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre o post de melhor desempenho recente.
 */
export async function tryGenerateTopPostInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateTopPostInsight_v1.1] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (enrichedReport?.top3Posts && enrichedReport.top3Posts.length > 0) {
        const topPost = enrichedReport.top3Posts[0] as (IMetricModel & { postLink?: string; platformPostId?: string; type?: string });

        if (topPost?._id && topPost.description && topPost.stats) {
            let metricHighlight = '';
            const overallStats = enrichedReport.overallStats;

            if (overallStats && typeof overallStats.totalPosts === 'number' && overallStats.totalPosts > 0) {
                const avgLikes = overallStats.avgLikes || 0;
                const avgComments = overallStats.avgComments || 0;
                const avgReach = overallStats.avgReach || 0;
                const avgTotalInteractions = overallStats.avgTotalInteractions || 0;

                if (topPost.stats.likes && avgLikes > 0 && topPost.stats.likes > avgLikes * TOP_POST_METRIC_MULTIPLIER && topPost.stats.likes > AVG_LIKES_MIN_FOR_INSIGHT * 1.5) {
                    metricHighlight = `com ${topPost.stats.likes} curtidas (bem acima da sua média de ${avgLikes.toFixed(0)})`;
                } else if (topPost.stats.comments && avgComments > 0 && topPost.stats.comments > avgComments * TOP_POST_METRIC_MULTIPLIER && topPost.stats.comments > 1) {
                    metricHighlight = `com ${topPost.stats.comments} comentários (acima da sua média de ${avgComments.toFixed(0)})`;
                } else if (topPost.stats.reach && avgReach > 0 && topPost.stats.reach > avgReach * TOP_POST_METRIC_MULTIPLIER && topPost.stats.reach > AVG_REACH_MIN_FOR_INSIGHT * 1.5) {
                    metricHighlight = `alcançando ${topPost.stats.reach} pessoas (bem acima da sua média de ${avgReach.toFixed(0)})`;
                } else if (topPost.stats.total_interactions && avgTotalInteractions > 0 && topPost.stats.total_interactions > avgTotalInteractions * TOP_POST_METRIC_MULTIPLIER) {
                    metricHighlight = `com ${topPost.stats.total_interactions} interações totais (acima da média de ${avgTotalInteractions.toFixed(0)})`;
                }
            } else {
                if (topPost.stats.likes && topPost.stats.likes > AVG_LIKES_MIN_FOR_INSIGHT) {
                    metricHighlight = `com ${topPost.stats.likes} curtidas`;
                } else if (topPost.stats.total_interactions && topPost.stats.total_interactions > AVG_LIKES_MIN_FOR_INSIGHT) {
                    metricHighlight = `com ${topPost.stats.total_interactions} interações totais`;
                }
            }

            if (metricHighlight) {
                let granularDetailParts: string[] = [];
                try {
                    const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(topPost._id.toString(), user._id.toString());
                    const day1Snapshot = snapshots.find(s => s.dayNumber === 1);

                    if (day1Snapshot) {
                        let peakDailyValue = 0;
                        let peakDayNumberText = "";
                        let peakMetricName = "";

                        const day1TotalInteractions = (day1Snapshot.dailyLikes || 0) + (day1Snapshot.dailyComments || 0) + (day1Snapshot.dailyShares || 0) + (day1Snapshot.dailySaved || 0);
                        if (day1TotalInteractions > 2) {
                            peakDailyValue = day1TotalInteractions;
                            peakDayNumberText = mapDayNumberToText(1);
                            peakMetricName = "interações";
                            granularDetailParts.push(`só no seu ${peakDayNumberText} dia, ele gerou ${peakDailyValue} ${peakMetricName}`);
                        } else if (typeof day1Snapshot.dailyLikes === 'number' && day1Snapshot.dailyLikes > 2) {
                             granularDetailParts.push(`só no seu ${mapDayNumberToText(1)} dia, ele conseguiu ${day1Snapshot.dailyLikes} curtidas`);
                        }

                        if (typeof day1Snapshot.dailyFollows === 'number' && day1Snapshot.dailyFollows > 0) {
                            granularDetailParts.push(`trouxe ${day1Snapshot.dailyFollows} novo(s) seguidor(es)`);
                        }
                        if (typeof day1Snapshot.dailyProfileVisits === 'number' && day1Snapshot.dailyProfileVisits > 1) {
                            granularDetailParts.push(`gerou ${day1Snapshot.dailyProfileVisits} visitas ao perfil`);
                        }
                        
                        const postType = topPost.type;
                        if ((postType === 'REEL' || postType === 'VIDEO') &&
                            typeof day1Snapshot.currentReelsAvgWatchTime === 'number' && day1Snapshot.currentReelsAvgWatchTime > 0) {
                            granularDetailParts.push(`teve um tempo médio de visualização de ${(day1Snapshot.currentReelsAvgWatchTime / 1000).toFixed(1)}s`);
                        }
                    }
                } catch (snapError: any) {
                    logger.warn(`${TAG} Erro ao buscar snapshots para top post ${topPost._id}: ${snapError.message}`);
                }

                let granularDetailString = "";
                if (granularDetailParts.length > 0) {
                    granularDetailString = ` Para você ter uma ideia, ${granularDetailParts.join(', e ')}. Isso mostra um engajamento inicial muito forte.`;
                }

                // --- CORREÇÃO AQUI ---
                const postLinkText = (topPost as any).postLink ? `(${(topPost as any).postLink})` : "";
                const descriptionExcerpt = topPost.description.substring(0, 40);

                logger.info(`${TAG} Insight de top post gerado para "${descriptionExcerpt}...".`);
                return {
                    text: `Falando em destaques, ${userNameForMsg}, seu post "${descriptionExcerpt}..." ${postLinkText} realmente brilhou! Ele ${metricHighlight}.${granularDetailString} Que tal analisarmos o que funcionou tão bem nesse conteúdo para replicarmos em futuras publicações? ✨`,
                    type: FALLBACK_INSIGHT_TYPES.TOP_POST_PERFORMANCE
                };
            }
        }
    }
    logger.debug(`${TAG} Nenhuma condição para insight de top post atendida.`);
    return null;
}
