// src/app/lib/ruleEngine/rules/dropWatchTimeRule.ts
// MODIFICADO: Adicionado log de versão para depuração.
// MODIFICADO: Atualizado para usar post.postDate e tratamento seguro de datas.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types'; 
import { IDropWatchTimeDetails } from '@/app/models/User'; 
import { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot'; 
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, isValid as isValidDate } from 'date-fns'; // Adicionado isValidDate
import {
    REELS_WATCH_TIME_LOOKBACK_DAYS,
    REELS_WATCH_TIME_MIN_FOR_ANALYSIS,
    REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS,
    REELS_WATCH_TIME_MAX_HISTORICAL_FOR_AVG,
    REELS_WATCH_TIME_DROP_THRESHOLD_PERCENTAGE,
    REELS_WATCH_TIME_MIN_HISTORICAL_FOR_ALERT
} from '@/app/lib/constants';
import { PostObjectForAverage } from '@/app/lib/utils'; // PostObjectForAverage já usa postDate

const RULE_ID = 'unexpected_drop_reels_watch_time_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

// Função auxiliar para obter um objeto Date válido a partir de um campo Date | string
function getValidDate(dateInput: Date | string | undefined, postId?: string, tag?: string): Date | null {
    const logTag = tag || RULE_TAG_BASE;
    if (!dateInput) {
        if (postId) logger.warn(`${logTag} Post ${postId} não tem data definida.`);
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

export const dropWatchTimeRule: IRule = {
    id: RULE_ID,
    name: 'Queda no Tempo de Visualização de Reels',
    description: 'Detecta se o tempo médio de visualização dos Reels mais recentes caiu significativamente em comparação com a média histórica de Reels do usuário.',
    priority: 9,
    lookbackDays: REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS, 
    dataRequirements: ['snapshots'],
    resendCooldownDays: 14,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today, getSnapshotsForPost } = context;
        // LOG DE VERSÃO ADICIONADO
        const currentRuleVersion = "dropWatchTimeRule_v_CANVAS_LOG_25_05_22_00"; // String de versão única
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição...`);

        const recentReels = allUserPosts
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) })) // MODIFICADO: Usa post.postDate
            .filter(item => {
                if (!item.postDateObj) return false;
                const postAgeDays = differenceInDays(today, item.postDateObj);
                return item.post.type === 'REEL' && postAgeDays <= REELS_WATCH_TIME_LOOKBACK_DAYS;
            })
            .sort((a, b) => b.postDateObj!.getTime() - a.postDateObj!.getTime()) // Mais recentes primeiro
            .map(item => item.post);

        if (recentReels.length < REELS_WATCH_TIME_MIN_FOR_ANALYSIS) {
            logger.debug(`${detectionTAG} Não há Reels recentes suficientes (${recentReels.length}) para análise (mínimo: ${REELS_WATCH_TIME_MIN_FOR_ANALYSIS}).`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${recentReels.length} Reels recentes encontrados para análise de tempo de visualização.`);

        let sumCurrentAvgWatchTime = 0;
        let countReelsWithWatchTime = 0;
        const latestReelsForAvg = recentReels.slice(0, 3); 

        for (const reel of latestReelsForAvg) {
            const snapshots: IDailyMetricSnapshot[] = await getSnapshotsForPost(reel._id);
            if (snapshots && snapshots.length > 0) {
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

        const historicalReels = allUserPosts
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) })) // MODIFICADO: Usa post.postDate
            .filter(item => {
                if (!item.postDateObj || item.post.type !== 'REEL') return false;
                if (latestReelsForAvg.some(lr => lr._id === item.post._id)) return false;

                const lastRecentReel = latestReelsForAvg[latestReelsForAvg.length - 1];
                const lastRecentReelDateObj = lastRecentReel ? getValidDate(lastRecentReel.postDate, lastRecentReel._id, detectionTAG) : null;
                if (!lastRecentReelDateObj) return false; 
                
                return item.postDateObj < lastRecentReelDateObj && differenceInDays(today, item.postDateObj) <= REELS_WATCH_TIME_HISTORICAL_LOOKBACK_DAYS;
            })
            .sort((a, b) => b.postDateObj!.getTime() - a.postDateObj!.getTime()) 
            .slice(0, REELS_WATCH_TIME_MAX_HISTORICAL_FOR_AVG)
            .map(item => item.post);

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
            historicalAverageReelsWatchTime = currentAverageReelsWatchTime > 5 ? currentAverageReelsWatchTime * 1.5 : 15;
            logger.debug(`${detectionTAG} Usando fallback para média histórica: ${historicalAverageReelsWatchTime.toFixed(1)}s`);
        }
        logger.debug(`${detectionTAG} Tempo médio de visualização histórico dos Reels: ${historicalAverageReelsWatchTime.toFixed(1)}s (contou ${countHistoricalReelsWithWatchTime} reels históricos)`);

        if (historicalAverageReelsWatchTime >= REELS_WATCH_TIME_MIN_HISTORICAL_FOR_ALERT &&
            currentAverageReelsWatchTime < historicalAverageReelsWatchTime * (1 - REELS_WATCH_TIME_DROP_THRESHOLD_PERCENTAGE)) { 
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
        const { user, allUserPosts } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
        if (!conditionData || typeof conditionData.currentAverageReelsWatchTime !== 'number' || typeof conditionData.historicalAverageReelsWatchTime !== 'number' || !Array.isArray(conditionData.reelsAnalyzedIds)) {
            logger.error(`${actionTAG} conditionData inválido ou incompleto.`);
            return null;
        }

        const currentAverageReelsWatchTime = conditionData.currentAverageReelsWatchTime as number;
        const historicalAverageReelsWatchTime = conditionData.historicalAverageReelsWatchTime as number;
        const reelsAnalyzedIds = conditionData.reelsAnalyzedIds as string[];

        logger.info(`${actionTAG} Gerando evento.`);

        let lastReel = allUserPosts
            .filter(p => p.type === 'REEL')
            .sort((a,b) => new Date(b.postDate as any).getTime() - new Date(a.postDate as any).getTime())[0];

        const details: IDropWatchTimeDetails = {
            currentAvg: currentAverageReelsWatchTime,
            historicalAvg: historicalAverageReelsWatchTime,
            reelsAnalyzedIds,
            format: 'Reel',
            proposal: lastReel?.proposal,
            context: lastReel?.context
        };

        const messageForAI = `Radar Mobi detectou: O tempo médio de visualização dos seus Reels mais recentes está em torno de ${currentAverageReelsWatchTime.toFixed(0)}s. Isso é um pouco abaixo da sua média histórica de ${historicalAverageReelsWatchTime.toFixed(0)}s. Pode ser um sinal para revisitar as introduções ou o ritmo desses Reels.`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details
        };
    }
};
