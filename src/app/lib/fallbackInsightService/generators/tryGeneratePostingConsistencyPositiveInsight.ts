// @/app/lib/fallbackInsightService/generators/tryGeneratePostingConsistencyPositiveInsight.ts
import { parseISO, subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, IAccountInsight, PotentialInsight, PostObject, DailySnapshot } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    MIN_POSTS_FOR_CONSISTENCY_INSIGHT,
    CONSISTENCY_LOOKBACK_DAYS,
    CONSISTENCY_RECENT_POST_MIN_INTERACTIONS
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight positivo sobre a consistência de postagem do usuário.
 * Inclui um detalhe granular sobre o desempenho inicial do post mais recente no período.
 * OTIMIZADO: Adiciona dailyFollows, dailyProfileVisits e métricas de Reels ao detalhe granular.
 */
export async function tryGeneratePostingConsistencyPositiveInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null,
    latestAccountInsights: IAccountInsight | null, // Mantido para consistência da assinatura, não usado aqui.
    daysLookbackInput: number // Mantido para consistência da assinatura, CONSISTENCY_LOOKBACK_DAYS é usado.
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGeneratePostingConsistencyPositiveInsight_Optimized] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (!enrichedReport?.recentPosts) {
        logger.debug(`${TAG} Sem posts recentes para análise de consistência.`);
        return null;
    }

    const cutoffDate = subDays(new Date(), CONSISTENCY_LOOKBACK_DAYS);
    const postsInLastPeriod = (enrichedReport.recentPosts as PostObject[]).filter(post => {
        const postTimestamp = post.postDate instanceof Date ? post.postDate : parseISO(post.postDate as string);
        return postTimestamp >= cutoffDate;
    });

    const numberOfPostsInPeriod = postsInLastPeriod.length;

    if (numberOfPostsInPeriod >= MIN_POSTS_FOR_CONSISTENCY_INSIGHT) {
        let granularDetailText = "";
        let additionalDetailParts: string[] = [];

        if (numberOfPostsInPeriod > 0) {
            postsInLastPeriod.sort((a, b) =>
                (b.postDate instanceof Date ? b.postDate.getTime() : parseISO(b.postDate as string).getTime()) -
                (a.postDate instanceof Date ? a.postDate.getTime() : parseISO(a.postDate as string).getTime())
            );
            const mostRecentPostInPeriod = postsInLastPeriod[0] as PostObject; // Cast para PostObject

            if (mostRecentPostInPeriod?._id) {
                try {
                    const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(mostRecentPostInPeriod._id.toString(), user._id.toString());
                    const day1Snapshot = snapshots.find(s => s.dayNumber === 1);
                    if (day1Snapshot) {
                        const day1Interactions = (day1Snapshot.dailyLikes || 0) + (day1Snapshot.dailyComments || 0) + (day1Snapshot.dailyShares || 0) + (day1Snapshot.dailySaved || 0);
                        const postDesc = mostRecentPostInPeriod.description?.substring(0, 30) || "seu post mais recente";
                        const postLink = mostRecentPostInPeriod.platformPostId ? `https://www.instagram.com/p/${mostRecentPostInPeriod.platformPostId}/` : "";

                        if (day1Interactions >= CONSISTENCY_RECENT_POST_MIN_INTERACTIONS) {
                            additionalDetailParts.push(`seu post "${postDesc}..." ${postLink ? `(${postLink})` : ''} já começou bem esta semana, com ${day1Interactions} interações logo no primeiro dia`);
                        }

                        // Otimização: Adicionar outras métricas de impacto do Dia 1
                        if (typeof day1Snapshot.dailyFollows === 'number' && day1Snapshot.dailyFollows > 0) {
                            additionalDetailParts.push(`trouxe ${day1Snapshot.dailyFollows} novo(s) seguidor(es)`);
                        }
                        if (typeof day1Snapshot.dailyProfileVisits === 'number' && day1Snapshot.dailyProfileVisits > 1) {
                            additionalDetailParts.push(`gerou ${day1Snapshot.dailyProfileVisits} visitas ao perfil`);
                        }

                        // Se for Reel, adicionar métricas específicas
                        if ((mostRecentPostInPeriod.type === 'REEL' || mostRecentPostInPeriod.type === 'VIDEO') &&
                            typeof day1Snapshot.currentReelsAvgWatchTime === 'number' && day1Snapshot.currentReelsAvgWatchTime > 0) {
                            additionalDetailParts.push(`teve um tempo médio de visualização de ${(day1Snapshot.currentReelsAvgWatchTime / 1000).toFixed(1)}s`);
                        }

                        if (additionalDetailParts.length > 0) {
                            granularDetailText = ` Inclusive, ${additionalDetailParts.join(', e ')}!`;
                        }

                    }
                } catch (e: any) {
                    logger.warn(`${TAG} Erro ao buscar snapshot para detalhe granular de consistência (Post ID: ${mostRecentPostInPeriod._id}): ${e.message}`);
                }
            }
        }
        logger.info(`${TAG} Insight de consistência positiva gerado (${numberOfPostsInPeriod} posts).`);
        return {
            text: `Parabéns pela sua consistência, ${userNameForMsg}! Você publicou ${numberOfPostsInPeriod} posts nos últimos ${CONSISTENCY_LOOKBACK_DAYS} dias, o que é excelente para manter seu público engajado e mostrar ao algoritmo que seu perfil está ativo.${granularDetailText} Continue com esse ótimo trabalho! 👍`,
            type: FALLBACK_INSIGHT_TYPES.POSTING_CONSISTENCY_POSITIVE
        };
    }
    logger.debug(`${TAG} Consistência de postagem não atingiu o limiar (${numberOfPostsInPeriod}/${MIN_POSTS_FOR_CONSISTENCY_INSIGHT} posts nos últimos ${CONSISTENCY_LOOKBACK_DAYS} dias).`);
    return null;
}
