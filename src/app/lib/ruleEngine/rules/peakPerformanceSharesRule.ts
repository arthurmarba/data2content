// src/app/lib/ruleEngine/rules/peakPerformanceSharesRule.ts
// MODIFICADO: v1.2 - Adicionado postLink na messageForAI para corrigir links quebrados.
// MODIFICADO: v1.1 - Adicionado platformPostId aos details do evento.
// MODIFICADO: Adicionado log de versão para depuração.
// MODIFICADO: Atualizado para usar post.postDate em vez de post.createdAt e adicionar tratamento seguro de datas.

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IPeakSharesDetails } from '@/app/models/User'; 
import { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays, isValid as isValidDate } from 'date-fns'; 
import {
    SHARES_MIN_POST_AGE_DAYS_FOR_PICO,
    SHARES_MAX_POST_AGE_DAYS_FOR_PICO,
    SHARES_COMPARISON_LOOKBACK_DAYS,
    SHARES_MAX_POSTS_FOR_AVG,
    SHARES_PICO_THRESHOLD_MULTIPLIER,
    SHARES_MIN_ABSOLUTE_FOR_PICO
} from '@/app/lib/constants'; 
import { PostObjectForAverage } from '@/app/lib/utils'; 

const RULE_ID = 'peak_performance_shares_v1'; 
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


