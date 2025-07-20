// src/app/lib/ruleEngine/rules/followerGrowthStagnationRule.ts
// MODIFICADO: Adicionado log de versão para depuração.
// MODIFICADO: Adicionada função getValidDate para consistência, embora a regra use principalmente recordedAt (Date).

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IAccountInsight } from '@/app/models/AccountInsight'; 
import { IFollowerStagnationDetails } from '@/app/models/User'; // Importa a interface para os detalhes
import { logger } from '@/app/lib/logger';
import { parseISO, subWeeks, differenceInCalendarWeeks, startOfWeek, isValid as isValidDate } from 'date-fns'; // Adicionado isValidDate
import * as dataService from '@/app/lib/dataService'; 
// PostObjectForAverage e calculateAverageMetric não são usados diretamente aqui, mas getValidDate é genérico
// import { PostObjectForAverage, calculateAverageMetric } from '@/app/lib/utils'; 
import {
    // Constantes específicas da regra já estão definidas abaixo
} from '@/app/lib/constants';


const RULE_ID = 'follower_growth_stagnation_v1';
const RULE_TAG_BASE = `[Rule:${RULE_ID}]`;

// Constantes específicas da regra
const STAGNATION_LOOKBACK_WEEKS = 8; 
const STAGNATION_COMPARISON_PERIOD_WEEKS = 4; 
const STAGNATION_SIGNIFICANT_DROP_THRESHOLD = 0.75; 
const STAGNATION_MIN_FOLLOWERS_FOR_ANALYSIS = 100; 
const STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE = 5; 

interface GrowthRateData {
    periodName: string;
    startFollowers: number;
    endFollowers: number;
    growth: number;
    growthRate: number; 
    weeks: number;
}

// Função auxiliar para obter um objeto Date válido (adicionada para consistência, embora menos usada aqui)
function getValidDate(dateInput: Date | string | undefined, itemId?: string, tag?: string): Date | null {
    const logTag = tag || RULE_TAG_BASE;
    if (!dateInput) {
        if (itemId) logger.warn(`${logTag} Item ${itemId} não tem data definida.`);
        return null;
    }
    if (dateInput instanceof Date) {
        if (isValidDate(dateInput)) return dateInput;
        if (itemId) logger.warn(`${logTag} Item ${itemId} tem objeto Date inválido: ${dateInput}`);
        return null;
    }
    if (typeof dateInput === 'string') {
        try {
            const parsedDate = parseISO(dateInput);
            if (isValidDate(parsedDate)) return parsedDate;
            if (itemId) logger.warn(`${logTag} Item ${itemId} tem string de data inválida para parseISO: ${dateInput}`);
            return null;
        } catch (e) {
            if (itemId) logger.warn(`${logTag} Item ${itemId} erro ao parsear string de data: ${dateInput}`, e);
            return null;
        }
    }
    if (itemId) logger.warn(`${logTag} Item ${itemId} tem data em formato inesperado: ${typeof dateInput}`);
    return null;
}


