// @/app/lib/fallbackInsightService/generators/tryGenerateVideoDurationPerformanceInsight.ts
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, PotentialInsight, DurationStat, PostObject, DailySnapshot } from '../fallbackInsight.types';
import { mapSecondsToDurationRange } from '../utils/mapSecondsToDurationRange';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    VIDEO_DURATION_MIN_POSTS_PER_RANGE,
    VIDEO_DURATION_MIN_RETENTION_THRESHOLD,
    VIDEO_DURATION_EXAMPLE_MIN_VIEWS_OR_RETENTION_VALUE
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre o desempenho de vídeos com base na sua duração.
 * Destaca a faixa de duração com melhor taxa de retenção.
 * Inclui um exemplo de vídeo e métricas granulares de seu desempenho inicial.
 * OTIMIZADO: Adiciona dailyFollows, dailyProfileVisits e dailyReelsVideoViewTotalTime ao detalhe do vídeo de exemplo.
 */
export async function tryGenerateVideoDurationPerformanceInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateVideoDurationPerformanceInsight_Optimized] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (!enrichedReport?.durationStats || enrichedReport.durationStats.length === 0) {
        logger.debug(`${TAG} Estatísticas de duração de vídeo (durationStats) não disponíveis.`);
        return null;
    }

    let bestPerformingRange: DurationStat | null = null;
    let highestRetentionRate = 0;

    for (const durationStat of enrichedReport.durationStats) {
        if (durationStat.totalPosts >= VIDEO_DURATION_MIN_POSTS_PER_RANGE &&
            typeof durationStat.avgRetentionRate === 'number' &&
            durationStat.avgRetentionRate > highestRetentionRate) {
            highestRetentionRate = durationStat.avgRetentionRate;
            bestPerformingRange = durationStat;
        }
    }

    if (bestPerformingRange && highestRetentionRate >= VIDEO_DURATION_MIN_RETENTION_THRESHOLD) {
        const rangeText = bestPerformingRange.range;
        const retentionPercentage = (highestRetentionRate * 100).toFixed(0);
        let suggestionText = "";
        let engagementPrompt = `Que tipo de conteúdo você acredita que se encaixaria bem nessa duração, ${userNameForMsg}?`;
        let exampleVideoText = "";
        let granularVideoMetricParts: string[] = [];


        const videosInBestRange = enrichedReport.recentPosts?.filter(p =>
            (p.type === 'REEL' || p.type === 'VIDEO') &&
            p.stats?.video_duration_seconds &&
            mapSecondsToDurationRange(p.stats.video_duration_seconds) === rangeText
        );

        if (videosInBestRange && videosInBestRange.length > 0) {
            videosInBestRange.sort((a, b) => {
                const retentionA = Number(a.stats?.avgRetentionRate ?? (a.stats?.retention_rate ?? 0));
                const retentionB = Number(b.stats?.avgRetentionRate ?? (b.stats?.retention_rate ?? 0));
                if (retentionB !== retentionA) return retentionB - retentionA;
                return (Number(b.stats?.views || b.stats?.video_views || 0)) - (Number(a.stats?.views || a.stats?.video_views || 0));
            });
            const exampleVideo = videosInBestRange[0] as PostObject; // Cast para PostObject

            if (exampleVideo?._id) {
                const videoLink = exampleVideo.platformPostId ? `https://www.instagram.com/p/${exampleVideo.platformPostId}/` : "";
                const videoDesc = exampleVideo.description?.substring(0, 30) || "um de seus vídeos";
                exampleVideoText = ` Por exemplo, seu vídeo "${videoDesc}..." ${videoLink ? `(${videoLink})` : ''}`;

                try {
                    const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(exampleVideo._id.toString(), user._id.toString());
                    const day1Snapshot = snapshots.find(s => s.dayNumber === 1);
                    if (day1Snapshot) {
                        if (typeof day1Snapshot.dailyViews === 'number' && day1Snapshot.dailyViews >= VIDEO_DURATION_EXAMPLE_MIN_VIEWS_OR_RETENTION_VALUE) {
                            granularVideoMetricParts.push(`teve ${day1Snapshot.dailyViews.toFixed(0)} visualizações logo no primeiro dia`);
                        }
                        if (exampleVideo.type === 'REEL' && typeof day1Snapshot.currentReelsAvgWatchTime === 'number' && day1Snapshot.currentReelsAvgWatchTime > 0) {
                            granularVideoMetricParts.push(`um tempo médio de visualização de ${(day1Snapshot.currentReelsAvgWatchTime / 1000).toFixed(1)}s`);
                        }
                        if (exampleVideo.type === 'REEL' && typeof day1Snapshot.dailyReelsVideoViewTotalTime === 'number' && day1Snapshot.dailyReelsVideoViewTotalTime > 0) {
                             // Converter para minutos se for muito grande, ou segundos
                            const totalTimeSeconds = day1Snapshot.dailyReelsVideoViewTotalTime / 1000;
                            if (totalTimeSeconds > 120) { // mais de 2 minutos
                                granularVideoMetricParts.push(`com um tempo total de visualização de ${(totalTimeSeconds / 60).toFixed(1)} minutos`);
                            } else if (totalTimeSeconds > 0) {
                                granularVideoMetricParts.push(`com um tempo total de visualização de ${totalTimeSeconds.toFixed(0)} segundos`);
                            }
                        }
                        if (typeof day1Snapshot.dailyFollows === 'number' && day1Snapshot.dailyFollows > 0) {
                            granularVideoMetricParts.push(`trouxe ${day1Snapshot.dailyFollows} novo(s) seguidor(es)`);
                        }
                        if (typeof day1Snapshot.dailyProfileVisits === 'number' && day1Snapshot.dailyProfileVisits > 1) {
                            granularVideoMetricParts.push(`gerou ${day1Snapshot.dailyProfileVisits} visitas ao perfil`);
                        }
                    }
                } catch (e: any) {
                    logger.warn(`${TAG} Erro ao buscar snapshot para vídeo exemplo ${exampleVideo._id}: ${e.message}`);
                }
            }
        }
        
        let granularVideoMetricText = "";
        if (granularVideoMetricParts.length > 0) {
            granularVideoMetricText = `, que ${granularVideoMetricParts.join(', e ')},`;
        }


        if (rangeText.includes("0-15s") || rangeText.includes("15-30s")) {
            suggestionText = `Seus vídeos mais curtos, na faixa de "${rangeText}"${exampleVideoText}${granularVideoMetricText} estão com uma taxa de retenção média incrível de ${retentionPercentage}%! Isso sugere que seu público realmente aprecia conteúdo rápido e direto ao ponto.`;
            engagementPrompt = `Que ideias de vídeos curtos e impactantes você tem para essa semana, ${userNameForMsg}?`;
        } else if (rangeText.includes("30-60s")) {
            suggestionText = `Vídeos na faixa de "${rangeText}"${exampleVideoText}${granularVideoMetricText} estão mostrando uma ótima retenção média de ${retentionPercentage}%. Essa parece ser uma duração versátil para você, equilibrando informação e a atenção do espectador.`;
            engagementPrompt = `Você tem algum tópico que se beneficiaria de um vídeo nessa faixa de duração, ${userNameForMsg}?`;
        } else if (rangeText.includes("60s+")) {
            suggestionText = `Notei que seus vídeos mais longos, acima de 60 segundos (faixa "${rangeText}")${exampleVideoText}${granularVideoMetricText} estão mantendo uma taxa de retenção média de ${retentionPercentage}%. Isso é um ótimo sinal de que seus seguidores valorizam conteúdos mais aprofundados e detalhados de você!`;
            engagementPrompt = `Que temas mais complexos ou tutoriais você poderia abordar em vídeos mais longos, ${userNameForMsg}?`;
        } else {
            suggestionText = `Seus vídeos na faixa de "${rangeText}"${exampleVideoText}${granularVideoMetricText} estão com uma boa taxa de retenção média de ${retentionPercentage}%.`;
        }

        logger.info(`${TAG} Insight de desempenho de duração de vídeo gerado. Melhor faixa: ${rangeText} com ${retentionPercentage}% de retenção.`);
        return {
            text: `${suggestionText} ${engagementPrompt} 🎬`,
            type: FALLBACK_INSIGHT_TYPES.VIDEO_DURATION_PERFORMANCE
        };
    }

    logger.debug(`${TAG} Nenhuma faixa de duração de vídeo se destacou ou atingiu o limiar de retenção (Maior retenção encontrada: ${(highestRetentionRate * 100).toFixed(0)}%, Limiar: ${(VIDEO_DURATION_MIN_RETENTION_THRESHOLD * 100).toFixed(0)}%).`);
    return null;
}
