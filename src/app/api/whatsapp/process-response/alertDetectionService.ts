// src/app/api/whatsapp/process-response/alertDetectionService.ts
import { subDays, differenceInDays, parseISO } from 'date-fns';
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import { IAlertHistoryEntry, IUser, AlertDetails, IPeakSharesDetails, IDropWatchTimeDetails, IForgottenFormatDetails, IUntappedPotentialTopicDetails, IEngagementPeakNotCapitalizedDetails, INoEventDetails } from '@/app/models/User';
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
// PostObjectForAverage é usado internamente para clareza, mas os dados vêm de getRecentPostObjectsWithAggregatedMetrics que retorna PostObject[]
// A estrutura de PostObject (de dataService/types.ts) e PostObjectForAverage (de utils.ts) devem ser compatíveis.
import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils';
import { DetectedEvent } from './types'; // DetectedEvent.detailsForLog é tipado como AlertDetails

const SERVICE_TAG = '[AlertDetectionService]';

// Interface temporária para workaround até IDailyMetricSnapshot ser corrigida/enriquecida
// Se IDailyMetricSnapshot já tem dayNumber (como fizemos), este pode não ser necessário.
interface IDailyMetricSnapshotWithDayNumber extends IDailyMetricSnapshot {
    dayNumber?: number; // Garantir que este campo seja populado pela função que busca os snapshots
}


function normalizeString(str?: string): string {
    return (str || '').trim().toLowerCase();
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
    return alertHistory.some(entry =>
        entry.type === alertType &&
        new Date(entry.date) >= lookbackDate
    );
}

