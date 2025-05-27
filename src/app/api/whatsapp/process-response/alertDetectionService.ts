// src/app/api/whatsapp/process-response/alertDetectionService.ts
// MODIFICADO: v3.6 - Refatorado if/else em detectUntappedPotentialTopic para melhor inferência de tipo.
// MODIFICADO: v3.5 - Corrigido tipo na operação de subtração da função sort.
// MODIFICADO: v3.4 - Corrigido tipo de atribuição para metricUsed/performanceMetric em detailsForLog.
// MODIFICADO: v3.3 - Corrigido tipo de retorno da função extratora para calculateAverageMetric.
// MODIFICADO: v3.2 - Corrigido import de IDailyMetricSnapshot para vir de seu arquivo correto.
// MODIFICADO: v3.1 - Corrigido import de IMetricStats.
// MODIFICADO: v3 - Refinamentos finais no tratamento de null de calculateAverageMetric e acesso a post.stats.

import { subDays, differenceInDays, parseISO, isValid as isValidDate } from 'date-fns';
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import { 
    IAlertHistoryEntry, 
    IUser, 
    AlertDetails, 
    IPeakSharesDetails, 
    IDropWatchTimeDetails, 
    IForgottenFormatDetails, 
    IUntappedPotentialTopicDetails, 
    IEngagementPeakNotCapitalizedDetails, 
    INoEventDetails 
} from '@/app/models/User';
import { IMetricStats } from '@/app/models/Metric'; 
import { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { IDialogueState } from '@/app/lib/stateService';
import {
    ALERT_HISTORY_LOOKBACK_DAYS,
    SHARES_MIN_POST_AGE_DAYS_FOR_PICO,
    SHARES_MAX_POST_AGE_DAYS_FOR_PICO,
    SHARES_COMPARISON_LOOKBACK_DAYS,
    SHARES_MAX_POSTS_FOR_AVG,
    SHARES_PICO_THRESHOLD_MULTIPLIER,
    SHARES_MIN_ABSOLUTE_FOR_PICO,
    REELS_WATCH_TIME_LOOKBACK_DAYS,
    REELS_WATCH_TIME_MIN_FOR_ANALYSIS,
    REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS,
    REELS_WATCH_TIME_MAX_HISTORICAL_FOR_AVG,
    REELS_WATCH_TIME_DROP_THRESHOLD_PERCENTAGE,
    REELS_WATCH_TIME_MIN_HISTORICAL_FOR_ALERT,
    FORMAT_ANALYSIS_PERIOD_DAYS,
    FORMAT_UNUSED_THRESHOLD_DAYS,
    FORMAT_MIN_POSTS_FOR_AVG,
    FORMAT_PERFORMANCE_METRIC_KEY, 
    FORMAT_PROMISSING_THRESHOLD_MULTIPLIER,
    UNTAPPED_POTENTIAL_PAST_LOOKBACK_DAYS,
    UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS,
    UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY,
    UNTAPPED_POTENTIAL_PERFORMANCE_METRIC, 
    UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD,
    UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER,
    ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS,
    ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS,
    ENGAGEMENT_PEAK_MIN_ABSOLUTE_COMMENTS,
    ENGAGEMENT_PEAK_COMMENT_MULTIPLIER
} from '@/app/lib/constants';
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils'; 
import { DetectedEvent } from './types';

const SERVICE_TAG = '[AlertDetectionService v3.6]'; // Versão atualizada do serviço

function normalizeString(str?: string): string {
    return (str || '').trim().toLowerCase();
}

function getValidDate(dateInput: Date | string | undefined, postId?: string, tag?: string): Date | null {
    const logTag = tag || SERVICE_TAG;
    if (!dateInput) {
        return null;
    }
    if (dateInput instanceof Date) {
        if (isValidDate(dateInput)) return dateInput;
        if (postId) logger.warn(`${logTag} Post ${postId} tem objeto Date inválido: ${dateInput}`);
        return null;
    }
    if (typeof dateInput === 'string') {
        try {
            const parsedDate = parseISO(dateInput);
            if (isValidDate(parsedDate)) return parsedDate;
            if (postId) logger.warn(`${logTag} Post ${postId} tem string de data inválida para parseISO: ${dateInput}`);
            return null;
        } catch (e) {
            if (postId) logger.warn(`${logTag} Post ${postId} erro ao parsear string de data: ${dateInput}`, e);
            return null;
        }
    }
    if (postId) logger.warn(`${logTag} Post ${postId} tem data em formato inesperado: ${typeof dateInput}`);
    return null;
}

export function wasAlertTypeSentRecently(
    alertHistory: IAlertHistoryEntry[] | undefined,
    alertType: string, 
    lookbackDays: number,
    currentDate: Date = new Date()
): boolean {
    if (!alertHistory || alertHistory.length === 0) {
        return false;
    }
    const lookbackDate = subDays(currentDate, lookbackDays);
    return alertHistory.some(entry => {
        const entryDate = getValidDate(entry.date);
        return entryDate && entry.type === alertType && entryDate >= lookbackDate;
    });
}

export async function detectPeakPerformanceShares(
    userId: string,
    today: Date,
    userAlertHistory: IAlertHistoryEntry[],
    dialogueState: IDialogueState
): Promise<DetectedEvent | null> {
    const alertType = 'peak_performance_shares_v1'; 
    const detectionTAG = `${SERVICE_TAG}[detectPeakPerformanceShares] User ${userId}:`;

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }

    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}'.`);
    try {
        const postsFromDataService = await dataService.getRecentPostObjects(userId, SHARES_MAX_POST_AGE_DAYS_FOR_PICO + 5, { types: ['IMAGE', 'CAROUSEL', 'VIDEO', 'REEL'] });
        
        const postsToCheckPico = (postsFromDataService as PostObjectForAverage[])
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) }))
            .filter(item => {
                if (!item.postDateObj) return false;
                const postAgeDays = differenceInDays(today, item.postDateObj);
                return postAgeDays >= SHARES_MIN_POST_AGE_DAYS_FOR_PICO && postAgeDays <= SHARES_MAX_POST_AGE_DAYS_FOR_PICO;
            })
            .sort((a, b) => b.postDateObj!.getTime() - a.postDateObj!.getTime())
            .map(item => item.post);

        if (postsToCheckPico.length === 0) {
            logger.info(`${detectionTAG} Nenhum post encontrado no intervalo de idade [${SHARES_MIN_POST_AGE_DAYS_FOR_PICO}-${SHARES_MAX_POST_AGE_DAYS_FOR_PICO}] dias.`);
            return null;
        }
        
        logger.debug(`${detectionTAG} ${postsToCheckPico.length} posts encontrados para análise de pico de shares.`);

        for (const post of postsToCheckPico) {
            const postId = post._id;
            const mainPostDateObj = getValidDate(post.postDate, postId, detectionTAG);
            if(!mainPostDateObj) {
                logger.warn(`${detectionTAG} Post principal ${postId} com data inválida após filtro inicial. Pulando.`);
                continue;
            }

            const snapshots: IDailyMetricSnapshot[] = await dataService.getDailySnapshotsForMetric(postId, userId);

            if (!snapshots || snapshots.length === 0) {
                logger.debug(`${detectionTAG} Post ${postId} não possui snapshots.`);
                continue;
            }
            snapshots.sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0)); 

            let peakSharesValue: number | undefined;
            let peakSharesDay: number | undefined;
            const snapshotD2 = snapshots.find(s => s.dayNumber === 2);
            const snapshotD3 = snapshots.find(s => s.dayNumber === 3);

            if (snapshotD2 && typeof snapshotD2.dailyShares === 'number' && snapshotD2.dailyShares > 0) {
                peakSharesValue = snapshotD2.dailyShares; peakSharesDay = 2;
            } else if (snapshotD3 && typeof snapshotD3.dailyShares === 'number' && snapshotD3.dailyShares > 0) {
                peakSharesValue = snapshotD3.dailyShares; peakSharesDay = 3;
            }

            if (peakSharesValue === undefined || peakSharesDay === undefined) {
                logger.debug(`${detectionTAG} Post ${postId} não apresentou pico de shares nos dias 2 ou 3 com dados válidos.`);
                continue;
            }
            
            logger.debug(`${detectionTAG} Post ${postId} teve um pico de ${peakSharesValue} shares no dia ${peakSharesDay}. Calculando média de referência.`);

            const comparisonPostsData = await dataService.getRecentPostObjects(userId, SHARES_COMPARISON_LOOKBACK_DAYS, { types: ['IMAGE', 'CAROUSEL', 'VIDEO', 'REEL'], excludeIds: [postId] });
            const comparisonPosts = (comparisonPostsData as PostObjectForAverage[])
                .map(p => ({ post: p, postDateObj: getValidDate(p.postDate, p._id, detectionTAG) }))
                .filter(item => {
                    if (!item.postDateObj || !mainPostDateObj ) return false;
                    return item.postDateObj < mainPostDateObj;
                })
                .sort((a,b) => b.postDateObj!.getTime() - a.postDateObj!.getTime()) 
                .slice(0, SHARES_MAX_POSTS_FOR_AVG)
                .map(item => item.post);

            let totalSharesForAvg = 0;
            let countSnapshotsForAvg = 0;

            for (const compPost of comparisonPosts) {
                const compPostId = compPost._id;
                const compSnapshots = await dataService.getDailySnapshotsForMetric(compPostId, userId);

                compSnapshots.sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0));
                for (let dayNum = 1; dayNum <= 3; dayNum++) {
                    const compSnapshot = compSnapshots.find(s => s.dayNumber === dayNum);
                    if (compSnapshot && typeof compSnapshot.dailyShares === 'number') {
                        totalSharesForAvg += compSnapshot.dailyShares;
                        countSnapshotsForAvg++;
                    }
                }
            }

            const averageSharesFirst3Days = countSnapshotsForAvg > 0 ? totalSharesForAvg / countSnapshotsForAvg : 0;

            logger.debug(`${detectionTAG} Post ${postId}: Pico Shares = ${peakSharesValue}, Média Referência Shares = ${averageSharesFirst3Days.toFixed(1)}`);

            if (peakSharesValue >= SHARES_MIN_ABSOLUTE_FOR_PICO && peakSharesValue > averageSharesFirst3Days * SHARES_PICO_THRESHOLD_MULTIPLIER) {
                const postDescriptionForAI = post.description ? `"${post.description.substring(0, 50)}..."` : "recente";
                
                const detailsForLog: IPeakSharesDetails = {
                    postId: postId,
                    postDescriptionExcerpt: post.description ? post.description.substring(0, 100) : undefined,
                    peakShares: peakSharesValue,
                    peakDay: peakSharesDay,
                    averageSharesFirst3Days: averageSharesFirst3Days,
                    format: post.format,
                    proposal: post.proposal,
                    context: post.context
                };
                
                const detectedEvent: DetectedEvent = {
                    type: alertType,
                    messageForAI: `Radar Tuca detectou: Seu post ${postDescriptionForAI} teve um pico de ${peakSharesValue} compartilhamentos no Dia ${peakSharesDay}, significativamente acima da sua média habitual (${averageSharesFirst3Days.toFixed(1)} shares nos primeiros dias). Isso é um ótimo sinal de que o conteúdo ressoou fortemente!`,
                    detailsForLog: detailsForLog
                };
                logger.info(`${detectionTAG} '${alertType}' DETECTADO. ${JSON.stringify(detectedEvent.detailsForLog)}`);
                return detectedEvent;
            }
        }
        logger.info(`${detectionTAG} Nenhum '${alertType}' detectado após análise completa dos posts elegíveis.`);
    } catch (error) {
        logger.error(`${detectionTAG} Erro ao detectar '${alertType}':`, error);
    }
    return null;
}

