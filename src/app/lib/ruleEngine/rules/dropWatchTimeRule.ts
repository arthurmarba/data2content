// src/app/lib/ruleEngine/rules/dropWatchTimeRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types'; // Ajuste o caminho se necessário
// ATUALIZADO: Caminho corrigido para IDailyMetricSnapshot
import { IDropWatchTimeDetails } from '@/app/models/User'; 
import { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot'; // <--- CAMINHO CORRIGIDO
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays } from 'date-fns';
import {
    REELS_WATCH_TIME_LOOKBACK_DAYS,
    REELS_WATCH_TIME_MIN_FOR_ANALYSIS,
    REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS,
    REELS_WATCH_TIME_MAX_HISTORICAL_FOR_AVG,
    REELS_WATCH_TIME_DROP_THRESHOLD_PERCENTAGE,
    REELS_WATCH_TIME_MIN_HISTORICAL_FOR_ALERT
} from '@/app/lib/constants';
import { PostObjectForAverage } from '@/app/lib/utils';

const RULE_ID = 'unexpected_drop_reels_watch_time_v1';

export const dropWatchTimeRule: IRule = {
    id: RULE_ID,
    name: 'Queda no Tempo de Visualização de Reels',
    description: 'Detecta se o tempo médio de visualização dos Reels mais recentes caiu significativamente em comparação com a média histórica de Reels do usuário.',
    priority: 9,
    lookbackDays: REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS, // e.g., 90 dias
    dataRequirements: ['snapshots'],
    resendCooldownDays: 14,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today, getSnapshotsForPost } = context;
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        const recentReels = allUserPosts.filter(post => {
            const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            const postAgeDays = differenceInDays(today, postDate);
            return post.type === 'REEL' && postAgeDays <= REELS_WATCH_TIME_LOOKBACK_DAYS;
        }).sort((a, b) => { // Mais recentes primeiro
            const dateA = a.createdAt instanceof Date ? a.createdAt : parseISO(a.createdAt as string);
            const dateB = b.createdAt instanceof Date ? b.createdAt : parseISO(b.createdAt as string);
            return dateB.getTime() - dateA.getTime();
        });

        if (recentReels.length < REELS_WATCH_TIME_MIN_FOR_ANALYSIS) {
            logger.debug(`${detectionTAG} Não há Reels recentes suficientes (${recentReels.length}) para análise (mínimo: ${REELS_WATCH_TIME_MIN_FOR_ANALYSIS}).`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${recentReels.length} Reels recentes encontrados para análise de tempo de visualização.`);

        let sumCurrentAvgWatchTime = 0;
        let countReelsWithWatchTime = 0;
        const latestReelsForAvg = recentReels.slice(0, 3); // Pega os 3 mais recentes para a média atual

        for (const reel of latestReelsForAvg) {
            const snapshots: IDailyMetricSnapshot[] = await getSnapshotsForPost(reel._id);
            if (snapshots && snapshots.length > 0) {
                // Pega o snapshot mais recente com currentReelsAvgWatchTime
                const latestSnapshotWithWatchTime = snapshots
                    .filter(s => typeof s.currentReelsAvgWatchTime === 'number')
                    .sort((a, b) => (b.dayNumber || 0) - (a.dayNumber || 0))[0];

                if (latestSnapshotWithWatchTime && typeof latestSnapshotWithWatchTime.currentReelsAvgWatchTime === 'number') {
                    sumCurrentAvgWatchTime += latestSnapshotWithWatchTime.currentReelsAvgWatchTime;
                    countReelsWithWatchTime++;
                }
            }
        }

        if (countReelsWithWatchTime === 0) {
            logger.debug(`${detectionTAG} Não foi possível calcular o tempo médio de visualização atual (sem dados válidos nos snapshots dos Reels recentes).`);
            return { isMet: false };
        }
        const currentAverageReelsWatchTime = sumCurrentAvgWatchTime / countReelsWithWatchTime;
        logger.debug(`${detectionTAG} Tempo médio de visualização atual dos Reels: ${currentAverageReelsWatchTime.toFixed(1)}s`);

        // Filtra Reels históricos
        const historicalReels = allUserPosts.filter(post => {
            if (post.type !== 'REEL') return false;
            // Exclui os reels já usados para a média atual
            if (latestReelsForAvg.some(lr => lr._id === post._id)) return false;

            const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            const lastRecentReelDate = latestReelsForAvg[latestReelsForAvg.length - 1]?.createdAt;
            if (!lastRecentReelDate) return false; // Segurança
            const dateLastRecent = lastRecentReelDate instanceof Date ? lastRecentReelDate : parseISO(lastRecentReelDate as string);
            // Garante que o post histórico seja mais antigo que o mais antigo dos "recentes"
            return postDate < dateLastRecent && differenceInDays(today, postDate) <= REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS;
        }).sort((a, b) => { // Mais recentes primeiro
            const dateA = a.createdAt instanceof Date ? a.createdAt : parseISO(a.createdAt as string);
            const dateB = b.createdAt instanceof Date ? b.createdAt : parseISO(b.createdAt as string);
            return dateB.getTime() - dateA.getTime();
        }).slice(0, REELS_WATCH_TIME_MAX_HISTORICAL_FOR_AVG); // Limita para a média histórica

        let sumHistoricalAvgWatchTime = 0;
        let countHistoricalReelsWithWatchTime = 0;

        for (const histReel of historicalReels) {
            const histSnapshots: IDailyMetricSnapshot[] = await getSnapshotsForPost(histReel._id);
            if (histSnapshots && histSnapshots.length > 0) {
                const latestHistSnapshotWithWatchTime = histSnapshots
                    .filter(s => typeof s.currentReelsAvgWatchTime === 'number')
                    .sort((a, b) => (b.dayNumber || 0) - (a.dayNumber || 0))[0];

                if (latestHistSnapshotWithWatchTime && typeof latestHistSnapshotWithWatchTime.currentReelsAvgWatchTime === 'number') {
                    sumHistoricalAvgWatchTime += latestHistSnapshotWithWatchTime.currentReelsAvgWatchTime;
                    countHistoricalReelsWithWatchTime++;
                }
            }
        }

        let historicalAverageReelsWatchTime: number;
        if (countHistoricalReelsWithWatchTime > 0) {
            historicalAverageReelsWatchTime = sumHistoricalAvgWatchTime / countHistoricalReelsWithWatchTime;
        } else {
            // Fallback se não houver dados históricos suficientes
            historicalAverageReelsWatchTime = currentAverageReelsWatchTime > 5 ? currentAverageReelsWatchTime * 1.5 : 15;
            logger.debug(`${detectionTAG} Usando fallback para média histórica: ${historicalAverageReelsWatchTime.toFixed(1)}s`);
        }
        logger.debug(`${detectionTAG} Tempo médio de visualização histórico dos Reels: ${historicalAverageReelsWatchTime.toFixed(1)}s (contou ${countHistoricalReelsWithWatchTime} reels históricos)`);

        // Condição Principal
        if (historicalAverageReelsWatchTime >= REELS_WATCH_TIME_MIN_HISTORICAL_FOR_ALERT &&
            currentAverageReelsWatchTime < historicalAverageReelsWatchTime * (1 - REELS_WATCH_TIME_DROP_THRESHOLD_PERCENTAGE)) { // Ex: se threshold é 0.25, então < média * 0.75
            logger.debug(`${detectionTAG} Condição ATENDIDA.`);
            return {
                isMet: true,
                data: {
                    currentAverageReelsWatchTime,
                    historicalAverageReelsWatchTime,
                    reelsAnalyzedIds: latestReelsForAvg.map(r => r._id)
                }
            };
        }
        logger.debug(`${detectionTAG} Condição NÃO atendida (Atual: ${currentAverageReelsWatchTime.toFixed(1)}, Hist: ${historicalAverageReelsWatchTime.toFixed(1)}, Limiar Mín Hist: ${REELS_WATCH_TIME_MIN_HISTORICAL_FOR_ALERT}, % Queda: ${REELS_WATCH_TIME_DROP_THRESHOLD_PERCENTAGE})`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        if (!conditionData || typeof conditionData.currentAverageReelsWatchTime !== 'number' || typeof conditionData.historicalAverageReelsWatchTime !== 'number' || !Array.isArray(conditionData.reelsAnalyzedIds)) {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }

        const currentAverageReelsWatchTime = conditionData.currentAverageReelsWatchTime as number;
        const historicalAverageReelsWatchTime = conditionData.historicalAverageReelsWatchTime as number;
        const reelsAnalyzedIds = conditionData.reelsAnalyzedIds as string[];

        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento.`);

        const details: IDropWatchTimeDetails = {
            currentAvg: currentAverageReelsWatchTime, // Mantém como número
            historicalAvg: historicalAverageReelsWatchTime, // Mantém como número
            reelsAnalyzedIds
        };

        const messageForAI = `Radar Tuca detectou: O tempo médio de visualização dos seus Reels mais recentes está em torno de ${currentAverageReelsWatchTime.toFixed(0)}s. Isso é um pouco abaixo da sua média histórica de ${historicalAverageReelsWatchTime.toFixed(0)}s. Pode ser um sinal para revisitar as introduções ou o ritmo desses Reels.`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
