// @/app/lib/fallbackInsightService/generators/tryGenerateBestDayInsight.ts
import { parseISO } from 'date-fns';
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, PotentialInsight, DayOfWeekStat, PostObject, DailySnapshot } from '../fallbackInsight.types';
import { mapDayNumberToText } from '../utils/mapDayNumberToText'; // mapDayNumberToText é usado para o exemplo
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    BEST_DAY_MIN_POSTS_IN_SLOT,
    BEST_DAY_MIN_ENGAGEMENT_VALUE
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre o melhor dia da semana para postar, com base no engajamento.
 * Inclui um exemplo de post e métricas granulares de seu desempenho inicial.
 * OTIMIZADO: Adiciona dailyFollows, dailyProfileVisits e métricas de Reels ao detalhe do post de exemplo.
 * CORRIGIDO: Erro de tipo em postDesc na construção de examplePostText.
 */
export async function tryGenerateBestDayInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null,
    daysLookback: number
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateBestDayInsight_Optimized_Fixed] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    logger.debug({
        message: `${TAG} Iniciando. enrichedReport.dayOfWeekStats existe? ${!!enrichedReport?.dayOfWeekStats}. Tamanho: ${enrichedReport?.dayOfWeekStats?.length ?? 'N/A'}`,
        dayOfWeekStatsRaw: enrichedReport?.dayOfWeekStats
    });

    if (!enrichedReport?.dayOfWeekStats || enrichedReport.dayOfWeekStats.length === 0) {
        logger.warn(`${TAG} enrichedReport.dayOfWeekStats não disponível ou vazio.`);
        return null;
    }

    let bestDayStat: DayOfWeekStat | null = null;
    let maxEngagementValue = 0;
    let engagementMetricUsed = '';

    for (const stat of enrichedReport.dayOfWeekStats) {
        let currentEngagementValue = 0;
        let currentMetricName = '';

        if (typeof stat.avgTotalInteractions === 'number' && stat.avgTotalInteractions > 0) {
            currentEngagementValue = stat.avgTotalInteractions;
            currentMetricName = 'interações totais';
        } else if (typeof stat.avgComments === 'number' && stat.avgComments > 0) {
            currentEngagementValue = stat.avgComments;
            currentMetricName = 'comentários';
        } else if (typeof stat.avgLikes === 'number' && stat.avgLikes > 0) {
            currentEngagementValue = stat.avgLikes;
            currentMetricName = 'curtidas';
        }

        logger.debug({
            message: `${TAG} Analisando dia: ${stat.dayName}`,
            totalPosts: stat.totalPosts,
            avgTotalInteractions: stat.avgTotalInteractions,
            avgComments: stat.avgComments,
            avgLikes: stat.avgLikes,
            currentEngagementValueForDay: currentEngagementValue,
            currentMetricNameForDay: currentMetricName
        });

        if (currentEngagementValue > maxEngagementValue && stat.totalPosts >= BEST_DAY_MIN_POSTS_IN_SLOT) {
            maxEngagementValue = currentEngagementValue;
            bestDayStat = stat;
            engagementMetricUsed = currentMetricName;
        }
    }

    if (bestDayStat && maxEngagementValue >= BEST_DAY_MIN_ENGAGEMENT_VALUE) {
        let examplePostText = "";
        let examplePostDetailParts: string[] = [];
        let mainInteractionDetailAdded = false; // Flag para controlar o detalhe principal

        if (enrichedReport.recentPosts && enrichedReport.recentPosts.length > 0 && bestDayStat._id !== undefined) {
            const examplePostOnBestDay = enrichedReport.recentPosts.find(p => {
                const postDate = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
                return postDate.getDay() === bestDayStat?._id;
            }) as PostObject | undefined;

            if (examplePostOnBestDay?._id) {
                const postDesc = examplePostOnBestDay.description?.substring(0, 30) || "um post recente";
                const postLink = examplePostOnBestDay.platformPostId ? `https://www.instagram.com/p/${examplePostOnBestDay.platformPostId}/` : ((examplePostOnBestDay as any).postLink || "");

                try {
                    const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(examplePostOnBestDay._id.toString(), user._id.toString());
                    const day1Snapshot = snapshots.find(s => s.dayNumber === 1);

                    if (day1Snapshot) {
                        const interactions = (day1Snapshot.dailyLikes || 0) + (day1Snapshot.dailyComments || 0) + (day1Snapshot.dailyShares || 0) + (day1Snapshot.dailySaved || 0);
                        if (interactions > 2) {
                            examplePostDetailParts.push(`seu post "${postDesc}..." ${postLink ? `(${postLink})` : ''} publicado em uma ${bestDayStat.dayName}, teve ${interactions} interações logo no dia do lançamento`);
                            mainInteractionDetailAdded = true; // Detalhe principal foi adicionado
                        }

                        if (typeof day1Snapshot.dailyFollows === 'number' && day1Snapshot.dailyFollows > 0) {
                            examplePostDetailParts.push(`trouxe ${day1Snapshot.dailyFollows} novo(s) seguidor(es)`);
                        }
                        if (typeof day1Snapshot.dailyProfileVisits === 'number' && day1Snapshot.dailyProfileVisits > 1) {
                            examplePostDetailParts.push(`gerou ${day1Snapshot.dailyProfileVisits} visitas ao perfil`);
                        }
                        if ((examplePostOnBestDay.type === 'REEL' || examplePostOnBestDay.type === 'VIDEO') &&
                            typeof day1Snapshot.currentReelsAvgWatchTime === 'number' && day1Snapshot.currentReelsAvgWatchTime > 0) {
                            examplePostDetailParts.push(`e um tempo médio de visualização de ${(day1Snapshot.currentReelsAvgWatchTime / 1000).toFixed(1)}s`);
                        }
                    }
                } catch (e: any) {
                    logger.warn(`${TAG} Erro ao buscar snapshot para post exemplo em BEST_DAY_ENGAGEMENT (Post ID: ${examplePostOnBestDay._id}): ${e.message}`);
                }

                if (examplePostDetailParts.length > 0) {
                    // Constrói a frase de exemplo usando a flag
                    if (examplePostDetailParts.length === 1 && mainInteractionDetailAdded) {
                        // Se só tiver a primeira parte (interações), não precisa de "Por exemplo,"
                        examplePostText = ` ${examplePostDetailParts[0]}!`;
                    } else { // Se houver múltiplos detalhes ou apenas detalhes secundários
                        examplePostText = ` Por exemplo, ${examplePostDetailParts.join(', e ')}!`;
                    }
                }
            }
        }

        logger.info(`${TAG} Insight de melhor dia gerado. Dia: ${bestDayStat.dayName}, Métrica: ${engagementMetricUsed}, Valor: ${maxEngagementValue.toFixed(1)}`);
        return {
            text: `Analisando seus posts dos últimos ${daysLookback} dias, ${userNameForMsg}, parece que ${bestDayStat.dayName} (com ${bestDayStat.totalPosts} posts nesse dia) tem sido um momento forte para você em termos de ${engagementMetricUsed}, atingindo uma média de ${maxEngagementValue.toFixed(0)}.${examplePostText} Essa é uma informação valiosa! Já pensou em concentrar alguns dos seus melhores conteúdos ou anúncios nesse dia para maximizar o impacto? 😉`,
            type: FALLBACK_INSIGHT_TYPES.BEST_DAY_ENGAGEMENT
        };
    } else {
        logger.debug(`${TAG} Nenhuma estatística de dia da semana atingiu os critérios (maxEngagementValue: ${maxEngagementValue}, bestDayStat: ${!!bestDayStat}).`);
    }
    return null;
}