export async function detectUnexpectedDropReelsWatchTime(
    userId: string,
    today: Date,
    userAlertHistory: IAlertHistoryEntry[],
    dialogueState: IDialogueState
): Promise<DetectedEvent | null> {
    const alertType = 'unexpected_drop_reels_watch_time_v1'; 
    const detectionTAG = `${SERVICE_TAG}[detectUnexpectedDropReelsWatchTime] User ${userId}:`;

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }
    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}'.`);
    try {
        const recentReelsData = await dataService.getRecentPostObjects(userId, REELS_WATCH_TIME_LOOKBACK_DAYS, { types: ['REEL'] });
        const recentReels = (recentReelsData as PostObjectForAverage[])
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) }))
            .filter(item => !!item.postDateObj)
            .sort((a, b) => b.postDateObj!.getTime() - a.postDateObj!.getTime())
            .map(item => item.post);

        if (recentReels.length < REELS_WATCH_TIME_MIN_FOR_ANALYSIS) {
            logger.info(`${detectionTAG} Não há Reels recentes suficientes (${recentReels.length}) para análise (mínimo: ${REELS_WATCH_TIME_MIN_FOR_ANALYSIS}).`);
            return null;
        }
        
        logger.debug(`${detectionTAG} ${recentReels.length} Reels recentes encontrados para análise de tempo de visualização.`);

        let sumCurrentAvgWatchTime = 0;
        let countReelsWithWatchTime = 0;
        const latestReelsForAvg = recentReels.slice(0, 3); 

        for (const reel of latestReelsForAvg) {
            const reelId = reel._id;
            const snapshots = await dataService.getDailySnapshotsForMetric(reelId, userId);

            if (snapshots && snapshots.length > 0) {
                const latestSnapshotWithWatchTime = snapshots
                    .filter(s => typeof s.currentReelsAvgWatchTime === 'number') 
                    .sort((a,b) => (b.dayNumber || 0) - (a.dayNumber || 0))[0];

                if (latestSnapshotWithWatchTime && typeof latestSnapshotWithWatchTime.currentReelsAvgWatchTime === 'number') {
                    sumCurrentAvgWatchTime += latestSnapshotWithWatchTime.currentReelsAvgWatchTime;
                    countReelsWithWatchTime++;
                }
            }
        }

        if (countReelsWithWatchTime === 0) {
            logger.info(`${detectionTAG} Não foi possível calcular o tempo médio de visualização atual (sem dados válidos nos snapshots dos Reels recentes).`);
            return null;
        }
        
        const currentAverageReelsWatchTime = sumCurrentAvgWatchTime / countReelsWithWatchTime;
        logger.debug(`${detectionTAG} Tempo médio de visualização atual dos Reels: ${currentAverageReelsWatchTime.toFixed(1)}s`);

        const historicalReelsData = await dataService.getRecentPostObjects(userId, REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS, { types: ['REEL'], excludeIds: latestReelsForAvg.map(r => r._id) });
        const historicalReels = (historicalReelsData as PostObjectForAverage[])
            .map(p => ({ post: p, postDateObj: getValidDate(p.postDate, p._id, detectionTAG) }))
            .filter(item => {
                if (!item.postDateObj) return false;
                const lastRecentReel = latestReelsForAvg[latestReelsForAvg.length-1];
                if (!lastRecentReel) return false; 
                const lastRecentReelDateObj = getValidDate(lastRecentReel.postDate, lastRecentReel._id, detectionTAG);
                return lastRecentReelDateObj && item.postDateObj < lastRecentReelDateObj;
            })
            .sort((a,b) => b.postDateObj!.getTime() - a.postDateObj!.getTime())
            .slice(0, REELS_WATCH_TIME_MAX_HISTORICAL_FOR_AVG)
            .map(item => item.post);

        let sumHistoricalAvgWatchTime = 0;
        let countHistoricalReelsWithWatchTime = 0;

        for (const histReel of historicalReels) {
            const histReelId = histReel._id;
            const histSnapshots = await dataService.getDailySnapshotsForMetric(histReelId, userId);

            if (histSnapshots && histSnapshots.length > 0) {
                    const latestHistSnapshotWithWatchTime = histSnapshots
                    .filter(s => typeof s.currentReelsAvgWatchTime === 'number')
                    .sort((a,b) => (b.dayNumber || 0) - (a.dayNumber || 0))[0];

                if (latestHistSnapshotWithWatchTime && typeof latestHistSnapshotWithWatchTime.currentReelsAvgWatchTime === 'number') {
                    sumHistoricalAvgWatchTime += latestHistSnapshotWithWatchTime.currentReelsAvgWatchTime;
                    countHistoricalReelsWithWatchTime++;
                }
            }
        }
        
        const historicalAverageReelsWatchTime = countHistoricalReelsWithWatchTime > 0 ?
            sumHistoricalAvgWatchTime / countHistoricalReelsWithWatchTime :
            (currentAverageReelsWatchTime > 5 ? currentAverageReelsWatchTime * 1.5 : 15); 

        logger.debug(`${detectionTAG} Tempo médio de visualização histórico dos Reels: ${historicalAverageReelsWatchTime.toFixed(1)}s (baseado em ${countHistoricalReelsWithWatchTime} reels)`);

        if (historicalAverageReelsWatchTime >= REELS_WATCH_TIME_MIN_HISTORICAL_FOR_ALERT && currentAverageReelsWatchTime < historicalAverageReelsWatchTime * (1 - REELS_WATCH_TIME_DROP_THRESHOLD_PERCENTAGE)) {
            
            const detailsForLog: IDropWatchTimeDetails = { 
                currentAvg: currentAverageReelsWatchTime,
                historicalAvg: historicalAverageReelsWatchTime,
                reelsAnalyzedIds: latestReelsForAvg.map(r=> r._id)
            };

            const detectedEvent: DetectedEvent = {
                type: alertType,
                messageForAI: `Radar Tuca detectou: O tempo médio de visualização dos seus Reels mais recentes está em torno de ${currentAverageReelsWatchTime.toFixed(0)}s. Isso é um pouco abaixo da sua média histórica de ${historicalAverageReelsWatchTime.toFixed(0)}s. Pode ser um sinal para revisitar as introduções ou o ritmo desses Reels.`,
                detailsForLog: detailsForLog
            };
            logger.info(`${detectionTAG} '${alertType}' DETECTADO. ${JSON.stringify(detectedEvent.detailsForLog)}`);
            return detectedEvent;
        }
        logger.info(`${detectionTAG} Nenhum '${alertType}' detectado após análise.`);
    } catch (error) {
        logger.error(`${detectionTAG} Erro ao detectar '${alertType}':`, error);
    }
    return null;
}