export const peakPerformanceSharesRule: IRule = {
    id: RULE_ID,
    name: 'Pico de Desempenho em Compartilhamentos',
    description: 'Detecta posts recentes com um pico significativo de compartilhamentos.',
    priority: 10, 
    lookbackDays: Math.max(SHARES_MAX_POST_AGE_DAYS_FOR_PICO + 5, SHARES_COMPARISON_LOOKBACK_DAYS), 
    dataRequirements: ['snapshots'], 
    resendCooldownDays: 7, 

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today, getSnapshotsForPost } = context;
        const currentRuleVersion = "peakPerformanceSharesRule_v1.2"; 
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição...`);

        const postsToCheckPico = allUserPosts
            .map(post => ({ post, postDateObj: getValidDate(post.postDate, post._id, detectionTAG) })) 
            .filter(item => {
                if (!item.postDateObj) return false;
                const postAgeDays = differenceInDays(today, item.postDateObj);
                // Garante que post.type existe antes de chamar includes
                return item.post.type && ['IMAGE', 'CAROUSEL', 'VIDEO', 'REELS'].includes(item.post.type) && 
                       postAgeDays >= SHARES_MIN_POST_AGE_DAYS_FOR_PICO && 
                       postAgeDays <= SHARES_MAX_POST_AGE_DAYS_FOR_PICO;
            })
            .sort((a, b) => { 
                // Garante que postDateObj existe antes de chamar getTime
                if (a.postDateObj && b.postDateObj) {
                    return b.postDateObj.getTime() - a.postDateObj.getTime();
                }
                return 0; // Mantém a ordem se alguma data for nula
            })
            .map(item => item.post); 

        if (postsToCheckPico.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post no intervalo de idade para verificação de pico.`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${postsToCheckPico.length} posts encontrados para análise de pico de shares.`);

        for (const post of postsToCheckPico) {
            const postId = post._id;
            const mainPostDateObj = getValidDate(post.postDate, postId, detectionTAG);
            if(!mainPostDateObj) {
                logger.warn(`${detectionTAG} Post principal ${postId} com data inválida após filtro inicial. Pulando.`);
                continue;
            }

            const snapshots: IDailyMetricSnapshot[] = await getSnapshotsForPost(postId);
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

            let totalSharesForAvg = 0;
            let countSnapshotsForAvg = 0;
            
            const comparisonPosts = allUserPosts
                .map(p => ({ post: p, postDateObj: getValidDate(p.postDate, p._id, detectionTAG) })) 
                .filter(item => {
                    if (!item.postDateObj || item.post._id === postId) return false; 
                    // Garante que mainPostDateObj existe antes de comparar
                    return mainPostDateObj && item.postDateObj < mainPostDateObj && differenceInDays(today, item.postDateObj) <= SHARES_COMPARISON_LOOKBACK_DAYS;
                })
                .slice(0, SHARES_MAX_POSTS_FOR_AVG)
                .map(item => item.post); 

            logger.debug(`${detectionTAG} Encontrados ${comparisonPosts.length} posts para calcular a média de referência para o post ${postId}.`);

            for (const compPost of comparisonPosts) {
                const compSnaps = await getSnapshotsForPost(compPost._id);
                compSnaps.sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0));
                for (let dayNum = 1; dayNum <= 3; dayNum++) {
                    const s = compSnaps.find(snap => snap.dayNumber === dayNum);
                    if (s && typeof s.dailyShares === 'number') {
                        totalSharesForAvg += s.dailyShares;
                        countSnapshotsForAvg++;
                    }
                }
            }
            const averageSharesFirst3Days = countSnapshotsForAvg > 0 ? totalSharesForAvg / countSnapshotsForAvg : 0;
            logger.debug(`${detectionTAG} Post ${postId}: Pico Shares = ${peakSharesValue}, Média Referência Shares (primeiros 3 dias) = ${averageSharesFirst3Days.toFixed(1)}`);
            
            if (peakSharesValue >= SHARES_MIN_ABSOLUTE_FOR_PICO && peakSharesValue > averageSharesFirst3Days * SHARES_PICO_THRESHOLD_MULTIPLIER) {
                logger.debug(`${detectionTAG} Condição ATENDIDA para post ${postId}.`);
                return {
                    isMet: true,
                    data: {
                        post: post as PostObjectForAverage,
                        peakSharesValue,
                        peakSharesDay,
                        averageSharesFirst3Days
                    }
                };
            } else {
                logger.debug(`${detectionTAG} Condição NÃO atendida para post ${postId} (Pico: ${peakSharesValue}, Média: ${averageSharesFirst3Days.toFixed(1)}, Limiar Multiplicador: ${SHARES_PICO_THRESHOLD_MULTIPLIER}, Mín Absoluto: ${SHARES_MIN_ABSOLUTE_FOR_PICO}).`);
            }
        }
        logger.debug(`${detectionTAG} Nenhuma condição atendida após verificar todos os posts elegíveis.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`; 
        if (!conditionData || !conditionData.post || typeof conditionData.peakSharesValue !== 'number' || typeof conditionData.peakSharesDay !== 'number' || typeof conditionData.averageSharesFirst3Days !== 'number') {
            logger.error(`${actionTAG} conditionData inválido ou incompleto.`);
            return null;
        }

        const post = conditionData.post as PostObjectForAverage;
        const peakSharesValue = conditionData.peakSharesValue as number;
        const peakSharesDay = conditionData.peakSharesDay as number;
        const averageSharesFirst3Days = conditionData.averageSharesFirst3Days as number;

        logger.info(`${actionTAG} Gerando evento para post ${post._id}. InstagramMediaId: ${post.instagramMediaId}`);
        
        const postDescriptionExcerptText = post.description ? post.description.substring(0, 50) : undefined;
        const postDescriptionForAI = post.description ? `"${post.description.substring(0, 50)}..."` : "recente";
        
        const details: IPeakSharesDetails = {
            postId: post._id,
            platformPostId: post.instagramMediaId,
            postDescriptionExcerpt: postDescriptionExcerptText,
            peakShares: peakSharesValue,
            peakDay: peakSharesDay,
            averageSharesFirst3Days: averageSharesFirst3Days, 
            format: post.format,
            proposal: post.proposal,
            context: post.context,
        };

        // --- CORREÇÃO AQUI ---
        // Incluído o 'post.postLink' para garantir que a IA tenha o link correto para incluir na mensagem final.
        const messageForAI = `Radar Mobi detectou: Seu post ${postDescriptionForAI} (${post.postLink}) teve um pico de ${peakSharesValue} compartilhamentos no Dia ${peakSharesDay}, significativamente acima da sua média habitual (${averageSharesFirst3Days.toFixed(1)} shares nos primeiros dias). Isso é um ótimo sinal de que o conteúdo ressoou fortemente!`;

        return {
            type: RULE_ID, 
            messageForAI,
            detailsForLog: details
        };
    }
};