export async function detectPeakPerformanceShares(
    userId: string,
    today: Date,
    userAlertHistory: IAlertHistoryEntry[],
    dialogueState: IDialogueState
): Promise<DetectedEvent | null> {
    const alertType = 'peak_performance_shares';
    const detectionTAG = `${SERVICE_TAG}[${alertType}] User ${userId}:`;

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }

    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}'.`);
    try {
        // getRecentPostObjects retorna PostObject[], que deve ser compatível com PostObjectForAverage
        const postsToCheckPico = (await dataService.getRecentPostObjects(userId, SHARES_MAX_POST_AGE_DAYS_FOR_PICO + 5, { types: ['IMAGE', 'CAROUSEL', 'VIDEO'] }) as PostObjectForAverage[])
            .filter(post => {
                const createdAtDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
                const postAgeDays = differenceInDays(today, createdAtDate);
                return postAgeDays >= SHARES_MIN_POST_AGE_DAYS_FOR_PICO && postAgeDays <= SHARES_MAX_POST_AGE_DAYS_FOR_PICO;
            })
            .sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : parseISO(a.createdAt as string);
                const dateB = b.createdAt instanceof Date ? b.createdAt : parseISO(b.createdAt as string);
                return dateB.getTime() - dateA.getTime();
            });

        if (postsToCheckPico.length === 0) {
            logger.info(`${detectionTAG} Nenhum post encontrado no intervalo de idade [${SHARES_MIN_POST_AGE_DAYS_FOR_PICO}-${SHARES_MAX_POST_AGE_DAYS_FOR_PICO}] dias.`);
            return null;
        }
        
        logger.debug(`${detectionTAG} ${postsToCheckPico.length} posts encontrados para análise de pico de shares.`);

        for (const post of postsToCheckPico) {
            const postId = post._id;
            // getDailySnapshotsForMetric deve retornar IDailyMetricSnapshot[] que já inclui dayNumber
            const snapshots: IDailyMetricSnapshot[] = await dataService.getDailySnapshotsForMetric(postId, userId);

            if (!snapshots || snapshots.length === 0) {
                logger.debug(`${detectionTAG} Post ${postId} não possui snapshots.`);
                continue;
            }
            snapshots.sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0)); // Usa dayNumber do modelo

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

            const recentComparisonPosts = (await dataService.getRecentPostObjects(userId, SHARES_COMPARISON_LOOKBACK_DAYS, { types: ['IMAGE', 'CAROUSEL', 'VIDEO'], excludeIds: [postId] }) as PostObjectForAverage[])
                .filter(p => {
                    const dateP = p.createdAt instanceof Date ? p.createdAt : parseISO(p.createdAt as string);
                    const datePost = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
                    return dateP < datePost;
                });

            let totalSharesForAvg = 0;
            let countSnapshotsForAvg = 0;

            for (const compPost of recentComparisonPosts.slice(0, SHARES_MAX_POSTS_FOR_AVG)) {
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
                    postDescriptionExcerpt: post.description ? post.description.substring(0, 100) : undefined, // Ajustado para 100 como no código original do usuário
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
                    detailsForLog: detailsForLog // detailsForLog é do tipo AlertDetails
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
    const alertType = 'unexpected_drop_reels_watch_time';
    const detectionTAG = `${SERVICE_TAG}[${alertType}] User ${userId}:`;

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }
    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}'.`);
    try {
        const recentReels = (await dataService.getRecentPostObjects(userId, REELS_WATCH_TIME_LOOKBACK_DAYS, { types: ['REEL'] }) as PostObjectForAverage[])
            .sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : parseISO(a.createdAt as string);
                const dateB = b.createdAt instanceof Date ? b.createdAt : parseISO(b.createdAt as string);
                return dateB.getTime() - dateA.getTime();
            });

        if (recentReels.length < REELS_WATCH_TIME_MIN_FOR_ANALYSIS) {
            logger.info(`${detectionTAG} Não há Reels suficientes (${recentReels.length}) para análise (mínimo: ${REELS_WATCH_TIME_MIN_FOR_ANALYSIS}).`);
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
                    .filter(s => typeof s.currentReelsAvgWatchTime === 'number') // Filtra antes de ordenar
                    .sort((a,b) => (b.dayNumber || 0) - (a.dayNumber || 0))
                    .find(s => true); // Pega o primeiro após ordenar (o mais recente com watch time)

                if (latestSnapshotWithWatchTime && typeof latestSnapshotWithWatchTime.currentReelsAvgWatchTime === 'number') {
                    sumCurrentAvgWatchTime += latestSnapshotWithWatchTime.currentReelsAvgWatchTime;
                    countReelsWithWatchTime++;
                }
            }
        }

        if (countReelsWithWatchTime > 0) {
            const currentAverageReelsWatchTime = sumCurrentAvgWatchTime / countReelsWithWatchTime;
            logger.debug(`${detectionTAG} Tempo médio de visualização atual dos Reels: ${currentAverageReelsWatchTime.toFixed(1)}s`);

            const historicalReels = (await dataService.getRecentPostObjects(userId, REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS, { types: ['REEL'], excludeIds: latestReelsForAvg.map(r => r._id) }) as PostObjectForAverage[])
                .filter(p => {
                    const dateP = p.createdAt instanceof Date ? p.createdAt : parseISO(p.createdAt as string);
                    const lastRecentReelDate = latestReelsForAvg[latestReelsForAvg.length-1]?.createdAt; 
                    if (!lastRecentReelDate) return false; // Segurança
                    const dateLastRecent = lastRecentReelDate instanceof Date ? lastRecentReelDate : parseISO(lastRecentReelDate as string);
                    return dateP < dateLastRecent;
                });

            let sumHistoricalAvgWatchTime = 0;
            let countHistoricalReelsWithWatchTime = 0;

            for (const histReel of historicalReels.slice(0, REELS_WATCH_TIME_MAX_HISTORICAL_FOR_AVG)) {
                const histReelId = histReel._id;
                const histSnapshots = await dataService.getDailySnapshotsForMetric(histReelId, userId);

                if (histSnapshots && histSnapshots.length > 0) {
                     const latestHistSnapshotWithWatchTime = histSnapshots
                        .filter(s => typeof s.currentReelsAvgWatchTime === 'number')
                        .sort((a,b) => (b.dayNumber || 0) - (a.dayNumber || 0))
                        .find(s => true);

                    if (latestHistSnapshotWithWatchTime && typeof latestHistSnapshotWithWatchTime.currentReelsAvgWatchTime === 'number') {
                        sumHistoricalAvgWatchTime += latestHistSnapshotWithWatchTime.currentReelsAvgWatchTime;
                        countHistoricalReelsWithWatchTime++;
                    }
                }
            }
            
            const historicalAverageReelsWatchTime = countHistoricalReelsWithWatchTime > 0 ?
                sumHistoricalAvgWatchTime / countHistoricalReelsWithWatchTime :
                (currentAverageReelsWatchTime > 5 ? currentAverageReelsWatchTime * 1.5 : 15); 

            logger.debug(`${detectionTAG} Tempo médio de visualização histórico dos Reels: ${historicalAverageReelsWatchTime.toFixed(1)}s`);

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
        } else {
            logger.info(`${detectionTAG} Não foi possível calcular o tempo médio de visualização atual (sem dados válidos nos snapshots dos Reels recentes).`);
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
    const alertType = 'forgotten_format_promising';
    const detectionTAG = `${SERVICE_TAG}[${alertType}] User ${userId}:`;

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }
    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}'.`);
    try {
        const allPostsLastPeriod = (await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, FORMAT_ANALYSIS_PERIOD_DAYS) as PostObjectForAverage[]);

        if (allPostsLastPeriod.length < FORMAT_MIN_POSTS_FOR_AVG) { // Mínimo de posts totais para análise
            logger.info(`${detectionTAG} Não há posts suficientes (${allPostsLastPeriod.length}) nos últimos ${FORMAT_ANALYSIS_PERIOD_DAYS} dias para análise de formato.`);
            return null;
        }
        
        logger.debug(`${detectionTAG} ${allPostsLastPeriod.length} posts encontrados para análise de formato esquecido.`);

        const formatPerformance: {
            [key: string]: { totalMetricValue: number, count: number, avgMetric: number, lastUsed: Date, postsInFormat: PostObjectForAverage[] } 
        } = {};

        for (const post of allPostsLastPeriod) {
            const currentFormat = post.format; 
            if (!currentFormat) { 
                logger.warn(`${detectionTAG} Post ${post._id} sem 'format' (classificação) definido, pulando na análise de formato.`);
                continue;
            }
            if (!formatPerformance[currentFormat]) { 
                formatPerformance[currentFormat] = { totalMetricValue: 0, count: 0, avgMetric: 0, lastUsed: new Date(0), postsInFormat: [] };
            }
            const perf = formatPerformance[currentFormat]!;
            // Acessa a métrica de performance. FORMAT_PERFORMANCE_METRIC_KEY é keyof PostObjectForAverage
            const metricValue = (post as any)[FORMAT_PERFORMANCE_METRIC_KEY] ?? (post.stats as any)?.[FORMAT_PERFORMANCE_METRIC_KEY];


            if (typeof metricValue === 'number' && !isNaN(metricValue)) {
                perf.totalMetricValue += metricValue;
                perf.count++;
                perf.postsInFormat.push(post); 
            }
            const postCreatedAt = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            if (postCreatedAt > perf.lastUsed) {
                perf.lastUsed = postCreatedAt;
            }
        }

        let bestForgottenFormatInfo: { format: string, avgMetric: number, daysSinceLastUsed: number } | null = null;

        for (const formatKey in formatPerformance) {
            const perfData = formatPerformance[formatKey]!;
            if (perfData.count < FORMAT_MIN_POSTS_FOR_AVG) continue; // Mínimo de posts para considerar o formato

            perfData.avgMetric = perfData.count > 0 ? perfData.totalMetricValue / perfData.count : 0;
            const daysSinceLastUsed = differenceInDays(today, perfData.lastUsed);

            if (daysSinceLastUsed > FORMAT_UNUSED_THRESHOLD_DAYS) {
                if (!bestForgottenFormatInfo || perfData.avgMetric > bestForgottenFormatInfo.avgMetric) {
                    bestForgottenFormatInfo = { format: formatKey, avgMetric: perfData.avgMetric, daysSinceLastUsed };
                }
            }
        }

        if (bestForgottenFormatInfo) {
            logger.debug(`${detectionTAG} Melhor formato (classificação) esquecido: ${bestForgottenFormatInfo.format} (Média ${String(FORMAT_PERFORMANCE_METRIC_KEY)}: ${bestForgottenFormatInfo.avgMetric.toFixed(1)}, Não usado há ${bestForgottenFormatInfo.daysSinceLastUsed} dias).`);
            
            const overallAvgPerformance = calculateAverageMetric(allPostsLastPeriod, FORMAT_PERFORMANCE_METRIC_KEY as keyof PostObjectForAverage); // Cast para keyof
            
            logger.debug(`${detectionTAG} Média geral de ${String(FORMAT_PERFORMANCE_METRIC_KEY)}: ${overallAvgPerformance.toFixed(1)}.`);

            if (bestForgottenFormatInfo.avgMetric > (overallAvgPerformance * FORMAT_PROMISSING_THRESHOLD_MULTIPLIER) && bestForgottenFormatInfo.avgMetric > 0) {
                const percentageSuperior = overallAvgPerformance > 0 ? ((bestForgottenFormatInfo.avgMetric / overallAvgPerformance - 1) * 100) : (bestForgottenFormatInfo.avgMetric > 0 ? 100 : 0);

                const detailsForLog: IForgottenFormatDetails = { 
                    format: bestForgottenFormatInfo.format,
                    avgMetricValue: bestForgottenFormatInfo.avgMetric,
                    overallAvgPerformance: overallAvgPerformance,
                    metricUsed: FORMAT_PERFORMANCE_METRIC_KEY as string, // <-- CORRIGIDO AQUI
                    daysSinceLastUsed: bestForgottenFormatInfo.daysSinceLastUsed,
                    percentageSuperior: percentageSuperior
                };
                const detectedEvent: DetectedEvent = {
                    type: alertType,
                    messageForAI: `Radar Tuca de olho! 👀 Percebi que faz uns ${bestForgottenFormatInfo.daysSinceLastUsed} dias que você não usa o formato **${bestForgottenFormatInfo.format}**. No passado, posts nesse formato tiveram um desempenho (${String(FORMAT_PERFORMANCE_METRIC_KEY)}) em média ${percentageSuperior.toFixed(0)}% superior à sua média geral (${bestForgottenFormatInfo.avgMetric.toFixed(1)} vs ${overallAvgPerformance.toFixed(1)} ${String(FORMAT_PERFORMANCE_METRIC_KEY)}). Que tal revisitar esse formato?`,
                    detailsForLog: detailsForLog
                };
                logger.info(`${detectionTAG} '${alertType}' DETECTADO. ${JSON.stringify(detectedEvent.detailsForLog)}`);
                return detectedEvent;
            } else {
                logger.debug(`${detectionTAG} Formato (classificação) esquecido ${bestForgottenFormatInfo.format} (avg ${String(FORMAT_PERFORMANCE_METRIC_KEY)}: ${bestForgottenFormatInfo.avgMetric.toFixed(1)}) não atingiu o limiar "promissor" (${(overallAvgPerformance * FORMAT_PROMISSING_THRESHOLD_MULTIPLIER).toFixed(1)}) em relação à média geral (${overallAvgPerformance.toFixed(1)}).`);
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
    const alertType = 'untapped_potential_topic';
    const detectionTAG = `${SERVICE_TAG}[${alertType}] User ${userId}:`;

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }
    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}' (Lógica Refinada).`);

    try {
        const allPostsInLookback = (await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, UNTAPPED_POTENTIAL_PAST_LOOKBACK_DAYS) as PostObjectForAverage[]);

        if (allPostsInLookback.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY * 2) { 
            logger.info(`${detectionTAG} Posts insuficientes (${allPostsInLookback.length}) para análise completa de tópico potencial não explorado.`);
            return null;
        }

        const recentPosts: PostObjectForAverage[] = [];
        const olderPostsAnalysisPool: PostObjectForAverage[] = [];

        for (const post of allPostsInLookback) {
            const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            if (differenceInDays(today, postDate) <= UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS) {
                recentPosts.push(post);
            } else {
                olderPostsAnalysisPool.push(post);
            }
        }

        if (olderPostsAnalysisPool.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY) { // Mínimo para o pool de análise
            logger.info(`${detectionTAG} Nenhum post "antigo" (mais de ${UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS} dias) suficiente (${olderPostsAnalysisPool.length}) encontrado.`);
            return null;
        }
        if (recentPosts.length < UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY ) { // Mínimo para o pool de referência
            logger.info(`${detectionTAG} Nenhum post "recente" (últimos ${UNTAPPED_POTENTIAL_RECENT_THRESHOLD_DAYS} dias) suficiente (${recentPosts.length}) encontrado para comparação.`);
            return null;
        }
        
        logger.debug(`${detectionTAG} Posts antigos para análise: ${olderPostsAnalysisPool.length}, Posts recentes para referência: ${recentPosts.length}`);

        olderPostsAnalysisPool.sort((a, b) => 
            (((b as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (b.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number) -
            (((a as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (a.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number)
        );
        
        const percentileIndexFloat = olderPostsAnalysisPool.length * (1 - UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD); // Ex: 0.25 for top 25%
        const percentileIndex = Math.min(Math.max(0, Math.floor(percentileIndexFloat)), olderPostsAnalysisPool.length - 1);
        
        const performanceThresholdValue = (olderPostsAnalysisPool[percentileIndex] as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (olderPostsAnalysisPool[percentileIndex]?.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0;

        const highPerformingOldPosts = olderPostsAnalysisPool.filter(
            post => (((post as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (post.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number) >= performanceThresholdValue &&
                    (((post as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (post.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number) > 0
        );

        if (highPerformingOldPosts.length === 0) {
            logger.info(`${detectionTAG} Nenhum post antigo de alto desempenho encontrado no top ${((1-UNTAPPED_POTENTIAL_TOP_PERCENTILE_THRESHOLD)*100).toFixed(0)}% (limiar de performance: ${performanceThresholdValue}).`);
            return null;
        }
        
        logger.debug(`${detectionTAG} ${highPerformingOldPosts.length} posts antigos de alto desempenho candidatos (limiar: ${performanceThresholdValue}).`);

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

            let referenceAveragePerformance = 0;
            const recentPostsSameFormat = recentPosts.filter(p => normalizeString(p.format) === oldFormat);

            if (recentPostsSameFormat.length >= UNTAPPED_POTENTIAL_MIN_POSTS_FOR_CATEGORY) {
                referenceAveragePerformance = calculateAverageMetric(recentPostsSameFormat, UNTAPPED_POTENTIAL_PERFORMANCE_METRIC as keyof PostObjectForAverage);
                logger.debug(`${detectionTAG} Média de referência para formato '${oldFormat}': ${referenceAveragePerformance.toFixed(1)}`);
            } else { // Usa média geral dos posts recentes se não houver posts suficientes do mesmo formato
                referenceAveragePerformance = calculateAverageMetric(recentPosts, UNTAPPED_POTENTIAL_PERFORMANCE_METRIC as keyof PostObjectForAverage); 
                logger.debug(`${detectionTAG} Média de referência geral (sem posts recentes suficientes do formato '${oldFormat}', usando ${recentPosts.length} posts recentes): ${referenceAveragePerformance.toFixed(1)}`);
            }

            const oldPostPerformance = ((oldPost as any)[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? (oldPost.stats as any)?.[UNTAPPED_POTENTIAL_PERFORMANCE_METRIC] ?? 0) as number;

            if (oldPostPerformance > referenceAveragePerformance * UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER && oldPostPerformance > 0) {
                const performanceValue = oldPostPerformance;
                const postDescriptionForAI = oldPost.description ? `"${oldPost.description.substring(0, 70)}..."` : "um post anterior";
                const daysSincePosted = differenceInDays(today, oldPost.createdAt instanceof Date ? oldPost.createdAt : parseISO(oldPost.createdAt as string));
                
                const detailsForLog: IUntappedPotentialTopicDetails = {
                    postId: oldPost._id, 
                    postDescriptionExcerpt: oldPost.description ? oldPost.description.substring(0,70) : undefined,
                    performanceMetric: String(UNTAPPED_POTENTIAL_PERFORMANCE_METRIC), // Cast para string
                    performanceValue: performanceValue, 
                    referenceAverage: referenceAveragePerformance,
                    daysSincePosted: daysSincePosted,
                    postType: oldPost.type, 
                    format: oldPost.format, 
                    proposal: oldPost.proposal,
                    context: oldPost.context,
                };

                const detectedEvent: DetectedEvent = {
                    type: alertType,
                    messageForAI: `Radar Tuca detectou: Lembra do seu post ${postDescriptionForAI} (classificado como ${oldPost.format || 'N/D'})? Ele teve um ótimo desempenho (${performanceValue.toFixed(0)} ${String(UNTAPPED_POTENTIAL_PERFORMANCE_METRIC)}) há cerca de ${daysSincePosted} dias, superando a média recente de posts similares (${referenceAveragePerformance.toFixed(1)})! Parece que o tema/formato (Proposta: ${oldPost.proposal || 'N/D'} / Contexto: ${oldPost.context || 'N/D'}) ressoou bem e não foi revisitado. Que tal explorar essa ideia novamente?`,
                    detailsForLog: detailsForLog 
                };
                logger.info(`${detectionTAG} '${alertType}' DETECTADO. ${JSON.stringify(detailsForLog)}`);
                return detectedEvent; 
            } else {
                 logger.debug(`${detectionTAG} Post antigo ${oldPost._id} (Perf:${oldPostPerformance.toFixed(1)}) não foi significativamente superior à média de referência (${referenceAveragePerformance.toFixed(1)} * ${UNTAPPED_POTENTIAL_SUPERIORITY_MULTIPLIER}).`);
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
    const alertType = 'engagement_peak_not_capitalized';
    const detectionTAG = `${SERVICE_TAG}[${alertType}] User ${userId}:`;

    if (dialogueState?.lastRadarAlertType === alertType || wasAlertTypeSentRecently(userAlertHistory, alertType, ALERT_HISTORY_LOOKBACK_DAYS, today)) {
        logger.info(`${detectionTAG} Pulando detecção, '${alertType}' enviado recentemente.`);
        return null;
    }
    logger.info(`${detectionTAG} Iniciando tentativa de detectar '${alertType}'.`);

    try {
        const postsToCheck = (await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS) as PostObjectForAverage[])
            .filter(post => {
                const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
                const ageInDays = differenceInDays(today, postDate);
                return ageInDays >= ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS && ageInDays <= ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS;
            })
            .sort((a,b) => (b.totalComments ?? 0) - (a.totalComments ?? 0)); // Usa totalComments

        if (postsToCheck.length === 0) {
            logger.info(`${detectionTAG} Nenhum post encontrado no intervalo de idade [${ENGAGEMENT_PEAK_POST_AGE_MIN_DAYS}-${ENGAGEMENT_PEAK_POST_AGE_MAX_DAYS}] dias.`);
            return null;
        }
        
        logger.debug(`${detectionTAG} ${postsToCheck.length} posts encontrados para análise de pico de comentários.`);

        const historicalPosts = (await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, 60) as PostObjectForAverage[]); // Lookback para média
        // Usa 'totalComments' que já é populado em PostObject por getRecentPostObjectsWithAggregatedMetrics
        const averageComments = calculateAverageMetric(historicalPosts, 'totalComments'); 

        for (const post of postsToCheck) {
            const postComments = post.totalComments ?? 0; // Usa totalComments

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