export const followerGrowthStagnationRule: IRule = {
    id: RULE_ID,
    name: 'Estagnação no Crescimento de Seguidores',
    description: 'Alerta se o crescimento de seguidores do usuário desacelerou significativamente ou estagnou nas últimas semanas em comparação com períodos anteriores.',
    priority: 8,
    lookbackDays: STAGNATION_LOOKBACK_WEEKS * 7, 
    dataRequirements: ['accountInsights'], 
    resendCooldownDays: 30,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, today } = context; 
        // LOG DE VERSÃO ADICIONADO
        const currentRuleVersion = "followerGrowthStagnationRule_v_CANVAS_LOG_25_05_22_30"; // String de versão única
        const detectionTAG = `${RULE_TAG_BASE} (${currentRuleVersion})[condition] User ${user._id}:`;
        logger.info(`${detectionTAG} INICIANDO EXECUÇÃO DA REGRA`);
        logger.debug(`${detectionTAG} Avaliando condição...`);

        if (!user.instagramAccountId) {
            logger.debug(`${detectionTAG} Usuário sem instagramAccountId. Pulando regra.`);
            return { isMet: false };
        }

        const accountInsightHistory = await dataService.getAccountInsightHistory(user._id.toString(), STAGNATION_LOOKBACK_WEEKS * 7 + 7); 
        
        if (accountInsightHistory.length < STAGNATION_COMPARISON_PERIOD_WEEKS) { 
            logger.debug(`${detectionTAG} Histórico de insights da conta insuficiente (${accountInsightHistory.length} registros) para análise de estagnação (necessário ~${STAGNATION_COMPARISON_PERIOD_WEEKS} por período).`);
            return { isMet: false };
        }

        accountInsightHistory.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
        
        const latestFollowersData = accountInsightHistory[accountInsightHistory.length -1];
        const latestFollowers = latestFollowersData?.followersCount ?? latestFollowersData?.accountDetails?.followers_count;


        if (typeof latestFollowers !== 'number' || latestFollowers < STAGNATION_MIN_FOLLOWERS_FOR_ANALYSIS) {
            logger.debug(`${detectionTAG} Número de seguidores atual (${latestFollowers}) abaixo do mínimo (${STAGNATION_MIN_FOLLOWERS_FOR_ANALYSIS}) para análise de estagnação.`);
            return { isMet: false };
        }

        const weeklyInsights: IAccountInsight[] = [];
        let currentIterationWeekStart = startOfWeek(subWeeks(today, STAGNATION_LOOKBACK_WEEKS -1), { weekStartsOn: 1 }); 

        for (let i = 0; i < STAGNATION_LOOKBACK_WEEKS; i++) {
            const weekEndBoundary = startOfWeek(subWeeks(today, STAGNATION_LOOKBACK_WEEKS -1 -i -1), { weekStartsOn: 1 });
            const insightsThisIterationWeek = accountInsightHistory.filter(insight => {
                const insightDate = getValidDate(insight.recordedAt, insight._id?.toString(), detectionTAG); // Usa getValidDate
                return insightDate && insightDate >= currentIterationWeekStart && insightDate < weekEndBoundary;
            });

            if (insightsThisIterationWeek.length > 0) {
                weeklyInsights.push(insightsThisIterationWeek[insightsThisIterationWeek.length - 1]!);
            }
            currentIterationWeekStart = weekEndBoundary;
        }
        
        if (weeklyInsights.length < STAGNATION_COMPARISON_PERIOD_WEEKS * 2 -1 && weeklyInsights.length < 2) { // Precisa de pelo menos 2 pontos para os dois períodos
             logger.debug(`${detectionTAG} Dados semanais insuficientes (${weeklyInsights.length}) para comparar ${STAGNATION_COMPARISON_PERIOD_WEEKS} semanas com as ${STAGNATION_COMPARISON_PERIOD_WEEKS} anteriores.`);
             return { isMet: false };
        }

        const calculateGrowth = (insightsPeriod: IAccountInsight[], periodName: string): GrowthRateData | null => {
            if (insightsPeriod.length < 2) return null; 

            const firstInsight = insightsPeriod[0]!;
            const lastInsight = insightsPeriod[insightsPeriod.length - 1]!;

            const startFollowers = firstInsight.followersCount ?? firstInsight.accountDetails?.followers_count ?? 0;
            const endFollowers = lastInsight.followersCount ?? lastInsight.accountDetails?.followers_count ?? 0;
            
            if (typeof startFollowers !== 'number' || typeof endFollowers !== 'number') return null;

            const growth = endFollowers - startFollowers;
            const growthRate = startFollowers > 0 ? (growth / startFollowers) * 100 : (growth > 0 ? Infinity : 0);
            
            const firstDate = getValidDate(firstInsight.recordedAt, firstInsight._id?.toString(), detectionTAG);
            const lastDate = getValidDate(lastInsight.recordedAt, lastInsight._id?.toString(), detectionTAG);
            if (!firstDate || !lastDate) return null; // Datas inválidas
            
            const weeksInPeriod = differenceInCalendarWeeks(lastDate, firstDate, { weekStartsOn: 1 }) +1;

            return { periodName, startFollowers, endFollowers, growth, growthRate, weeks: weeksInPeriod };
        };

        const recentPeriodInsights = weeklyInsights.slice(-STAGNATION_COMPARISON_PERIOD_WEEKS);
        const previousPeriodInsights = weeklyInsights.slice(-(STAGNATION_COMPARISON_PERIOD_WEEKS * 2), -STAGNATION_COMPARISON_PERIOD_WEEKS);

        const recentGrowthData = calculateGrowth(recentPeriodInsights, `Últimas ${STAGNATION_COMPARISON_PERIOD_WEEKS} semanas`);
        const previousGrowthData = calculateGrowth(previousPeriodInsights, `${STAGNATION_COMPARISON_PERIOD_WEEKS} semanas anteriores`);

        if (!recentGrowthData || !previousGrowthData) {
            logger.debug(`${detectionTAG} Não foi possível calcular dados de crescimento para um ou ambos os períodos.`);
            return { isMet: false };
        }
        
        logger.info(`${detectionTAG} Crescimento Recente: ${recentGrowthData.growth} seguidores (${recentGrowthData.growthRate.toFixed(1)}%). Anterior: ${previousGrowthData.growth} seguidores (${previousGrowthData.growthRate.toFixed(1)}%).`);

        const previousPeriodHadSignificantGrowth = previousGrowthData.growth >= STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE * previousGrowthData.weeks;

        let isStagnated = false;
        if (previousPeriodHadSignificantGrowth) {
            if (previousGrowthData.growth > 0 && recentGrowthData.growth < previousGrowthData.growth * STAGNATION_SIGNIFICANT_DROP_THRESHOLD) {
                isStagnated = true; 
            } else if (previousGrowthData.growth > 0 && recentGrowthData.growth <= STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE) { 
                isStagnated = true;
            }
        } else if (previousGrowthData.growth <= STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE && recentGrowthData.growth < 0 && Math.abs(recentGrowthData.growth) > STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE) {
            // Se antes não crescia muito ou caía pouco, e agora está caindo de forma mais notável
            isStagnated = true;
        }

        if (isStagnated) {
            logger.debug(`${detectionTAG} Condição ATENDIDA.`);
            return {
                isMet: true,
                data: {
                    currentGrowth: recentGrowthData.growth,
                    previousGrowth: previousGrowthData.growth,
                    currentGrowthRate: recentGrowthData.growthRate,
                    previousGrowthRate: previousGrowthData.growthRate,
                    periodAnalyzed: `últimas ${STAGNATION_COMPARISON_PERIOD_WEEKS} semanas vs. as ${STAGNATION_COMPARISON_PERIOD_WEEKS} semanas anteriores`
                }
            };
        }

        logger.debug(`${detectionTAG} Condição NÃO atendida.`);
        return { isMet: false };
    },

    action: async (context: RuleContext, conditionData?: any): Promise<DetectedEvent | null> => {
        const { user, allUserPosts } = context;
        const actionTAG = `${RULE_TAG_BASE}[action] User ${user._id}:`;
        if (!conditionData || typeof conditionData.currentGrowthRate !== 'number' || typeof conditionData.previousGrowthRate !== 'number') {
            logger.error(`${actionTAG} conditionData inválido ou incompleto.`);
            return null;
        }

        const { currentGrowthRate, previousGrowthRate, periodAnalyzed, currentGrowth, previousGrowth } = conditionData;
        
        logger.info(`${actionTAG} Gerando evento.`);

        const lastPost = allUserPosts
            .sort((a,b) => new Date(b.postDate as any).getTime() - new Date(a.postDate as any).getTime())[0];

        const details: IFollowerStagnationDetails = {
            currentGrowthRate: parseFloat(currentGrowthRate.toFixed(2)),
            previousGrowthRate: parseFloat(previousGrowthRate.toFixed(2)),
            currentGrowthAbs: currentGrowth,
            previousGrowthAbs: previousGrowth,
            periodAnalyzed,
            mostRecentFormat: lastPost?.format,
            mostRecentProposal: lastPost?.proposal,
            mostRecentContext: lastPost?.context
        };

        const messageForAI = `Radar Tuca observou: Notei que seu crescimento de seguidores deu uma desacelerada nas ${periodAnalyzed.replace('vs. as ', 'em comparação com as ')} (crescimento de ${currentGrowthRate.toFixed(1)}% vs ${previousGrowthRate.toFixed(1)}% anteriormente). Gostaria de analisar algumas estratégias para reaquecer o crescimento ou entender melhor essa tendência?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details 
        };
    }
};
