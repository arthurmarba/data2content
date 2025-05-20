// src/app/lib/ruleEngine/rules/peakPerformanceSharesRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types'; // Ajuste o caminho se necessário
// ATUALIZADO: Caminho corrigido para IDailyMetricSnapshot
import { IPeakSharesDetails } from '@/app/models/User'; 
import { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot'; // <--- CAMINHO CORRIGIDO
import { logger } from '@/app/lib/logger';
import { parseISO, differenceInDays } from 'date-fns';
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

export const peakPerformanceSharesRule: IRule = {
    id: RULE_ID,
    name: 'Pico de Desempenho em Compartilhamentos',
    description: 'Detecta posts recentes com um pico significativo de compartilhamentos.',
    priority: 10, 
    lookbackDays: Math.max(SHARES_MAX_POST_AGE_DAYS_FOR_PICO, SHARES_COMPARISON_LOOKBACK_DAYS),
    dataRequirements: ['snapshots'], 
    resendCooldownDays: 7, 

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, allUserPosts, today, getSnapshotsForPost } = context;
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        const postsToCheckPico = allUserPosts.filter(post => {
            const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
            const postAgeDays = differenceInDays(today, postDate);
            return post.type && ['IMAGE', 'CAROUSEL', 'VIDEO'].includes(post.type) && 
                   postAgeDays >= SHARES_MIN_POST_AGE_DAYS_FOR_PICO && 
                   postAgeDays <= SHARES_MAX_POST_AGE_DAYS_FOR_PICO;
        }).sort((a, b) => { 
            const dateA = a.createdAt instanceof Date ? a.createdAt : parseISO(a.createdAt as string);
            const dateB = b.createdAt instanceof Date ? b.createdAt : parseISO(b.createdAt as string);
            return dateB.getTime() - dateA.getTime();
        });

        if (postsToCheckPico.length === 0) {
            logger.debug(`${detectionTAG} Nenhum post no intervalo de idade para verificação de pico.`);
            return { isMet: false };
        }
        logger.debug(`${detectionTAG} ${postsToCheckPico.length} posts encontrados para análise de pico de shares.`);

        for (const post of postsToCheckPico) {
            const snapshots: IDailyMetricSnapshot[] = await getSnapshotsForPost(post._id);
            if (!snapshots || snapshots.length === 0) {
                logger.debug(`${detectionTAG} Post ${post._id} não possui snapshots.`);
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
                logger.debug(`${detectionTAG} Post ${post._id} não apresentou pico de shares nos dias 2 ou 3 com dados válidos.`);
                continue;
            }
            logger.debug(`${detectionTAG} Post ${post._id} teve um pico de ${peakSharesValue} shares no dia ${peakSharesDay}. Calculando média de referência.`);

            let totalSharesForAvg = 0;
            let countSnapshotsForAvg = 0;
            const comparisonPosts = allUserPosts.filter(p => {
                if (p._id === post._id) return false; 
                const pDate = p.createdAt instanceof Date ? p.createdAt : parseISO(p.createdAt as string);
                const postDate = post.createdAt instanceof Date ? post.createdAt : parseISO(post.createdAt as string);
                return pDate < postDate && differenceInDays(today, pDate) <= SHARES_COMPARISON_LOOKBACK_DAYS;
            }).slice(0, SHARES_MAX_POSTS_FOR_AVG); 

            logger.debug(`${detectionTAG} Encontrados ${comparisonPosts.length} posts para calcular a média de referência para o post ${post._id}.`);

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
            logger.debug(`${detectionTAG} Post ${post._id}: Pico Shares = ${peakSharesValue}, Média Referência Shares (primeiros 3 dias) = ${averageSharesFirst3Days.toFixed(1)}`);
            
            if (peakSharesValue >= SHARES_MIN_ABSOLUTE_FOR_PICO && peakSharesValue > averageSharesFirst3Days * SHARES_PICO_THRESHOLD_MULTIPLIER) {
                logger.debug(`${detectionTAG} Condição ATENDIDA para post ${post._id}.`);
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
                logger.debug(`${detectionTAG} Condição NÃO atendida para post ${post._id} (Pico: ${peakSharesValue}, Média: ${averageSharesFirst3Days.toFixed(1)}, Limiar Multiplicador: ${SHARES_PICO_THRESHOLD_MULTIPLIER}, Mín Absoluto: ${SHARES_MIN_ABSOLUTE_FOR_PICO}).`);
            }
        }
        logger.debug(`${detectionTAG} Nenhuma condição atendida após verificar todos os posts elegíveis.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user } = context;
        if (!conditionData || !conditionData.post || typeof conditionData.peakSharesValue !== 'number' || typeof conditionData.peakSharesDay !== 'number' || typeof conditionData.averageSharesFirst3Days !== 'number') {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }

        const post = conditionData.post as PostObjectForAverage;
        const peakSharesValue = conditionData.peakSharesValue as number;
        const peakSharesDay = conditionData.peakSharesDay as number;
        const averageSharesFirst3Days = conditionData.averageSharesFirst3Days as number;

        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento para post ${post._id}.`);

        const postDescriptionExcerptText = post.description ? post.description.substring(0, 50) : undefined;
        const postDescriptionForAI = post.description ? `"${post.description.substring(0, 50)}..."` : "recente";
        
        const details: IPeakSharesDetails = {
            postId: post._id,
            postDescriptionExcerpt: postDescriptionExcerptText,
            peakShares: peakSharesValue,
            peakDay: peakSharesDay,
            averageSharesFirst3Days: averageSharesFirst3Days, 
            format: post.format,
            proposal: post.proposal,
            context: post.context,
        };

        return {
            type: RULE_ID, 
            messageForAI: `Radar Tuca detectou: Seu post ${postDescriptionForAI} teve um pico de ${peakSharesValue} compartilhamentos no Dia ${peakSharesDay}, significativamente acima da sua média habitual (${averageSharesFirst3Days.toFixed(1)} shares nos primeiros dias). Isso é um ótimo sinal de que o conteúdo ressoou fortemente!`,
            detailsForLog: details
        };
    }
};
