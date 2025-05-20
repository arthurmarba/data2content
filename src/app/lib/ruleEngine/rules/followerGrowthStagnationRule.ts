// src/app/lib/ruleEngine/rules/followerGrowthStagnationRule.ts

import { IRule, RuleContext, RuleConditionResult } from '../types';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types'; // Ajuste o caminho se necessário
// ATUALIZADO: Caminho corrigido para IAccountInsight
import { IAccountInsight } from '@/app/models/AccountInsight'; // <--- CAMINHO CORRIGIDO
import { logger } from '@/app/lib/logger';
import { subWeeks, differenceInCalendarWeeks, startOfWeek } from 'date-fns';
import * as dataService from '@/app/lib/dataService'; // Para chamar getAccountInsightHistory

const RULE_ID = 'follower_growth_stagnation_v1';

// Constantes específicas da regra (podem ser movidas para constants.ts se usadas em outros lugares)
const STAGNATION_LOOKBACK_WEEKS = 8; // Analisar as últimas 8 semanas
const STAGNATION_COMPARISON_PERIOD_WEEKS = 4; // Comparar períodos de 4 semanas
const STAGNATION_SIGNIFICANT_DROP_THRESHOLD = 0.75; // Crescimento atual < 75% do crescimento anterior (ou seja, queda de >25%)
const STAGNATION_MIN_FOLLOWERS_FOR_ANALYSIS = 100; // Mínimo de seguidores para a regra ser relevante
const STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE = 5; // Mínimo de crescimento no período anterior para considerar uma queda "significativa"

interface GrowthRateData {
    periodName: string;
    startFollowers: number;
    endFollowers: number;
    growth: number;
    growthRate: number; // Percentual
    weeks: number;
}

