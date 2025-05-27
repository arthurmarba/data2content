// @/app/lib/fallbackInsightService/generators/tryGenerateContentTypePerformanceComparisonInsight.ts
import { parseISO, subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, PotentialInsight, PostObject, DailySnapshot } from '../fallbackInsight.types';
import { calculateAverageMetricFromPosts } from '../utils/calculateAverageMetricFromPosts';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    COMPARISON_MIN_POSTS_PER_TYPE,
    COMPARISON_SIGNIFICANT_DIFFERENCE_MULTIPLIER,
    COMPARISON_MIN_DAY1_METRIC_FOR_MENTION
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight comparando o desempenho de Reels vs. Imagens/Carrosséis.
 * Inclui exemplos de posts e métricas granulares de desempenho inicial.
 * OTIMIZADO: Adiciona dailyFollows, dailyProfileVisits e métricas de Reels aos detalhes dos posts de exemplo.
 * CORRIGIDO: Erro de tipo na atribuição de day1Snapshot a day1SnapshotOfBestImage.
 */
export async function tryGenerateContentTypePerformanceComparisonInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null,
    daysLookbackInput: number
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateContentTypePerformanceComparisonInsight_Optimized_Fixed] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';
    const COMPARISON_LOOKBACK_PERIOD_DAYS = daysLookbackInput;

    if (!enrichedReport?.recentPosts || enrichedReport.recentPosts.length < (COMPARISON_MIN_POSTS_PER_TYPE * 2)) {
        logger.debug(`${TAG} Posts recentes insuficientes para comparação de tipos de conteúdo (Total: ${enrichedReport?.recentPosts?.length}, Mínimo necessário: ${COMPARISON_MIN_POSTS_PER_TYPE * 2}).`);
        return null;
    }

    const cutoffDate = subDays(new Date(), COMPARISON_LOOKBACK_PERIOD_DAYS);
    const recentPostsInRange = (enrichedReport.recentPosts as PostObject[]).filter(p => {
        const postTimestamp = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
        return postTimestamp >= cutoffDate && p.stats;
    });

    const reels = recentPostsInRange.filter(p => p.type === 'REELS' || p.type === 'VIDEO');
    const imagesAndCarousels = recentPostsInRange.filter(p => p.type === 'IMAGE' || p.type === 'CAROUSEL' || p.type === 'CAROUSEL_ALBUM');

    if (reels.length < COMPARISON_MIN_POSTS_PER_TYPE || imagesAndCarousels.length < COMPARISON_MIN_POSTS_PER_TYPE) {
        logger.debug(`${TAG} Número insuficiente de posts para um dos tipos (Reels: ${reels.length}, Img/Carr: ${imagesAndCarousels.length}). Mínimo: ${COMPARISON_MIN_POSTS_PER_TYPE}.`);
        return null;
    }

    const avgReelViews = calculateAverageMetricFromPosts(reels, stats => stats.video_views);
    const avgImageImpressions = calculateAverageMetricFromPosts(imagesAndCarousels, stats => stats.impressions);

    if (avgReelViews === null || avgImageImpressions === null) {
        logger.debug(`${TAG} Não foi possível calcular médias para comparação (Reel Views: ${avgReelViews}, Img Impressions: ${avgImageImpressions})`);
        return null;
    }

    let insightText: string | null = null;
    let granularDetailText = "";
    let exampleDetailParts: string[] = [];


    if (avgReelViews > avgImageImpressions * COMPARISON_SIGNIFICANT_DIFFERENCE_MULTIPLIER) {
        let bestReelExample: PostObject | null = null;
        let bestReelDay1Views = 0;
        let day1SnapshotOfBestReel: DailySnapshot | null = null;

        for (const reel of reels) {
            if (reel._id) {
                try {
                    const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(reel._id.toString(), user._id.toString());
                    const day1Snapshot = snapshots.find(s => s.dayNumber === 1);
                    if (day1Snapshot && typeof day1Snapshot.dailyViews === 'number' && day1Snapshot.dailyViews > bestReelDay1Views) {
                        bestReelDay1Views = day1Snapshot.dailyViews;
                        bestReelExample = reel as PostObject;
                        day1SnapshotOfBestReel = day1Snapshot; // day1Snapshot aqui é DailySnapshot ou undefined. Se undefined, day1SnapshotOfBestReel será null.
                    }
                } catch (e: any) { logger.warn(`${TAG} Erro ao buscar snapshot para Reel ${reel._id}: ${e.message}`); }
            }
        }
        if (bestReelExample && day1SnapshotOfBestReel && bestReelDay1Views >= COMPARISON_MIN_DAY1_METRIC_FOR_MENTION) {
            const reelDesc = bestReelExample.description?.substring(0, 30) || "um de seus Reels";
            const reelLink = bestReelExample.platformPostId ? `https://www.instagram.com/p/${bestReelExample.platformPostId}/` : "";
            exampleDetailParts.push(`seu Reel "${reelDesc}..." ${reelLink ? `(${reelLink})` : ''} teve um início fantástico com ${bestReelDay1Views.toFixed(0)} visualizações logo no primeiro dia`);

            if (typeof day1SnapshotOfBestReel.currentReelsAvgWatchTime === 'number' && day1SnapshotOfBestReel.currentReelsAvgWatchTime > 0) {
                exampleDetailParts.push(`um tempo médio de visualização de ${(day1SnapshotOfBestReel.currentReelsAvgWatchTime / 1000).toFixed(1)}s`);
            }
            if (typeof day1SnapshotOfBestReel.dailyFollows === 'number' && day1SnapshotOfBestReel.dailyFollows > 0) {
                exampleDetailParts.push(`e ainda trouxe ${day1SnapshotOfBestReel.dailyFollows} novo(s) seguidor(es)`);
            }
             if (exampleDetailParts.length > 0) {
                granularDetailText = ` Para ilustrar, ${exampleDetailParts.join(', ')}!`;
            }
        }
        insightText = `Analisando seus últimos ${COMPARISON_LOOKBACK_PERIOD_DAYS} dias, ${userNameForMsg}, percebi uma tendência clara: seus Reels estão com uma média de ${avgReelViews.toFixed(0)} visualizações, superando as ${avgImageImpressions.toFixed(0)} impressões dos seus posts de imagem/carrossel.${granularDetailText} Se o seu foco é maximizar visualizações e alcance, os Reels parecem ser uma excelente estratégia para você. Que tal explorarmos mais ideias para seus próximos Reels? 😉`;
        logger.info(`${TAG} Reels performando significativamente melhor. Detalhe: "${granularDetailText}"`);

    } else if (avgImageImpressions > avgReelViews * COMPARISON_SIGNIFICANT_DIFFERENCE_MULTIPLIER) {
        let bestImageExample: PostObject | null = null;
        let bestImageDay1MetricValue = 0;
        let day1MetricName = "impressões";
        let day1SnapshotOfBestImage: DailySnapshot | null = null;

        for (const imgPost of imagesAndCarousels) {
            if (imgPost._id) {
                try {
                    const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(imgPost._id.toString(), user._id.toString());
                    const day1Snapshot = snapshots.find(s => s.dayNumber === 1);
                    let currentDay1Metric = 0;
                    if (day1Snapshot?.dailyImpressions && day1Snapshot.dailyImpressions > 0) {
                        currentDay1Metric = day1Snapshot.dailyImpressions;
                        day1MetricName = "impressões";
                    } else if (day1Snapshot?.dailyReach && day1Snapshot.dailyReach > 0) {
                        currentDay1Metric = day1Snapshot.dailyReach;
                        day1MetricName = "pessoas alcançadas";
                    }

                    if (currentDay1Metric > bestImageDay1MetricValue) {
                        bestImageDay1MetricValue = currentDay1Metric;
                        bestImageExample = imgPost as PostObject;
                        day1SnapshotOfBestImage = day1Snapshot || null; // CORREÇÃO APLICADA AQUI
                    }
                } catch (e: any) { logger.warn(`${TAG} Erro ao buscar snapshot para Imagem/Carrossel ${imgPost._id}: ${e.message}`); }
            }
        }
        if (bestImageExample && day1SnapshotOfBestImage && bestImageDay1MetricValue >= COMPARISON_MIN_DAY1_METRIC_FOR_MENTION) {
            const imgDesc = bestImageExample.description?.substring(0, 30) || "um de seus posts";
            const imgLink = bestImageExample.platformPostId ? `https://www.instagram.com/p/${bestImageExample.platformPostId}/` : "";
            exampleDetailParts.push(`seu post "${imgDesc}..." ${imgLink ? `(${imgLink})` : ''} obteve ${bestImageDay1MetricValue.toFixed(0)} ${day1MetricName} já no primeiro dia`);

            if (typeof day1SnapshotOfBestImage.dailyFollows === 'number' && day1SnapshotOfBestImage.dailyFollows > 0) {
                exampleDetailParts.push(`e ainda trouxe ${day1SnapshotOfBestImage.dailyFollows} novo(s) seguidor(es)`);
            }
            if (typeof day1SnapshotOfBestImage.dailyProfileVisits === 'number' && day1SnapshotOfBestImage.dailyProfileVisits > 1) {
                exampleDetailParts.push(`gerando ${day1SnapshotOfBestImage.dailyProfileVisits} visitas ao perfil`);
            }
             if (exampleDetailParts.length > 0) {
                granularDetailText = ` Por exemplo, ${exampleDetailParts.join(', ')}!`;
            }
        }
        insightText = `Uma observação interessante, ${userNameForMsg}: seus posts de imagem/carrossel tiveram, em média, ${avgImageImpressions.toFixed(0)} impressões nos últimos ${COMPARISON_LOOKBACK_PERIOD_DAYS} dias, superando as ${avgReelViews.toFixed(0)} visualizações médias dos Reels.${granularDetailText} Isso sugere que seu público está respondendo muito bem aos seus conteúdos estáticos! 👍 Já pensou em como otimizar ainda mais esse formato?`;
        logger.info(`${TAG} Imagens/Carrosséis performando significativamente melhor. Detalhe: "${granularDetailText}"`);
    }

    if (insightText) {
        return { text: insightText, type: FALLBACK_INSIGHT_TYPES.CONTENT_TYPE_PERFORMANCE_COMPARISON };
    }
    logger.debug(`${TAG} Nenhuma diferença significativa encontrada ou médias não calculadas.`);
    return null;
}
