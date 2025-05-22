/**
 * @fileoverview Funções auxiliares internas para o dataService.
 * @version 2.14.5 (Implementa getCombinedGrowthData com dados reais, corrige erro de tipo)
 */
import { Types } from 'mongoose';
import { differenceInDays, subDays, startOfMonth, endOfMonth, format } from 'date-fns'; // Adicionado subDays, startOfMonth, endOfMonth, format

// Importar tipos de reportHelpers e logger do seu projeto.
// Ajuste os caminhos se necessário.
import { AggregatedReport } from '@/app/lib/reportHelpers';
import { logger } from '@/app/lib/logger';
import { DatabaseError, MetricsNotFoundError } from '@/app/lib/errors'; // Adicionado DatabaseError, MetricsNotFoundError

// Modelos Mongoose (ajuste os caminhos conforme a estrutura do seu projeto)
import AccountInsightModel, { IAccountInsight } from '@/app/models/AccountInsight'; // Adicionado
import MetricModel, { IMetric } from '@/app/models/Metric'; // Adicionado

// Importar tipos e constantes locais da pasta dataService.
// Ajuste os caminhos de importação para types e constants conforme sua estrutura
// IUser, IGrowthDataResult (e os novos HistoricalGrowth, LongTermGrowth) vêm de './types'
// NEW_USER_THRESHOLD_DAYS e as novas constantes de crescimento vêm de './constants'
import { IUser, IGrowthDataResult, HistoricalGrowth, LongTermGrowth } from './types';
import {
    NEW_USER_THRESHOLD_DAYS,
    GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS, // Adicionado
    GROWTH_ANALYSIS_PERIOD_LONG_TERM_MONTHS // Adicionado
} from './constants';

/**
 * Determina o segmento de perfil do usuário (Novo Usuário ou Usuário Veterano).
 * @param user - O objeto do usuário.
 * @returns {string} O segmento de perfil do usuário.
 */
export function getUserProfileSegment(user: IUser): string {
    const TAG = '[dataService][helpers][getUserProfileSegment]';
    // Verifica se createdAt é uma data válida
    if (user.createdAt && user.createdAt instanceof Date && !isNaN(user.createdAt.getTime())) {
        const ageInDays = differenceInDays(new Date(), user.createdAt);
        return ageInDays < NEW_USER_THRESHOLD_DAYS ? 'Novo Usuário' : 'Usuário Veterano';
    }
    logger.warn(`${TAG} Data de criação inválida ou ausente para usuário ${user._id}. Retornando 'Geral'.`);
    return 'Geral'; // Retorno padrão caso a data seja inválida
}

/**
 * Gera uma sugestão de multimídia com base na retenção de vídeos do relatório agregado.
 * @param report - O relatório agregado opcional.
 * @returns {string} Uma string com a sugestão de multimídia, ou string vazia se não houver dados.
 */
export function getMultimediaSuggestion(report?: AggregatedReport | null): string {
    const TAG = '[dataService][helpers][getMultimediaSuggestion]';

    if (!report || !report.durationStats || report.durationStats.length === 0) {
        logger.debug(`${TAG} Sem durationStats no relatório para gerar sugestão.`);
        return ''; // Retorna string vazia se não houver dados de duração
    }

    // Ordena para encontrar a faixa de duração com melhor taxa de retenção média
    const bestDurationStat = [...report.durationStats].sort((a, b) => (b.avgRetentionRate ?? 0) - (a.avgRetentionRate ?? 0))[0];

    if (!bestDurationStat || typeof bestDurationStat.avgRetentionRate !== 'number') {
        logger.debug(`${TAG} Nenhuma estatística de duração válida encontrada ou sem avgRetentionRate.`);
        return '';
    }

    const retentionPercent = (bestDurationStat.avgRetentionRate * 100).toFixed(0);

    if (bestDurationStat.range.includes('60s')) { // Exemplo: "30s-60s", "60s+"
        return `Vídeos acima de 60 segundos (ou na faixa que inclui 60s+) têm mostrado boa retenção média para si (${retentionPercent}%). Vale a pena experimentar formatos um pouco mais longos!`;
    }

    return `Vídeos na faixa de ${bestDurationStat.range} tiveram um ótimo desempenho recente (${retentionPercent}% retenção média). Teste produzir mais conteúdos nessa duração!`;
}

/**
 * Busca e calcula dados de crescimento combinados (histórico e longo prazo) para um usuário.
 * Substitui a implementação placeholder anterior.
 * @param userId - O ID do usuário.
 * @param userCreatedAt - A data de criação da conta do usuário, para contextualizar o crescimento.
 * @returns {Promise<IGrowthDataResult>} Uma promessa que resolve com os dados de crescimento.
 */