export async function detectForgottenPromisingFormat(
    userId: string,
    today: Date,
    userAlertHistory: IAlertHistoryEntry[],
    dialogueState: IDialogueState
): Promise<DetectedEvent | null> {
    const alertType = 'forgotten_format_promising_v1'; 
    const detectionTAG = `${SERVICE_TAG}[detectForgottenPromisingFormat] User ${userId}:`;
    const METRIC_TO_USE: keyof IMetricStats = FORMAT_PERFORMANCE_METRIC_KEY; 

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }
    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}'. Usando métrica: ${METRIC_TO_USE}`);
    try {
        const allPostsLastPeriodData = await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, FORMAT_ANALYSIS_PERIOD_DAYS);
        const allPostsLastPeriod = allPostsLastPeriodData as PostObjectForAverage[];

        if (allPostsLastPeriod.length < FORMAT_MIN_POSTS_FOR_AVG * 2) { 
            logger.info(`${detectionTAG} Não há posts suficientes (${allPostsLastPeriod.length}) nos últimos ${FORMAT_ANALYSIS_PERIOD_DAYS} dias para análise de formato (mínimo: ${FORMAT_MIN_POSTS_FOR_AVG * 2}).`);
            return null;
        }
        
        logger.debug(`${detectionTAG} ${allPostsLastPeriod.length} posts encontrados para análise de formato esquecido.`);

        const formatPerformance: {
            [key: string]: { totalMetricValue: number, count: number, avgMetric: number, lastUsed: Date, postsInFormat: PostObjectForAverage[] } 
        } = {};

        for (const post of allPostsLastPeriod) {
            const currentFormat = post.format; 
            if (!currentFormat) { 
                logger.warn(`${detectionTAG} Post ${post._id} sem 'format', pulando.`);
                continue;
            }
            if (!post.stats) {
                logger.warn(`${detectionTAG} Post ${post._id} não possui 'stats', pulando.`);
                continue;
            }
            if (!formatPerformance[currentFormat]) { 
                formatPerformance[currentFormat] = { totalMetricValue: 0, count: 0, avgMetric: 0, lastUsed: new Date(0), postsInFormat: [] };
            }
            const perf = formatPerformance[currentFormat]!;
            const metricValue = post.stats?.[METRIC_TO_USE];

            if (typeof metricValue === 'number' && !isNaN(metricValue)) {
                perf.totalMetricValue += metricValue;
                perf.count++;
                perf.postsInFormat.push(post); 
            }
            const postDateObj = getValidDate(post.postDate, post._id, detectionTAG);
            if (postDateObj && postDateObj > perf.lastUsed) {
                perf.lastUsed = postDateObj;
            }
        }

        let bestForgottenFormatInfo: { format: string, avgMetric: number, daysSinceLastUsed: number } | null = null;

        for (const formatKey in formatPerformance) {
            const perfData = formatPerformance[formatKey]!;
            if (perfData.count < FORMAT_MIN_POSTS_FOR_AVG) continue; 

            perfData.avgMetric = perfData.totalMetricValue / perfData.count; 
            
            const daysSinceLastUsed = differenceInDays(today, perfData.lastUsed);

            if (daysSinceLastUsed > FORMAT_UNUSED_THRESHOLD_DAYS) {
                if (!bestForgottenFormatInfo || perfData.avgMetric > bestForgottenFormatInfo.avgMetric) {
                    bestForgottenFormatInfo = { format: formatKey, avgMetric: perfData.avgMetric, daysSinceLastUsed };
                }
            }
        }

        if (bestForgottenFormatInfo) {
            logger.debug(`${detectionTAG} Melhor formato esquecido: ${bestForgottenFormatInfo.format} (Média ${METRIC_TO_USE}: ${bestForgottenFormatInfo.avgMetric.toFixed(1)}, Não usado há ${bestForgottenFormatInfo.daysSinceLastUsed} dias).`);
            
            const overallAvgPerformance = calculateAverageMetric(
                allPostsLastPeriod.filter(p => !!p.stats), 
                (p: PostObjectForAverage): number | undefined => { 
                    const value = p.stats?.[METRIC_TO_USE];
                    if (typeof value === 'number' && !isNaN(value)) {
                        return value;
                    }
                    return undefined;
                }
            ); 
            
            if (overallAvgPerformance === null) {
                logger.warn(`${detectionTAG} Média geral de performance (${METRIC_TO_USE}) não pôde ser calculada (calculateAverageMetric retornou null).`);
                return null;
            }
            if (overallAvgPerformance <= 0 && bestForgottenFormatInfo.avgMetric <=0) {
                logger.debug(`${detectionTAG} Média geral de performance (${METRIC_TO_USE}) e do formato esquecido são zero ou negativas. Pulando.`);
                return null;
            }
            logger.debug(`${detectionTAG} Média geral de ${METRIC_TO_USE}: ${overallAvgPerformance.toFixed(1)}.`);

            if (bestForgottenFormatInfo.avgMetric > (overallAvgPerformance * FORMAT_PROMISSING_THRESHOLD_MULTIPLIER) && bestForgottenFormatInfo.avgMetric > 0) {
                const percentageSuperior = overallAvgPerformance > 0 ? ((bestForgottenFormatInfo.avgMetric / overallAvgPerformance - 1) * 100) : (bestForgottenFormatInfo.avgMetric > 0 ? 100 : 0);

                const detailsForLog: IForgottenFormatDetails = { 
                    format: bestForgottenFormatInfo.format,
                    avgMetricValue: bestForgottenFormatInfo.avgMetric,
                    overallAvgPerformance: overallAvgPerformance,
                    metricUsed: METRIC_TO_USE as string,
                    daysSinceLastUsed: bestForgottenFormatInfo.daysSinceLastUsed,
                    percentageSuperior: percentageSuperior
                };
                
                let metricDisplayName = METRIC_TO_USE as string;
                if (METRIC_TO_USE === 'total_interactions') metricDisplayName = 'interações totais';
                else if (METRIC_TO_USE === 'impressions') metricDisplayName = 'impressões';

                const detectedEvent: DetectedEvent = {
                    type: alertType,
                    messageForAI: `Radar Tuca de olho! 👀 Percebi que faz uns ${bestForgottenFormatInfo.daysSinceLastUsed} dias que você não usa o formato **${bestForgottenFormatInfo.format}**. No passado, posts nesse formato tiveram um desempenho (${metricDisplayName}) em média ${percentageSuperior.toFixed(0)}% superior à sua média geral (${bestForgottenFormatInfo.avgMetric.toFixed(1)} vs ${overallAvgPerformance.toFixed(1)} ${metricDisplayName}). Que tal revisitar esse formato?`,
                    detailsForLog: detailsForLog
                };
                logger.info(`${detectionTAG} '${alertType}' DETECTADO. ${JSON.stringify(detectedEvent.detailsForLog)}`);
                return detectedEvent;
            } else {
                logger.debug(`${detectionTAG} Formato esquecido ${bestForgottenFormatInfo.format} (avg ${METRIC_TO_USE}: ${bestForgottenFormatInfo.avgMetric.toFixed(1)}) não atingiu o limiar "promissor" (${(overallAvgPerformance * FORMAT_PROMISSING_THRESHOLD_MULTIPLIER).toFixed(1)}) em relação à média geral (${overallAvgPerformance.toFixed(1)}).`);
            }
        }
        logger.info(`${detectionTAG} Nenhum '${alertType}' detectado após análise.`);
    } catch (error) {
        logger.error(`${detectionTAG} Erro ao detectar '${alertType}':`, error);
    }
    return null;
}