export const followerGrowthStagnationRule: IRule = {
    id: RULE_ID,
    name: 'Estagnação no Crescimento de Seguidores',
    description: 'Alerta se o crescimento de seguidores do usuário desacelerou significativamente ou estagnou nas últimas semanas em comparação com períodos anteriores.',
    priority: 8,
    lookbackDays: STAGNATION_LOOKBACK_WEEKS * 7, // Convertido para dias
    dataRequirements: ['accountInsights'], // Indica que pode precisar de dados de insights da conta
    resendCooldownDays: 30,

    condition: async (context: RuleContext): Promise<RuleConditionResult> => {
        const { user, today } = context; // latestAccountInsights não é usado diretamente, vamos buscar o histórico
        const detectionTAG = `[Rule:${RULE_ID}][condition] User ${user._id}:`;
        logger.debug(`${detectionTAG} Avaliando condição...`);

        if (!user.instagramAccountId) {
            logger.debug(`${detectionTAG} Usuário sem instagramAccountId. Pulando regra.`);
            return { isMet: false };
        }

        // Busca o histórico de insights da conta usando a nova função do dataService
        const accountInsightHistory = await dataService.getAccountInsightHistory(user._id.toString(), STAGNATION_LOOKBACK_WEEKS * 7 + 7); // +7 para garantir que temos o início da primeira semana
        
        if (accountInsightHistory.length < STAGNATION_COMPARISON_PERIOD_WEEKS) { // Precisa de pelo menos alguns pontos de dados por período
            logger.debug(`${detectionTAG} Histórico de insights da conta insuficiente (${accountInsightHistory.length} registros) para análise de estagnação (necessário ~${STAGNATION_COMPARISON_PERIOD_WEEKS} por período).`);
            return { isMet: false };
        }

        // Garante que os insights estão ordenados por data
        accountInsightHistory.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
        
        const latestFollowers = accountInsightHistory[accountInsightHistory.length -1]?.followersCount ??
                                accountInsightHistory[accountInsightHistory.length -1]?.accountDetails?.followers_count;

        if (typeof latestFollowers !== 'number' || latestFollowers < STAGNATION_MIN_FOLLOWERS_FOR_ANALYSIS) {
            logger.debug(`${detectionTAG} Número de seguidores atual (${latestFollowers}) abaixo do mínimo (${STAGNATION_MIN_FOLLOWERS_FOR_ANALYSIS}) para análise de estagnação.`);
            return { isMet: false };
        }


        // Agrupar insights por semana e pegar o último da semana (ou o mais próximo do fim da semana)
        const weeklyInsights: IAccountInsight[] = [];
        let currentWeekStart = startOfWeek(subWeeks(today, STAGNATION_LOOKBACK_WEEKS -1), { weekStartsOn: 1 }); // -1 porque queremos N semanas completas

        for (let i = 0; i < STAGNATION_LOOKBACK_WEEKS; i++) {
            const weekEnd = startOfWeek(subWeeks(today, STAGNATION_LOOKBACK_WEEKS -1 -i -1), { weekStartsOn: 1 });
            const insightsThisWeek = accountInsightHistory.filter(insight => {
                const insightDate = new Date(insight.recordedAt);
                return insightDate >= currentWeekStart && insightDate < weekEnd;
            });

            if (insightsThisWeek.length > 0) {
                // Pega o último insight da semana (o mais próximo do fim da semana)
                weeklyInsights.push(insightsThisWeek[insightsThisWeek.length - 1]!);
            }
            currentWeekStart = weekEnd;
        }
        
        if (weeklyInsights.length < STAGNATION_COMPARISON_PERIOD_WEEKS * 2 -1) { // Precisa de dados suficientes para os dois períodos
             logger.debug(`${detectionTAG} Dados semanais insuficientes (${weeklyInsights.length}) para comparar ${STAGNATION_COMPARISON_PERIOD_WEEKS} semanas com as ${STAGNATION_COMPARISON_PERIOD_WEEKS} anteriores.`);
             return { isMet: false };
        }


        const calculateGrowth = (insightsPeriod: IAccountInsight[], periodName: string): GrowthRateData | null => {
            if (insightsPeriod.length < 2) return null; // Precisa de pelo menos início e fim

            const firstInsight = insightsPeriod[0]!;
            const lastInsight = insightsPeriod[insightsPeriod.length - 1]!;

            const startFollowers = firstInsight.followersCount ?? firstInsight.accountDetails?.followers_count ?? 0;
            const endFollowers = lastInsight.followersCount ?? lastInsight.accountDetails?.followers_count ?? 0;
            
            if (typeof startFollowers !== 'number' || typeof endFollowers !== 'number') return null;

            const growth = endFollowers - startFollowers;
            const growthRate = startFollowers > 0 ? (growth / startFollowers) * 100 : (growth > 0 ? Infinity : 0);
            const weeksInPeriod = differenceInCalendarWeeks(new Date(lastInsight.recordedAt), new Date(firstInsight.recordedAt), { weekStartsOn: 1 }) +1;


            return { periodName, startFollowers, endFollowers, growth, growthRate, weeks: weeksInPeriod };
        };

        // Período Recente (últimas N semanas)
        const recentPeriodInsights = weeklyInsights.slice(-STAGNATION_COMPARISON_PERIOD_WEEKS);
        // Período Anterior (N semanas antes do período recente)
        const previousPeriodInsights = weeklyInsights.slice(-(STAGNATION_COMPARISON_PERIOD_WEEKS * 2), -STAGNATION_COMPARISON_PERIOD_WEEKS);

        const recentGrowthData = calculateGrowth(recentPeriodInsights, `Últimas ${STAGNATION_COMPARISON_PERIOD_WEEKS} semanas`);
        const previousGrowthData = calculateGrowth(previousPeriodInsights, `${STAGNATION_COMPARISON_PERIOD_WEEKS} semanas anteriores`);

        if (!recentGrowthData || !previousGrowthData) {
            logger.debug(`${detectionTAG} Não foi possível calcular dados de crescimento para um ou ambos os períodos.`);
            return { isMet: false };
        }
        
        logger.info(`${detectionTAG} Crescimento Recente: ${recentGrowthData.growth} seguidores (${recentGrowthData.growthRate.toFixed(1)}%). Anterior: ${previousGrowthData.growth} seguidores (${previousGrowthData.growthRate.toFixed(1)}%).`);

        // Condição Principal:
        // 1. Houve crescimento significativo no período anterior (para evitar alertas sobre "quedas" de crescimento zero para zero)
        // 2. O crescimento atual é significativamente menor que o anterior OU o crescimento atual é negativo/estagnado após um período de crescimento.
        const previousPeriodHadSignificantGrowth = previousGrowthData.growth >= STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE * previousGrowthData.weeks;

        let isStagnated = false;
        if (previousPeriodHadSignificantGrowth) {
            if (previousGrowthData.growth > 0 && recentGrowthData.growth < previousGrowthData.growth * STAGNATION_SIGNIFICANT_DROP_THRESHOLD) {
                isStagnated = true; // Queda significativa em relação ao crescimento anterior
            } else if (previousGrowthData.growth > 0 && recentGrowthData.growth <= STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE) { // Se antes crescia e agora quase não cresce
                isStagnated = true;
            }
        } else if (previousGrowthData.growth <= STAGNATION_MIN_GROWTH_FOR_SIGNIFICANCE && recentGrowthData.growth < 0) {
            // Se antes não crescia muito ou caía pouco, e agora está caindo mais
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
        const { user } = context;
        if (!conditionData || typeof conditionData.currentGrowthRate !== 'number' || typeof conditionData.previousGrowthRate !== 'number') {
            logger.error(`[Rule:${RULE_ID}][action] User ${user._id}: conditionData inválido ou incompleto.`);
            return null;
        }

        const { currentGrowthRate, previousGrowthRate, periodAnalyzed, currentGrowth, previousGrowth } = conditionData;
        const detectionTAG = `[Rule:${RULE_ID}][action] User ${user._id}:`;
        logger.info(`${detectionTAG} Gerando evento.`);

        const details = { // Esta estrutura deve corresponder a IFollowerStagnationDetails em User.ts
            currentGrowthRate: parseFloat(currentGrowthRate.toFixed(2)),
            previousGrowthRate: parseFloat(previousGrowthRate.toFixed(2)),
            currentGrowthAbs: currentGrowth,
            previousGrowthAbs: previousGrowth,
            periodAnalyzed
        };

        const messageForAI = `Radar Tuca observou: Notei que seu crescimento de seguidores deu uma desacelerada nas ${periodAnalyzed.replace('vs. as ', 'em comparação com as ')} (crescimento de ${currentGrowthRate.toFixed(1)}% vs ${previousGrowthRate.toFixed(1)}% anteriormente). Gostaria de analisar algumas estratégias para reaquecer o crescimento ou entender melhor essa tendência?`;

        return {
            type: RULE_ID,
            messageForAI,
            detailsForLog: details 
        };
    }
};
