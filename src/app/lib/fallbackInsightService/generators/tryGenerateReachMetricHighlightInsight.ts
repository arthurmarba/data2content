// @/app/lib/fallbackInsightService/generators/tryGenerateReachMetricHighlightInsight.ts
// MODIFICADO: v1.1 - Alterado para usar o campo postLink diretamente, em vez de construir a URL manualmente.
import { parseISO, subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, PotentialInsight, PostObject, DailySnapshot } from '../fallbackInsight.types';
import { calculateAverageMetricFromPosts } from '../utils/calculateAverageMetricFromPosts';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    REACH_HIGHLIGHT_LOOKBACK_DAYS,
    MIN_AVG_REACH_FOR_POSITIVE_HIGHLIGHT,
    MIN_POSTS_FOR_REACH_HIGHLIGHT,
    REACH_HIGHLIGHT_MIN_DAY1_REACH_FOR_MENTION
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight destacando o bom alcance médio recente.
 * Inclui um detalhe granular sobre o post com maior alcance no primeiro dia.
 */
export async function tryGenerateReachMetricHighlightInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateReachMetricHighlightInsight_v1.1] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (!enrichedReport?.recentPosts) {
        logger.debug(`${TAG} Sem posts recentes para o destaque de alcance.`);
        return null;
    }

    const cutoffDate = subDays(new Date(), REACH_HIGHLIGHT_LOOKBACK_DAYS);
    const postsLast7Days = (enrichedReport.recentPosts as PostObject[]).filter(post => {
        const postTimestamp = post.postDate instanceof Date ? post.postDate : parseISO(post.postDate as string);
        return postTimestamp >= cutoffDate && post.stats && typeof post.stats.reach === 'number';
    });

    if (postsLast7Days.length < MIN_POSTS_FOR_REACH_HIGHLIGHT) {
        logger.debug(`${TAG} Posts insuficientes (${postsLast7Days.length}) nos últimos ${REACH_HIGHLIGHT_LOOKBACK_DAYS} dias para o destaque de alcance. Mínimo: ${MIN_POSTS_FOR_REACH_HIGHLIGHT}.`);
        return null;
    }

    const avgReachLast7Days = calculateAverageMetricFromPosts(postsLast7Days, stats => stats.reach);

    if (avgReachLast7Days !== null && avgReachLast7Days >= MIN_AVG_REACH_FOR_POSITIVE_HIGHLIGHT) {
        let granularDetailText = "";
        let additionalDetailParts: string[] = [];
        let highestDay1ReachPost: PostObject | null = null;
        let highestDay1ReachValue = 0;
        let day1SnapshotOfHighestPost: DailySnapshot | null = null;


        for (const post of postsLast7Days) {
            if (post._id) {
                try {
                    const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(post._id.toString(), user._id.toString());
                    const day1Snapshot = snapshots.find(s => s.dayNumber === 1);
                    if (day1Snapshot && typeof day1Snapshot.dailyReach === 'number' && day1Snapshot.dailyReach > highestDay1ReachValue) {
                        highestDay1ReachValue = day1Snapshot.dailyReach;
                        highestDay1ReachPost = post as PostObject;
                        day1SnapshotOfHighestPost = day1Snapshot;
                    }
                } catch (e: any) {
                    logger.warn(`${TAG} Erro ao buscar snapshot para o post ${post._id} no destaque de alcance: ${e.message}`);
                }
            }
        }

        if (highestDay1ReachPost && day1SnapshotOfHighestPost && highestDay1ReachValue >= REACH_HIGHLIGHT_MIN_DAY1_REACH_FOR_MENTION) {
            const postDesc = highestDay1ReachPost.description?.substring(0, 30) || "um de seus posts recentes";
            
            // --- CORREÇÃO AQUI ---
            const postLink = (highestDay1ReachPost as any).postLink || "";

            additionalDetailParts.push(`o post "${postDesc}..." ${postLink ? `(${postLink})` : ''}, que alcançou ${highestDay1ReachValue.toFixed(0)} pessoas só no primeiro dia`);

            if (typeof day1SnapshotOfHighestPost.dailyFollows === 'number' && day1SnapshotOfHighestPost.dailyFollows > 0) {
                additionalDetailParts.push(`trouxe ${day1SnapshotOfHighestPost.dailyFollows} novo(s) seguidor(es)`);
            }
            if (typeof day1SnapshotOfHighestPost.dailyProfileVisits === 'number' && day1SnapshotOfHighestPost.dailyProfileVisits > 1) {
                additionalDetailParts.push(`gerou ${day1SnapshotOfHighestPost.dailyProfileVisits} visitas ao perfil`);
            }

            if ((highestDay1ReachPost.type === 'REEL' || highestDay1ReachPost.type === 'VIDEO') &&
                typeof day1SnapshotOfHighestPost.currentReelsAvgWatchTime === 'number' && day1SnapshotOfHighestPost.currentReelsAvgWatchTime > 0) {
                additionalDetailParts.push(`teve um tempo médio de visualização de ${(day1SnapshotOfHighestPost.currentReelsAvgWatchTime / 1000).toFixed(1)}s`);
            }

            if (additionalDetailParts.length > 0) {
                 granularDetailText = ` O destaque foi para ${additionalDetailParts.join(', e ')}!`;
            }
        }

        logger.info(`${TAG} Insight de destaque de métrica de alcance gerado (média de ${avgReachLast7Days.toFixed(0)}). Detalhe granular: "${granularDetailText}"`);
        return {
            text: `Olá ${userNameForMsg}! Na última semana, seus posts tiveram um alcance médio muito bom de ${avgReachLast7Days.toFixed(0)} pessoas.${granularDetailText} Isso mostra que seu conteúdo está com ótima visibilidade! Para continuar expandindo, que tal experimentar um novo formato ou tema que possa interessar a uma audiência ainda maior? 🚀`,
            type: FALLBACK_INSIGHT_TYPES.REACH_METRIC_HIGHLIGHT
        };
    }
    logger.debug(`${TAG} Média de alcance nos últimos ${REACH_HIGHLIGHT_LOOKBACK_DAYS} dias (${avgReachLast7Days?.toFixed(0)}) não atingiu o limiar (${MIN_AVG_REACH_FOR_POSITIVE_HIGHLIGHT}).`);
    return null;
}