export async function detectUntappedPotentialTopic(
    userId: string,
    today: Date,
    userAlertHistory: IAlertHistoryEntry[],
    dialogueState: IDialogueState
): Promise<DetectedEvent | null> {
    const alertType = 'untapped_potential_topic_v2'; 
    const detectionTAG = `${SERVICE_TAG}[detectUntappedPotentialTopic] User ${userId}:`;
    const METRIC_TO_USE: keyof IMetricStats = UNTAPPED_POTENTIAL_PERFORMANCE_METRIC; 

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }
    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}'. Usando métrica: ${METRIC_TO_USE}`);

    try {
        const allPostsInLookbackData = await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, UNTAPPED_POTENTIAL_PAST_LOOKBACK_DAYS);
        const allPostsInLookback = allPostsInLookbackData as PostObjectForAverage[];

        if (allPostsInLookback.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY * 2) { 
            logger.info(`${detectionTAG} Posts insuficientes (${allPostsInLookback.length}) para análise completa.`);
            return null;
        }

        const recentPosts: PostObjectForAverage[] = [];
        const olderPostsAnalysisPool: PostObjectForAverage[] = [];

        for (const post of allPostsInLookback) {
            const postDateObj = getValidDate(post.postDate, post._id, detectionTAG);
            if (!postDateObj) continue;
            if (!post.stats) {
                 logger.warn(`${detectionTAG} Post ${post._id} não possui 'stats', pulando na divisão de pools.`);
                continue;
            }
            if (differenceInDays(today, postDateObj) <= UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS) {
                recentPosts.push(post);
            } else {
                olderPostsAnalysisPool.push(post);
            }
        }

        if (olderPostsAnalysisPool.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY || recentPosts.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY) { 
            logger.info(`${detectionTAG} Posts insuficientes nos pools (Antigos: ${olderPostsAnalysisPool.length}, Recentes: ${recentPosts.length}). Mínimo: ${UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY}.`);
            return null;
        }
        
        logger.debug(`${detectionTAG} Posts antigos para análise: ${olderPostsAnalysisPool.length}, Posts recentes para referência: ${recentPosts.length}`);

        olderPostsAnalysisPool.sort((a, b) => {
            const valA = Number(a.stats?.[METRIC_TO_USE] || 0);
            const valB = Number(b.stats?.[METRIC_TO_USE] || 0);
            return valB - valA;
        });
        
        const percentileIndexFloat = olderPostsAnalysisPool.length * (1 - UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD); 
        const percentileIndex = Math.min(Math.max(0, Math.floor(percentileIndexFloat)), olderPostsAnalysisPool.length - 1);
        
        const performanceThresholdValue = Number(olderPostsAnalysisPool[percentileIndex]?.stats?.[METRIC_TO_USE] || 0);

        const highPerformingOldPosts = olderPostsAnalysisPool.filter(
            post => (Number(post.stats?.[METRIC_TO_USE] || 0)) >= performanceThresholdValue &&
                    (Number(post.stats?.[METRIC_TO_USE] || 0)) > 0
        );

        if (highPerformingOldPosts.length === 0) {
            logger.info(`${detectionTAG} Nenhum post antigo de alto desempenho encontrado no top ${((1-UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD)*100).toFixed(0)}% (limiar ${METRIC_TO_USE}: ${performanceThresholdValue}).`);
            return null;
        }
        
        logger.debug(`${detectionTAG} ${highPerformingOldPosts.length} posts antigos de alto desempenho candidatos (limiar ${METRIC_TO_USE}: ${performanceThresholdValue}).`);

        for (const oldPost of highPerformingOldPosts) {
            const oldFormat = normalizeString(oldPost.format);
            const oldProposal = normalizeString(oldPost.proposal);
            const oldContext = normalizeString(oldPost.context);

            const hasSimilarRecentPost = recentPosts.some(recentPost => 
                normalizeString(recentPost.format) === oldFormat &&
                normalizeString(recentPost.proposal) === oldProposal &&
                normalizeString(recentPost.context) === oldContext
            );

            if (hasSimilarRecentPost) {
                logger.debug(`${detectionTAG} Post antigo ${oldPost._id} (F:${oldFormat} P:${oldProposal} C:${oldContext}) tem um similar recente. Pulando.`);
                continue; 
            }

            let referenceAveragePerformance: number | null;
            const recentPostsSameFormat = recentPosts.filter(p => normalizeString(p.format) === oldFormat && p.stats);
            const extractor = (p: PostObjectForAverage): number | undefined => {
                const value = p.stats?.[METRIC_TO_USE];
                if (typeof value === 'number' && !isNaN(value)) {
                    return value;
                }
                return undefined;
            };

            if (recentPostsSameFormat.length >= UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY) {
                referenceAveragePerformance = calculateAverageMetric(recentPostsSameFormat, extractor);
            } else { 
                referenceAveragePerformance = calculateAverageMetric(recentPosts.filter(p => !!p.stats), extractor); 
            }
            
            if (referenceAveragePerformance === null) { // MODIFICADO: Verificação de null primeiro
                 logger.warn(`${detectionTAG} Média de referência (${METRIC_TO_USE}) para post ${oldPost._id} não pôde ser calculada (calculateAverageMetric retornou null).`);
                continue; 
            } else { // Agora referenceAveragePerformance é um número
                const refAvgPerfNumber: number = referenceAveragePerformance; // Para clareza e melhor inferência de tipo
                const oldPostMetricValue = Number(oldPost.stats?.[METRIC_TO_USE] || 0);

                if (refAvgPerfNumber <= 0 && oldPostMetricValue <=0) {
                    logger.debug(`${detectionTAG} Média de referência (${METRIC_TO_USE}) e performance do post antigo são zero ou negativas. Pulando post ${oldPost._id}.`);
                    continue;
                }
                logger.debug(`${detectionTAG} Post ${oldPost._id}: Média de referência (${METRIC_TO_USE}, ${recentPostsSameFormat.length >= UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY ? 'formato' : 'geral'}): ${refAvgPerfNumber.toFixed(1)}`);

                const oldPostPerformance = Number(oldPost.stats?.[METRIC_TO_USE] || 0);

                if (oldPostPerformance > refAvgPerfNumber * UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER && oldPostPerformance > 0) {
                    const performanceValue = oldPostPerformance;
                    const oldPostDateObj = getValidDate(oldPost.postDate, oldPost._id, detectionTAG);
                    if (!oldPostDateObj) {
                        logger.error(`${detectionTAG} Data inválida para oldPost ${oldPost._id} na ação. Não é possível gerar alerta.`);
                        continue; 
                    }
                    const daysSincePosted = differenceInDays(today, oldPostDateObj);
                    
                    const detailsForLog: IUntappedPotentialTopicDetails = {
                        postId: oldPost._id, 
                        postDescriptionExcerpt: oldPost.description ? oldPost.description.substring(0,70) : undefined,
                        performanceMetric: METRIC_TO_USE as string,
                        performanceValue: performanceValue, 
                        referenceAverage: refAvgPerfNumber, // Usa a variável tipada
                        daysSincePosted: daysSincePosted,
                        postType: oldPost.type, 
                        format: oldPost.format, 
                        proposal: oldPost.proposal,
                        context: oldPost.context,
                    };

                    let metricDisplayName = METRIC_TO_USE as string;
                    if (METRIC_TO_USE === 'total_interactions') metricDisplayName = 'interações totais';
                    else if (METRIC_TO_USE === 'impressions') metricDisplayName = 'impressões';

                    const detectedEvent: DetectedEvent = {
                        type: alertType,
                        messageForAI: `Radar Tuca detectou: Lembra do seu post "${oldPost.description ? oldPost.description.substring(0, 70) + "..." : "um post anterior"}" (classificado como ${oldPost.format || 'N/D'})? Ele teve um ótimo desempenho (${performanceValue.toFixed(0)} ${metricDisplayName}) há cerca de ${daysSincePosted} dias, superando a média recente de posts similares (${refAvgPerfNumber.toFixed(1)})! Parece que o tema/formato (Proposta: ${oldPost.proposal || 'N/D'} / Contexto: ${oldPost.context || 'N/D'}) ressoou bem e não foi revisitado. Que tal explorar essa ideia novamente?`,
                        detailsForLog: detailsForLog 
                    };
                    logger.info(`${detectionTAG} '${alertType}' DETECTADO. ${JSON.stringify(detailsForLog)}`);
                    return detectedEvent; 
                } else {
                     logger.debug(`${detectionTAG} Post antigo ${oldPost._id} (Perf ${METRIC_TO_USE}:${oldPostPerformance.toFixed(1)}) não foi significativamente superior à média de referência (${refAvgPerfNumber.toFixed(1)} * ${UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER}).`);
                }
            }
        }
        logger.info(`${detectionTAG} Nenhum '${alertType}' detectado após análise completa dos posts antigos de alto desempenho.`);

    } catch (error) {
        logger.error(`${detectionTAG} Erro ao detectar '${alertType}':`, error);
    }
    return null;
}