export async function getCombinedGrowthData(
    userId: Types.ObjectId,
    userCreatedAt: Date | undefined // Adicionado para contextualizar o crescimento
): Promise<IGrowthDataResult> {
    const TAG = '[dataService][helpers][getCombinedGrowthData v1.0.1]'; // Versão da lógica interna da função
    logger.info(`${TAG} Iniciando busca de dados de crescimento REAIS para usuário ${userId}.`);

    const growthData: IGrowthDataResult = {
        historical: {},
        longTerm: {},
        dataIsPlaceholder: false,
        reasonForPlaceholder: undefined,
    };
    const now = new Date();

    try {
        // --- Dados Históricos (Curto Prazo) ---
        const shortTermDays = GROWTH_ANALYSIS_PERIOD_SHORT_TERM_DAYS;
        const shortTermStartDate = subDays(now, shortTermDays);
        // Garantir que não buscamos dados antes da criação do usuário
        const effectiveShortTermStart = userCreatedAt && shortTermStartDate < userCreatedAt ? userCreatedAt : shortTermStartDate;

        // 1. Variação de Seguidores (Curto Prazo)
        const shortTermInsights = await AccountInsightModel.find({
            user: userId,
            recordedAt: { $gte: effectiveShortTermStart, $lte: now },
        }).sort({ recordedAt: 'asc' }).select('recordedAt followersCount').lean();

        if (shortTermInsights.length >= 2) {
            // CORRIGIDO: Mover a atribuição para dentro do bloco if
            const firstInsight = shortTermInsights[0]!; // Usar '!' pois já verificamos o length
            const lastInsight = shortTermInsights[shortTermInsights.length - 1]!; // Usar '!'

            if (typeof firstInsight.followersCount === 'number' && typeof lastInsight.followersCount === 'number') {
                growthData.historical.followerChangeShortTerm = lastInsight.followersCount - firstInsight.followersCount;
                if (firstInsight.followersCount > 0) {
                    growthData.historical.followerGrowthRateShortTerm =
                        ((lastInsight.followersCount - firstInsight.followersCount) / firstInsight.followersCount) * 100;
                } else if (lastInsight.followersCount > 0) { // Começou de 0 e cresceu
                    growthData.historical.followerGrowthRateShortTerm = 100; // Ou Infinity, dependendo da preferência
                } else { // Começou de 0 e continua 0, ou erro
                    growthData.historical.followerGrowthRateShortTerm = 0;
                }
                logger.debug(`${TAG} User ${userId}: Variação de seguidores (curto prazo): ${growthData.historical.followerChangeShortTerm}, Taxa: ${growthData.historical.followerGrowthRateShortTerm?.toFixed(2)}%`);
            }
        } else {
            logger.info(`${TAG} User ${userId}: Dados de AccountInsight insuficientes para variação de seguidores de curto prazo (encontrado ${shortTermInsights.length}, necessário >= 2).`);
        }

        // 2. Média de Engajamento/Alcance de Posts Recentes (Curto Prazo)
        const recentMetrics = await MetricModel.find({
            user: userId,
            postDate: { $gte: effectiveShortTermStart, $lte: now },
        }).select('stats.engagement stats.reach').lean();

        if (recentMetrics.length > 0) {
            let totalEngagement = 0, totalReach = 0, engagementCount = 0, reachCount = 0;
            recentMetrics.forEach(metric => {
                if (typeof metric.stats?.engagement === 'number') {
                    totalEngagement += metric.stats.engagement; engagementCount++;
                }
                if (typeof metric.stats?.reach === 'number') {
                    totalReach += metric.stats.reach; reachCount++;
                }
            });
            if (engagementCount > 0) {
                growthData.historical.avgEngagementPerPostShortTerm = totalEngagement / engagementCount;
                logger.debug(`${TAG} User ${userId}: Média de engajamento/post (curto prazo): ${growthData.historical.avgEngagementPerPostShortTerm?.toFixed(2)}`);
            }
            if (reachCount > 0) {
                growthData.historical.avgReachPerPostShortTerm = totalReach / reachCount;
                logger.debug(`${TAG} User ${userId}: Média de alcance/post (curto prazo): ${growthData.historical.avgReachPerPostShortTerm?.toFixed(2)}`);
            }
        } else {
            logger.info(`${TAG} User ${userId}: Sem posts no período de curto prazo para calcular médias de engajamento/alcance.`);
        }

        // --- Dados de Longo Prazo (Mensalmente) ---
        const longTermMonthsCount = GROWTH_ANALYSIS_PERIOD_LONG_TERM_MONTHS;
        const longTermMonthsOffsets = Array.from({ length: longTermMonthsCount }, (_, i) => i).reverse(); // [5, 4, ..., 0] for 6 months

        const monthlyFollowerCounts: { month: string; followers: number }[] = [];
        const monthlyAvgReach: { month: string; avgReach: number }[] = [];
        const monthlyAvgEngagement: { month: string; avgEngagement: number }[] = [];

        for (const monthOffset of longTermMonthsOffsets) {
            const targetMonthIteration = subDays(now, monthOffset * 30); 
            let targetMonthStart = startOfMonth(targetMonthIteration);
            let targetMonthEnd = endOfMonth(targetMonthIteration);

            if (userCreatedAt && targetMonthEnd < userCreatedAt) {
                continue; 
            }
            const effectiveMonthStartLoop = userCreatedAt && targetMonthStart < userCreatedAt ? userCreatedAt : targetMonthStart;
            const monthKey = format(targetMonthStart, 'yyyy-MM');

            const insightAtEndOfMonth = await AccountInsightModel.findOne({
                user: userId,
                recordedAt: { $gte: effectiveMonthStartLoop, $lte: targetMonthEnd },
            }).sort({ recordedAt: -1 }).select('followersCount').lean();

            if (insightAtEndOfMonth && typeof insightAtEndOfMonth.followersCount === 'number') {
                monthlyFollowerCounts.push({ month: monthKey, followers: insightAtEndOfMonth.followersCount });
            }

            const metricsInMonth = await MetricModel.find({
                user: userId,
                postDate: { $gte: effectiveMonthStartLoop, $lte: targetMonthEnd },
            }).select('stats.reach stats.engagement').lean();

            if (metricsInMonth.length > 0) {
                let totalReachInMonth = 0, reachCountInMonth = 0;
                let totalEngagementInMonth = 0, engagementCountInMonth = 0;
                metricsInMonth.forEach(m => {
                    if (typeof m.stats?.reach === 'number') {
                        totalReachInMonth += m.stats.reach; reachCountInMonth++;
                    }
                    if (typeof m.stats?.engagement === 'number') {
                        totalEngagementInMonth += m.stats.engagement; engagementCountInMonth++;
                    }
                });
                if (reachCountInMonth > 0) {
                    monthlyAvgReach.push({ month: monthKey, avgReach: totalReachInMonth / reachCountInMonth });
                }
                if (engagementCountInMonth > 0) {
                    monthlyAvgEngagement.push({ month: monthKey, avgEngagement: totalEngagementInMonth / engagementCountInMonth });
                }
            }
        }

        if (monthlyFollowerCounts.length > 0) {
            growthData.longTerm.monthlyFollowerTrend = monthlyFollowerCounts.sort((a,b) => a.month.localeCompare(b.month)); 
            logger.debug(`${TAG} User ${userId}: Tendência mensal de seguidores (longo prazo) calculada para ${monthlyFollowerCounts.length} meses.`);
        } else {
            logger.info(`${TAG} User ${userId}: Sem dados suficientes para tendência mensal de seguidores (longo prazo).`);
        }

        if (monthlyAvgReach.length > 0) {
            growthData.longTerm.monthlyReachTrend = monthlyAvgReach.sort((a,b) => a.month.localeCompare(b.month)); 
            logger.debug(`${TAG} User ${userId}: Tendência mensal de alcance (longo prazo) calculada para ${monthlyAvgReach.length} meses.`);
        } else {
            logger.info(`${TAG} User ${userId}: Sem dados suficientes para tendência mensal de alcance (longo prazo).`);
        }
        
        if (monthlyAvgEngagement.length > 0) {
            growthData.longTerm.monthlyEngagementTrend = monthlyAvgEngagement.sort((a,b) => a.month.localeCompare(b.month)); 
            logger.debug(`${TAG} User ${userId}: Tendência mensal de engajamento (longo prazo) calculada para ${monthlyAvgEngagement.length} meses.`);
        } else {
            logger.info(`${TAG} User ${userId}: Sem dados suficientes para tendência mensal de engajamento (longo prazo).`);
        }

    } catch (error: any) {
        logger.error(`${TAG} Erro CRÍTICO ao buscar dados de crescimento para ${userId}:`, error);
        growthData.dataIsPlaceholder = true;
        growthData.reasonForPlaceholder = error instanceof Error ? error.message : "Erro desconhecido ao buscar dados de crescimento.";
        if (error instanceof DatabaseError || error instanceof MetricsNotFoundError) {
            throw error;
        }
        throw new DatabaseError(`Erro ao calcular dados de crescimento para ${userId}`, error);
    }
    
    if (!growthData.dataIsPlaceholder && Object.keys(growthData.historical).length === 0 && Object.keys(growthData.longTerm).length === 0) {
        logger.warn(`${TAG} User ${userId}: Nenhum dado de crescimento (histórico ou longo prazo) pôde ser determinado, apesar de não haver erro crítico. Retornando como placeholder.`);
        growthData.dataIsPlaceholder = true;
        growthData.reasonForPlaceholder = "Não foi possível calcular dados de crescimento histórico ou de longo prazo.";
    } else if (!growthData.dataIsPlaceholder) {
         logger.info(`${TAG} Dados de crescimento REAIS processados para ${userId}. Histórico: ${Object.keys(growthData.historical).length > 0}, Longo Prazo: ${Object.keys(growthData.longTerm).length > 0}`);
    }

    return growthData;
}