export async function detectEngagementPeakNotCapitalized(
    userId: string,
    today: Date,
    userAlertHistory: IAlertHistoryEntry[],
    dialogueState: IDialogueState
): Promise<DetectedEvent | null> {
    const alertType = 'engagement_peak_not_capitalized_v1'; 
    const detectionTAG = `${SERVICE_TAG}[detectEngagementPeakNotCapitalized] User ${userId}:`;
    const METRIC_FOR_COMMENTS: keyof IMetricStats = 'comments';

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }
    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}'.`);

    try {
        const postsToCheckData = await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS);
        const postsToCheck = (postsToCheckData as PostObjectForAverage[])
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) }))
            .filter(item => {
                if (!item.postDateObj) return false;
                if (!item.post.stats) { 
                    logger.warn(`${detectionTAG} Post ${item.post._id} não possui 'stats', pulando na filtragem de postsToCheck.`);
                    return false;
                }
                const ageInDays = differenceInDays(today, item.postDateObj);
                return ageInDays >= ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS && ageInDays <= ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS;
            })
            .sort((a,b) => {
                const valA = Number(a.post.stats?.[METRIC_FOR_COMMENTS] || 0);
                const valB = Number(b.post.stats?.[METRIC_FOR_COMMENTS] || 0);
                return valB - valA;
            })
            .map(item => item.post);

        if (postsToCheck.length === 0) {
            logger.info(`${detectionTAG} Nenhum post encontrado no intervalo de idade [${ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS}-${ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS}] dias.`);
            return null;
        }
        
        logger.debug(`${detectionTAG} ${postsToCheck.length} posts encontrados para análise de pico de comentários.`);

        const historicalPostsData = await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, 60);
        const historicalPosts = (historicalPostsData as PostObjectForAverage[]).filter(p => !!p.stats); 
        
        const averageComments = calculateAverageMetric(
            historicalPosts,
            (p: PostObjectForAverage): number | undefined => {
                const value = p.stats?.[METRIC_FOR_COMMENTS];
                if (typeof value === 'number' && !isNaN(value)) {
                    return value;
                }
                return undefined;
            }
        ); 

        if (averageComments === null) {
            logger.warn(`${detectionTAG} Média histórica de comentários (${METRIC_FOR_COMMENTS}) não pôde ser calculada (calculateAverageMetric retornou null).`);
            return null; 
        }

        for (const post of postsToCheck) {
            const postComments = Number(post.stats?.[METRIC_FOR_COMMENTS] || 0); 

            if (postComments >= ENGAGEMENT_PEAK_MIN_ABSOLUTE_COMMENTS && postComments > averageComments * ENGAGEMENT_PEAK_COMMENT_MULTIPLIER) {
                const postDescriptionForAI = post.description ? `"${post.description.substring(0, 70)}..."` : "um post recente";
                const postId = post._id; 
                const detailsForLog: IEngagementPeakNotCapitalizedDetails = {
                    postId: postId,
                    postDescriptionExcerpt: post.description ? post.description.substring(0,70) : undefined, 
                    comments: postComments,
                    averageComments: averageComments, 
                    postType: post.type,
                    format: post.format, 
                    proposal: post.proposal,
                    context: post.context,
                };

                const detectedEvent: DetectedEvent = {
                    type: alertType,
                    messageForAI: `Radar Tuca detectou: Seu post ${postDescriptionForAI} gerou bastante conversa, com ${postComments} comentários! Isso é bem acima da sua média de ${averageComments.toFixed(1)}. Parece que sua audiência tem perguntas ou muito interesse no tema. Já considerou fazer um conteúdo de follow-up ou responder mais diretamente aos comentários para manter essa chama acesa?`,
                    detailsForLog: detailsForLog
                };
                logger.info(`${detectionTAG} '${alertType}' DETECTADO. ${JSON.stringify(detailsForLog)}`);
                return detectedEvent;
            }
        }

        logger.info(`${detectionTAG} Nenhum '${alertType}' detectado após análise.`);
    } catch (error) {
        logger.error(`${detectionTAG} Erro ao detectar '${alertType}':`, error);
    }
    return null;
}
