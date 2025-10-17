/**
 * @fileoverview Orquestrador de chamadas à API OpenAI com Function Calling e Streaming.
 * Otimizado para buscar dados sob demanda via funções e modular comportamento por intenção.
 * ATUALIZADO: v1.0.8 - Corrige erro de tipo 'no overlap' ao remover 'if' redundante para generate_proactive_alert dentro do bloco 'else'.
 * ATUALIZADO: v1.0.7 - Adicionado prompt direto e especializado para alertas proativos (generate_proactive_alert), focando em mensagens diretas e sem saudações.
 * ATUALIZADO: v1.0.6 - Corrige erro de tipo 'Property 'dayPCOStats' does not exist on type '{}''.
 * ATUALIZADO: v1.0.5 - Corrige erro de tipo 'Property 'insightSummary' does not exist on type '{}''.
 * ATUALIZADO: v1.0.4 - Corrige erro de tipo 'is possibly undefined' para 'dayPerf.bestDays[0]'.
 * ATUALIZADO: v1.0.3 - Corrige erro de tipo 'is possibly undefined' para 'firstCombo'.
 * ATUALIZADO: v1.0.2 - Corrige erro de tipo 'Object is possibly undefined' ao acessar array 'dayNames'.
 * ATUALIZADO: v1.0.1 - Corrige erro de tipo em 'getFpcTrendHistory' dentro de um loop .map().
 * ATUALIZADO: v1.0.0 - Adiciona verificações de existência para funções executoras para evitar erros de tipo.
 * ATUALIZADO: v0.9.9 - Inclui currentAlertDetails no contexto para a LLM em alertas proativos.
 * ATUALIZADO: v0.9.8 - Omite 'functions' e 'function_call' para intents leves.
 * @version 1.0.8
 */

import OpenAI from 'openai';
import type {
    ChatCompletionMessageParam,
    ChatCompletionChunk,
    ChatCompletionAssistantMessageParam,
    ChatCompletionFunctionCallOption,
    ChatCompletionCreateParamsStreaming
} from 'openai/resources/chat/completions';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { functionSchemas, functionExecutors } from './aiFunctions';
import { getSystemPrompt } from '@/app/lib/promptSystemFC';
import { IUser, AlertDetails } from '@/app/models/User'; // AlertDetails importado
import * as stateService from '@/app/lib/stateService';
import { functionValidators } from './aiFunctionSchemas.zod';
import { DeterminedIntent } from './intentService';
// Importando EnrichedAIContext do local correto
import { EnrichedAIContext } from '@/app/api/whatsapp/process-response/types';
import aggregateUserPerformanceHighlights from '@/utils/aggregateUserPerformanceHighlights';
import aggregateUserDayPerformance from '@/utils/aggregateUserDayPerformance';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';
import { DEFAULT_METRICS_FETCH_DAYS } from '@/app/lib/constants';


// Configuração do cliente OpenAI e constantes
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const QUICK_ACK_MODEL = process.env.OPENAI_QUICK_ACK_MODEL || 'gpt-3.5-turbo';
const TEMP = Number(process.env.OPENAI_TEMP) || 0.7;
const QUICK_ACK_TEMP = Number(process.env.OPENAI_QUICK_ACK_TEMP) || 0.8;
const TOKENS = Number(process.env.OPENAI_MAXTOK) || 1400;
const QUICK_ACK_MAX_TOKENS = Number(process.env.OPENAI_QUICK_ACK_MAX_TOKENS) || 70;
const MAX_ITERS = 6; // Máximo de iterações de chamada de função
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 45_000;
const QUICK_ACK_TIMEOUT_MS = Number(process.env.OPENAI_QUICK_ACK_TIMEOUT_MS) || 10_000;

// Removida a interface EnrichedContext local, usaremos EnrichedAIContext de types.ts

/**
 * Retorno de askLLMWithEnrichedContext.
 */
interface AskLLMResult {
    stream: ReadableStream<string>;
    historyPromise: Promise<ChatCompletionMessageParam[]>;
}

/**
 * Preenche o system prompt com métricas e estatísticas recentes.
 * Exportada para facilitar testes unitários.
 */
const SYSTEM_PROMPT_CACHE_VERSION = 'v2.36';

export async function populateSystemPrompt(
    user: IUser,
    userName: string,
    periodDays: number = DEFAULT_METRICS_FETCH_DAYS,
    forceRefresh: boolean = false
): Promise<string> {
    const fnTag = '[populateSystemPrompt]';
    const cacheKey = `prompt:${SYSTEM_PROMPT_CACHE_VERSION}:${user._id}:${periodDays}`;

    if (!forceRefresh) {
        const cached = await stateService.getFromCache(cacheKey);
        if (cached) {
            logger.debug(`${fnTag} Cache HIT para ${cacheKey}`);
            return cached;
        }
    }

    let systemPrompt = getSystemPrompt(userName || user.name || 'usuário');
    systemPrompt = systemPrompt.replace('{{METRICS_PERIOD_DAYS}}', String(periodDays));

    try {
        // CORREÇÃO: Adicionada verificação para garantir que a função existe antes de chamá-la.
        let reportRes: any = {};
        if (functionExecutors && typeof functionExecutors.getAggregatedReport === 'function') {
            reportRes = await functionExecutors.getAggregatedReport({ analysisPeriod: periodDays }, user);
        } else {
            logger.warn(`${fnTag} Executor function 'getAggregatedReport' not found.`);
        }

        const stats = reportRes?.reportData?.overallStats || {};
        const avgReach = typeof stats.avgReach === 'number' ? Math.round(stats.avgReach) : 'Dados insuficientes';
        const avgShares = typeof stats.avgShares === 'number' ? Math.round(stats.avgShares) : 'Dados insuficientes';
        const avgEngRate = typeof stats.avgEngagementRate === 'number' ? (stats.avgEngagementRate * 100).toFixed(1) : 'Dados insuficientes';

        // Após obter o relatório, iniciamos as demais chamadas em paralelo.
        const userTrendPromise =
            functionExecutors && typeof functionExecutors.getUserTrend === 'function'
                ? functionExecutors.getUserTrend(
                    { trendType: 'reach_engagement', timePeriod: `last_${periodDays}_days`, granularity: 'weekly' },
                    user,
                )
                : Promise.resolve(undefined);

        const historical = reportRes?.reportData?.historicalComparisons || {};
        const followerGrowth = historical?.followerChangeShortTerm;
        const followerGrowthText = typeof followerGrowth === 'number' ? String(followerGrowth) : 'Dados insuficientes';
        const followerGrowthRate = historical?.followerGrowthRateShortTerm;
        const followerGrowthRateText = typeof followerGrowthRate === 'number' ? `${followerGrowthRate.toFixed(1)}%` : 'Dados insuficientes';
        const avgEngPost = historical?.avgEngagementPerPostShortTerm;
        const avgEngPostText = typeof avgEngPost === 'number' ? Math.round(avgEngPost).toString() : 'Dados insuficientes';
        const avgReachPost = historical?.avgReachPerPostShortTerm;
        const avgReachPostText = typeof avgReachPost === 'number' ? Math.round(avgReachPost).toString() : 'Dados insuficientes';

        const deals = reportRes?.adDealInsights || {};
        const dealsCountText = typeof deals.totalDeals === 'number' ? String(deals.totalDeals) : 'Dados insuficientes';
        const dealsRevenueText = typeof deals.totalRevenueBRL === 'number' ? Math.round(deals.totalRevenueBRL).toString() : 'Dados insuficientes';
        const dealsAvgValueText = typeof deals.averageDealValueBRL === 'number' ? Math.round(deals.averageDealValueBRL).toString() : 'Dados insuficientes';
        const brandSegText = Array.isArray(deals.commonBrandSegments) && deals.commonBrandSegments.length ? deals.commonBrandSegments.join(', ') : 'Dados insuficientes';
        const dealsFreqText = typeof deals.dealsFrequency === 'number' ? deals.dealsFrequency.toFixed(1) : 'Dados insuficientes';

        const fpcStats = reportRes?.reportData?.detailedContentStats || [];
        const emergingCombosArr = fpcStats
            .filter((s: any) => typeof s.shareDiffPercentage === 'number' && s.shareDiffPercentage > 0)
            .sort((a: any, b: any) => (b.shareDiffPercentage ?? 0) - (a.shareDiffPercentage ?? 0))
            .slice(0, 3)
            .map((s: any) => `${s._id.format}/${s._id.proposal}/${s._id.context}`);
        const emergingCombos = emergingCombosArr.length > 0 ? emergingCombosArr.join(', ') : 'Dados insuficientes';

        let topTrendText = 'Dados insuficientes';
        try {
            // CORREÇÃO: A função é atribuída a uma constante para que o TypeScript possa rastreá-la dentro do .map().
            if (functionExecutors && typeof functionExecutors.getFpcTrendHistory === 'function') {
                const getHistoryFunc = functionExecutors.getFpcTrendHistory;
                const trendPromises = fpcStats.slice(0, 5).map(async (s: any) => {
                    const history: any = await getHistoryFunc({
                        format: s._id.format,
                        proposal: s._id.proposal,
                        context: s._id.context,
                        timePeriod: 'last_90_days',
                        granularity: 'weekly'
                    }, user);
                    const series = history?.chartData || [];
                    const valid = series.filter((p: any) => typeof p.avgInteractions === 'number');
                    if (valid.length < 2) return null;
                    const first = valid[0].avgInteractions as number;
                    const last = valid[valid.length - 1].avgInteractions as number;
                    if (first === 0) return null;
                    const growth = ((last - first) / first) * 100;
                    return { combo: `${s._id.format}/${s._id.proposal}/${s._id.context}`, growth };
                });
                const trendData = (await Promise.all(trendPromises)).filter(Boolean) as { combo: string; growth: number }[];
                trendData.sort((a, b) => b.growth - a.growth);
                const top = trendData.slice(0, 3).map(d => d.combo);
                if (top.length) topTrendText = top.join(', ');
            } else {
                logger.warn(`${fnTag} Executor function 'getFpcTrendHistory' not found.`);
            }
        } catch (trendErr) {
            logger.error(`${fnTag} Erro ao processar FPC trend history:`, trendErr);
        }

        // Promises para as demais chamadas de métricas
        const dayPCOPromise =
            functionExecutors && typeof functionExecutors.getDayPCOStats === 'function'
                ? functionExecutors.getDayPCOStats({}, user)
                : Promise.resolve(undefined);
        const categoryPromise =
            functionExecutors && typeof functionExecutors.getCategoryRanking === 'function'
                ? functionExecutors.getCategoryRanking(
                    { category: 'format', metric: 'shares', periodDays: periodDays, limit: 3 },
                    user,
                )
                : Promise.resolve(undefined);
        const demoPromise =
            functionExecutors && typeof functionExecutors.getLatestAudienceDemographics === 'function'
                ? functionExecutors.getLatestAudienceDemographics({}, user)
                : Promise.resolve(undefined);
        const metricsPromise =
            functionExecutors && typeof functionExecutors.getMetricsHistory === 'function'
                ? functionExecutors.getMetricsHistory({ days: periodDays }, user)
                : Promise.resolve(undefined);

        const perfHighlightsPromise = aggregateUserPerformanceHighlights(
            user._id,
            periodDays,
            'stats.total_interactions',
        );
        const dayPerfPromise = aggregateUserDayPerformance(
            user._id,
            periodDays,
            'stats.total_interactions',
        );
        const timePerfPromise = aggregateUserTimePerformance(
            user._id,
            periodDays,
            'stats.total_interactions',
        );

        const [
            trendRes,
            dayRes,
            catRes,
            demoRes,
            metricsRes,
            perfHighlightsRes,
            dayPerfRes,
            timePerfRes,
        ] = await Promise.allSettled([
            userTrendPromise,
            dayPCOPromise,
            categoryPromise,
            demoPromise,
            metricsPromise,
            perfHighlightsPromise,
            dayPerfPromise,
            timePerfPromise,
        ]);

        // ==================================================================
        // CORREÇÃO: Bloco 'if' explícito para garantir a segurança de tipo.
        // ==================================================================
        let trendSummary = 'Dados insuficientes';
        if (trendRes.status === 'fulfilled' && trendRes.value) {
            // O TypeScript agora sabe que trendRes.value é do tipo correto
            // e permite o acesso seguro à propriedade 'insightSummary'.
            // A coerção de tipo (as) ajuda a ser explícito sobre a estrutura esperada.
            trendSummary = (trendRes.value as { insightSummary?: string }).insightSummary ?? 'Dados insuficientes';
        } else if (trendRes.status === 'rejected') {
            logger.error(`${fnTag} Erro ao obter UserTrend:`, trendRes.reason);
        }
        // ==================================================================

        let hotTimeText = 'Dados insuficientes';
        let topDayCombosText = 'Dados insuficientes';
        if (dayRes.status === 'fulfilled' && dayRes.value) {
            try {
                // CORREÇÃO: Adicionada asserção de tipo para 'dayRes.value'.
                const data = (dayRes.value as { dayPCOStats?: any }).dayPCOStats || {};
                const combos: { d: number; p: string; c: string; avg: number }[] = [];
                for (const [day, propObj] of Object.entries(data)) {
                    for (const [prop, ctxObj] of Object.entries(propObj as any)) {
                        for (const [ctx, val] of Object.entries(ctxObj as any)) {
                            const avg = (val as any).avgTotalInteractions ?? 0;
                            combos.push({ d: Number(day), p: prop, c: ctx, avg });
                        }
                    }
                }
                combos.sort((a, b) => b.avg - a.avg);
                if (combos.length > 0) {
                    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                    const firstCombo = combos[0];
                    if (firstCombo) {
                        const firstDayName = dayNames[firstCombo.d];
                        if (firstDayName) {
                            hotTimeText = `${firstDayName} • ${firstCombo.p} • ${firstCombo.c}`;
                        }
                    }
                    topDayCombosText = combos
                        .slice(0, 3)
                        .map(c => {
                            const dayName = dayNames[c.d];
                            return dayName ? `${dayName} • ${c.p} • ${c.c}` : null;
                        })
                        .filter((text): text is string => text !== null)
                        .join(', ');
                }
            } catch (e) {
                logger.error(`${fnTag} Erro ao processar DayPCOStats:`, e);
            }
        } else if (dayRes.status === 'rejected') {
            logger.error(`${fnTag} Erro ao processar DayPCOStats:`, dayRes.reason);
        }

        let catText = 'Dados insuficientes';
        if (catRes.status === 'fulfilled' && catRes.value) {
            try {
                if (Array.isArray((catRes.value as { ranking?: any[] }).ranking) && (catRes.value as { ranking: any[] }).ranking.length) {
                    catText = (catRes.value as { ranking: { category: string }[] }).ranking.map((r: any) => r.category).slice(0, 3).join(', ');
                }
            } catch (e) {
                logger.error(`${fnTag} Erro ao obter ranking de categorias:`, e);
            }
        } else if (catRes.status === 'rejected') {
            logger.error(`${fnTag} Erro ao obter ranking de categorias:`, catRes.reason);
        }

        let demoText = 'Dados insuficientes';
        if (demoRes.status === 'fulfilled' && demoRes.value) {
            try {
                const demo = (demoRes.value as { demographics?: any }).demographics?.follower_demographics;
                if (demo) {
                    const topCountry = Object.entries(demo.country || {}).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0];
                    const topAge = Object.entries(demo.age || {}).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0];
                    const parts = [] as string[];
                    if (topCountry) parts.push(String(topCountry));
                    if (topAge) parts.push(String(topAge));
                    if (parts.length) demoText = parts.join(' • ');
                }
            } catch (e) {
                logger.error(`${fnTag} Erro ao obter demographics:`, e);
            }
        } else if (demoRes.status === 'rejected') {
            logger.error(`${fnTag} Erro ao obter demographics:`, demoRes.reason);
        }

        let avgPropagationText = 'Dados insuficientes';
        let avgFollowerConvText = 'Dados insuficientes';
        let avgRetentionText = 'Dados insuficientes';
        if (metricsRes.status === 'fulfilled' && metricsRes.value) {
            try {
                const history = (metricsRes.value as { history?: any }).history || {};
                const avgOf = (arr: any): number | null => {
                    const vals = Array.isArray(arr) ? arr.filter((v: any) => typeof v === 'number') : [];
                    return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
                };
                const propAvg = avgOf(history.propagationIndex?.datasets?.[0]?.data);
                const convAvg = avgOf(history.followerConversionRate?.datasets?.[0]?.data);
                const retAvg = avgOf(history.retentionRate?.datasets?.[0]?.data);
                if (propAvg !== null) avgPropagationText = propAvg.toFixed(1);
                if (convAvg !== null) avgFollowerConvText = convAvg.toFixed(1);
                if (retAvg !== null) avgRetentionText = retAvg.toFixed(1);
            } catch (e) {
                logger.error(`${fnTag} Erro ao processar MetricsHistory:`, e);
            }
        } else if (metricsRes.status === 'rejected') {
            logger.error(`${fnTag} Erro ao processar MetricsHistory:`, metricsRes.reason);
        }

        let topFormatText = 'Dados insuficientes';
        let lowFormatText = 'Dados insuficientes';
        let bestDayText = 'Dados insuficientes';
        let perfSummaryText = 'Dados insuficientes';
        const perfHighlights =
            perfHighlightsRes.status === 'fulfilled' ? perfHighlightsRes.value : null;
        const dayPerf = dayPerfRes.status === 'fulfilled' ? dayPerfRes.value : null;
        const timePerf = timePerfRes.status === 'fulfilled' ? timePerfRes.value : null;

        if (perfHighlightsRes.status === 'rejected')
            logger.error(`${fnTag} Erro ao obter resumo de performance:`, perfHighlightsRes.reason);
        if (dayPerfRes.status === 'rejected')
            logger.error(`${fnTag} Erro ao obter desempenho por dia:`, dayPerfRes.reason);
        if (timePerfRes.status === 'rejected')
            logger.error(`${fnTag} Erro ao obter desempenho por horário:`, timePerfRes.reason);

        try {
            if (perfHighlights) {
                const formatVal = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : Math.round(v).toString());
                if (perfHighlights.topFormat) {
                    topFormatText = `${perfHighlights.topFormat.name} (${formatVal(perfHighlights.topFormat.average)})`;
                }
                if (perfHighlights.lowFormat) {
                    lowFormatText = `${perfHighlights.lowFormat.name} (${formatVal(perfHighlights.lowFormat.average)})`;
                }
            }
            if (dayPerf?.bestDays?.length) {
                const bestDay = dayPerf.bestDays[0];
                if (bestDay) {
                    const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][bestDay.dayOfWeek - 1];
                    if (dayName) {
                        bestDayText = dayName;
                    }
                }
            }
            if (timePerf?.bestSlots?.length) {
                const slot = timePerf.bestSlots[0];
                if (slot) {
                    const slotDay = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][slot.dayOfWeek - 1];
                    if (slotDay) {
                        hotTimeText = `${slotDay} às ${slot.hour}h`;
                    }
                }
            }

            const parts: string[] = [];
            if (perfHighlights?.topFormat) parts.push(`Formato em alta: ${perfHighlights.topFormat.name}.`);
            if (bestDayText !== 'Dados insuficientes') parts.push(`Melhor dia: ${bestDayText}.`);
            if (timePerf?.bestSlots?.length) {
                const slot = timePerf.bestSlots[0];
                if (slot) {
                    const slotDay = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][slot.dayOfWeek - 1];
                    if (slotDay) {
                        parts.push(`Horário mais quente: ${slotDay} às ${slot.hour}h.`);
                    }
                }
            }
            if (parts.length) perfSummaryText = parts.join(' ');
        } catch (e) {
            logger.error(`${fnTag} Erro ao obter resumo de performance:`, e);
        }

        const tonePref = user.userPreferences?.preferredAiTone || 'Dados insuficientes';
        const prefFormats = Array.isArray(user.userPreferences?.preferredFormats) && user.userPreferences?.preferredFormats.length
            ? user.userPreferences!.preferredFormats.join(', ')
            : 'Dados insuficientes';
        const dislikedTopics = Array.isArray(user.userPreferences?.dislikedTopics) && user.userPreferences?.dislikedTopics.length
            ? user.userPreferences!.dislikedTopics.join(', ')
            : 'Dados insuficientes';
        const longTermGoals = Array.isArray(user.userLongTermGoals) && user.userLongTermGoals.length
            ? user.userLongTermGoals.map(g => g.goal).join(', ')
            : 'Dados insuficientes';
        const keyFacts = Array.isArray(user.userKeyFacts) && user.userKeyFacts.length
            ? user.userKeyFacts.map(f => f.fact).join(', ')
            : 'Dados insuficientes';
        const expertiseLevel = user.inferredExpertiseLevel || 'Dados insuficientes';
        const userBio = user.biography || 'Dados insuficientes';
        const profileTone = user.profileTone || 'Dados insuficientes';

        systemPrompt = systemPrompt
            .replace('{{AVG_REACH_LAST30}}', String(avgReach))
            .replace('{{AVG_SHARES_LAST30}}', String(avgShares))
            .replace('{{TREND_SUMMARY_LAST30}}', String(trendSummary))
            .replace('{{AVG_ENG_RATE_LAST30}}', String(avgEngRate))
            .replace('{{FOLLOWER_GROWTH_LAST30}}', followerGrowthText)
            .replace('{{FOLLOWER_GROWTH_RATE_LAST30}}', followerGrowthRateText)
            .replace('{{AVG_ENG_POST_LAST30}}', avgEngPostText)
            .replace('{{AVG_REACH_POST_LAST30}}', avgReachPostText)
            .replace('{{AVG_PROPAGATION_LAST30}}', avgPropagationText)
            .replace('{{AVG_FOLLOWER_CONV_RATE_LAST30}}', avgFollowerConvText)
            .replace('{{AVG_RETENTION_RATE_LAST30}}', avgRetentionText)
            .replace('{{DEALS_COUNT_LAST30}}', dealsCountText)
            .replace('{{DEALS_REVENUE_LAST30}}', dealsRevenueText)
            .replace('{{DEAL_AVG_VALUE_LAST30}}', dealsAvgValueText)
            .replace('{{DEALS_BRAND_SEGMENTS}}', brandSegText)
            .replace('{{DEALS_FREQUENCY}}', dealsFreqText)
            .replace('{{EMERGING_FPC_COMBOS}}', emergingCombos)
            .replace('{{HOT_TIMES_LAST_ANALYSIS}}', hotTimeText)
            .replace('{{TOP_DAY_PCO_COMBOS}}', topDayCombosText)
            .replace('{{TOP_FPC_TRENDS}}', topTrendText)
            .replace('{{TOP_CATEGORY_RANKINGS}}', catText)
            .replace('{{AUDIENCE_TOP_SEGMENT}}', demoText)
            .replace('{{TOP_PERFORMING_FORMAT}}', topFormatText)
            .replace('{{LOW_PERFORMING_FORMAT}}', lowFormatText)
            .replace('{{BEST_DAY}}', bestDayText)
            .replace('{{PERFORMANCE_INSIGHT_SUMMARY}}', perfSummaryText)
            .replace('{{USER_TONE_PREF}}', tonePref)
            .replace('{{USER_PREFERRED_FORMATS}}', prefFormats)
            .replace('{{USER_DISLIKED_TOPICS}}', dislikedTopics)
            .replace('{{USER_LONG_TERM_GOALS}}', longTermGoals)
            .replace('{{USER_KEY_FACTS}}', keyFacts)
            .replace('{{USER_EXPERTISE_LEVEL}}', expertiseLevel)
            .replace('{{USER_BIO}}', userBio)
            .replace('{{USER_PROFILE_TONE}}', profileTone);
    } catch (metricErr) {
        logger.error(`${fnTag} Erro ao obter métricas para systemPrompt:`, metricErr);
        systemPrompt = systemPrompt
            .replace('{{AVG_REACH_LAST30}}', 'Dados insuficientes')
            .replace('{{AVG_SHARES_LAST30}}', 'Dados insuficientes')
            .replace('{{TREND_SUMMARY_LAST30}}', 'Dados insuficientes')
            .replace('{{AVG_ENG_RATE_LAST30}}', 'Dados insuficientes')
            .replace('{{FOLLOWER_GROWTH_LAST30}}', 'Dados insuficientes')
            .replace('{{EMERGING_FPC_COMBOS}}', 'Dados insuficientes')
            .replace('{{HOT_TIMES_LAST_ANALYSIS}}', 'Dados insuficientes')
            .replace('{{TOP_DAY_PCO_COMBOS}}', 'Dados insuficientes')
            .replace('{{TOP_FPC_TRENDS}}', 'Dados insuficientes')
            .replace('{{TOP_CATEGORY_RANKINGS}}', 'Dados insuficientes')
            .replace('{{AUDIENCE_TOP_SEGMENT}}', 'Dados insuficientes')
            .replace('{{TOP_PERFORMING_FORMAT}}', 'Dados insuficientes')
            .replace('{{LOW_PERFORMING_FORMAT}}', 'Dados insuficientes')
            .replace('{{BEST_DAY}}', 'Dados insuficientes')
            .replace('{{PERFORMANCE_INSIGHT_SUMMARY}}', 'Dados insuficientes')
            .replace('{{FOLLOWER_GROWTH_RATE_LAST30}}', 'Dados insuficientes')
            .replace('{{AVG_ENG_POST_LAST30}}', 'Dados insuficientes')
            .replace('{{AVG_REACH_POST_LAST30}}', 'Dados insuficientes')
            .replace('{{AVG_PROPAGATION_LAST30}}', 'Dados insuficientes')
            .replace('{{AVG_FOLLOWER_CONV_RATE_LAST30}}', 'Dados insuficientes')
            .replace('{{AVG_RETENTION_RATE_LAST30}}', 'Dados insuficientes')
            .replace('{{DEALS_COUNT_LAST30}}', 'Dados insuficientes')
            .replace('{{DEALS_REVENUE_LAST30}}', 'Dados insuficientes')
            .replace('{{DEAL_AVG_VALUE_LAST30}}', 'Dados insuficientes')
            .replace('{{DEALS_BRAND_SEGMENTS}}', 'Dados insuficientes')
            .replace('{{DEALS_FREQUENCY}}', 'Dados insuficientes')
            .replace('{{USER_TONE_PREF}}', 'Dados insuficientes')
            .replace('{{USER_PREFERRED_FORMATS}}', 'Dados insuficientes')
            .replace('{{USER_DISLIKED_TOPICS}}', 'Dados insuficientes')
            .replace('{{USER_LONG_TERM_GOALS}}', 'Dados insuficientes')
            .replace('{{USER_KEY_FACTS}}', 'Dados insuficientes')
            .replace('{{USER_EXPERTISE_LEVEL}}', 'Dados insuficientes')
            .replace('{{USER_BIO}}', 'Dados insuficientes')
            .replace('{{USER_PROFILE_TONE}}', 'Dados insuficientes');
    }

    try {
        await stateService.setInCache(cacheKey, systemPrompt, 300);
    } catch (cacheErr) {
        logger.error(`${fnTag} Erro ao salvar prompt em cache:`, cacheErr);
    }
    return systemPrompt;
}

export async function invalidateSystemPromptCache(
    userId: string,
    periodDays: number = DEFAULT_METRICS_FETCH_DAYS
): Promise<void> {
    const key = `prompt:${userId}:${periodDays}`;
    await stateService.deleteFromCache(key);
}


/**
 * Gera uma resposta curta e rápida para reconhecimento inicial (quebra-gelo).
 */
export async function getQuickAcknowledgementLLMResponse(
    systemPrompt: string,
    userQuery: string,
    userNameForLog: string = "usuário"
): Promise<string | null> {
    const fnTag = '[getQuickAcknowledgementLLMResponse v0.9.7]'; // Mantendo versão se não houver mudança aqui
    logger.info(`${fnTag} Iniciando para ${userNameForLog}. Query: "${userQuery.slice(0, 50)}..." Usando modelo: ${QUICK_ACK_MODEL}`);

    const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery }
    ];

    const aborter = new AbortController();
    const timeout = setTimeout(() => { aborter.abort(); logger.warn(`${fnTag} Timeout API OpenAI atingido.`); }, QUICK_ACK_TIMEOUT_MS);

    try {
        const completion = await openai.chat.completions.create(
            {
                model: QUICK_ACK_MODEL,
                messages: messages,
                temperature: QUICK_ACK_TEMP,
                max_tokens: QUICK_ACK_MAX_TOKENS,
                stream: false,
            },
            { signal: aborter.signal }
        );
        clearTimeout(timeout);

        const responseText = completion.choices[0]?.message?.content;
        if (responseText && responseText.trim() !== "") {
            logger.info(`${fnTag} Resposta de quebra-gelo gerada: "${responseText.slice(0, 70)}..."`);
            return responseText.trim();
        } else {
            logger.warn(`${fnTag} API da OpenAI retornou resposta vazia ou nula para o quebra-gelo.`);
            return null;
        }
    } catch (error: any) {
        clearTimeout(timeout);
        logger.error(`${fnTag} Falha na chamada à API OpenAI para quebra-gelo. Error Name: ${error.name}, Message: ${error.message}. Full Error Object:`, error);
        return null;
    }
}


/**
 * Envia uma mensagem ao LLM com Function Calling em modo streaming para a resposta principal.
 * MODIFICADO: Agora espera EnrichedAIContext que pode conter currentAlertDetails.
 */
export async function askLLMWithEnrichedContext(
    enrichedContext: EnrichedAIContext, // Tipo atualizado para EnrichedAIContext
    incomingText: string,
    intent: DeterminedIntent | 'generate_proactive_alert' // <<< ATUALIZAÇÃO DE TIPO AQUI >>>
): Promise<AskLLMResult> {
    const fnTag = '[askLLMWithEnrichedContext v1.0.8]'; // Versão atualizada
    const { user, historyMessages, userName, dialogueState, currentAlertDetails } = enrichedContext; // currentAlertDetails agora disponível
    logger.info(`${fnTag} Iniciando para usuário ${user._id} (Nome para prompt: ${userName}). Intenção: ${intent}. Texto: "${incomingText.slice(0, 50)}..." Usando modelo: ${MODEL}`);

    let initialMsgs: ChatCompletionMessageParam[];

    if (intent === 'generate_proactive_alert') {
        logger.info(`${fnTag} Intenção 'generate_proactive_alert' detectada. Usando prompt direto e especializado.`);

        // Template do novo prompt direto
        const directAlertPromptTemplate = `
Você é Mobi, um radar de performance inteligente para o Instagram. Sua comunicação é direta, proativa e valiosa.

Sua tarefa é gerar a mensagem COMPLETA de um alerta proativo para ser enviada a um usuário no WhatsApp.

**REGRAS CRÍTICAS:**
1.  **NÃO USE SAUDAÇÕES GENÉRICAS.** Nunca comece com "Olá", "Oi", "E aí", etc.
2.  **COMECE DIRETAMENTE COM O DADO MAIS IMPORTANTE.** A primeira frase deve ser o núcleo do alerta para que o usuário veja o valor imediatamente na notificação. Use o nome do usuário para personalizar, por exemplo: "Arthur, notei que...".
3.  **SEJA CONCISO.** Use 1-2 parágrafos curtos para explicar a situação com base na informação fornecida.
4.  **PERSONALIZE.** Use o nome do usuário, '${userName}', naturalmente na mensagem.
5.  **MARCA.** Após a explicação principal, adicione a linha "🚨 Alerta do Radar Mobi!". Use emojis relevantes (🚀 para positivo, 💡 para oportunidade, etc.).
6.  **ENGAJE.** Termine a mensagem com UMA pergunta estratégica e aberta que incentive o usuário a refletir sobre uma solução ou a pedir mais detalhes a você.

**Informação-Chave detectada pelo sistema para o alerta de hoje (use-a para construir sua mensagem):**
---
${incomingText}
---

Gere a mensagem final agora.
`;
        // Monta a lista de mensagens apenas com o novo prompt de sistema
        initialMsgs = [
            { role: 'system', content: directAlertPromptTemplate }
        ];

    } else {
        // Lógica original para todas as outras intenções
        const systemPrompt = await populateSystemPrompt(user, userName || user.name || 'usuário');

        initialMsgs = [
            { role: 'system', content: systemPrompt },
        ];

        // Se houver resumo de conversa no estado, adiciona como mensagem de sistema para reduzir contexto
        try {
            const summary = (enrichedContext as any)?.dialogueState?.conversationSummary as string | undefined;
            if (summary && typeof summary === 'string' && summary.trim().length > 0) {
                initialMsgs.push({ role: 'system', content: `Resumo da conversa até agora:\n${summary.trim()}` });
            }
        } catch {/* ignore */}

        initialMsgs.push(...historyMessages);
        initialMsgs.push({ role: 'user', content: incomingText });
    }

    logger.debug(`${fnTag} Histórico inicial montado com ${initialMsgs.length} mensagens.`);

    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();

    let resolveHistoryPromise: (history: ChatCompletionMessageParam[]) => void;
    let rejectHistoryPromise: (reason?: any) => void;
    const historyPromise = new Promise<ChatCompletionMessageParam[]>((resolve, reject) => {
        resolveHistoryPromise = resolve;
        rejectHistoryPromise = reject;
    });

    processTurn(initialMsgs, 0, null, writer, user, intent, enrichedContext)
        .then((finalHistory) => {
            logger.debug(`${fnTag} processTurn concluído com sucesso. Fechando writer.`);
            writer.close();
            resolveHistoryPromise(finalHistory);
        })
        .catch(async (error) => {
            logger.error(`${fnTag} Erro durante processTurn:`, error);
            rejectHistoryPromise(error);
            try {
                if (!writer.closed) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if (!errorMessage.includes("Writer is closed") && !errorMessage.includes("WritableStreamDefaultWriter.close")) {
                        await writer.write(`\n\n⚠️ Desculpe, ocorreu um erro interno ao processar sua solicitação.`);
                        logger.info(`${fnTag} Mensagem de erro genérica escrita no stream.`);
                    }
                    logger.debug(`${fnTag} Abortando writer após erro em processTurn.`);
                    await writer.abort(error);
                }
            } catch (abortError) {
                logger.error(`${fnTag} Erro ao escrever erro/abortar writer:`, abortError);
            }
        });

    logger.debug(`${fnTag} Retornando stream e historyPromise imediatamente.`);
    return { stream: readable, historyPromise };

    // ============================================================
    // Função Interna Recursiva para Processar Turnos da Conversa
    // ============================================================
    async function processTurn(
        currentMsgs: ChatCompletionMessageParam[],
        iter: number,
        lastFnName: string | null,
        writer: WritableStreamDefaultWriter<string>,
        currentUser: IUser,
        currentIntent: DeterminedIntent | 'generate_proactive_alert', // <<< ATUALIZAÇÃO DE TIPO AQUI >>>
        currentEnrichedContext: EnrichedAIContext
    ): Promise<ChatCompletionMessageParam[]> {
        const turnTag = `[processTurn iter ${iter} v1.0.8]`; // Versão atualizada
        logger.debug(`${turnTag} Iniciando. Intenção atual do turno: ${currentIntent}`);

        if (iter >= MAX_ITERS) {
            logger.warn(`${turnTag} Function-call loop excedeu MAX_ITERS (${MAX_ITERS}).`);
            const maxIterMessage = `Desculpe, parece que estou tendo dificuldades em processar sua solicitação após várias tentativas. Poderia tentar de outra forma?`;
            currentMsgs.push({ role: 'assistant', content: maxIterMessage });
            try { await writer.write(maxIterMessage); }
            catch (e) { logger.error(`${fnTag} Erro ao escrever msg de MAX_ITERS:`, e); }
            return currentMsgs;
        }

        const aborter = new AbortController();
        const timeout = setTimeout(() => { aborter.abort(); logger.warn(`${turnTag} Timeout API OpenAI atingido.`); }, OPENAI_TIMEOUT_MS);

        const requestPayload: ChatCompletionCreateParamsStreaming = {
            model: MODEL,
            temperature: TEMP,
            max_tokens: TOKENS,
            stream: true,
            messages: currentMsgs,
        };
        
        const isLightweightIntent = currentIntent === 'social_query' || currentIntent === 'meta_query_personal' || currentIntent === 'generate_proactive_alert';

        if (isLightweightIntent) {
            logger.info(`${turnTag} Intenção '${currentIntent}' é leve. Function calling desabilitado.`);
        } else {
            logger.info(`${turnTag} Intenção '${currentIntent}' permite function calling. Habilitando funções padrão.`);
            // Filtra funções sensíveis para o chat geral: não expor inspirações da comunidade
            const defaultFunctions = [...functionSchemas];
            const shouldKeepCommunityInspirationsForGeneral =
                currentIntent === 'general' &&
                currentEnrichedContext.dialogueState?.currentTask?.name === 'ask_community_inspiration';
            const filteredFunctions = currentIntent === 'general' && !shouldKeepCommunityInspirationsForGeneral
                ? defaultFunctions.filter((fn) => fn.name !== 'fetchCommunityInspirations')
                : defaultFunctions;
            if (currentIntent === 'general') {
                if (shouldKeepCommunityInspirationsForGeneral) {
                    logger.info(`${turnTag} Intenção 'general' em continuidade de inspiração: mantendo 'fetchCommunityInspirations'.`);
                } else if (filteredFunctions.length !== defaultFunctions.length) {
                    logger.info(`${turnTag} Funções filtradas para intent 'general': removido 'fetchCommunityInspirations'.`);
                }
            }
            requestPayload.functions = filteredFunctions;
            requestPayload.function_call = 'auto';
        }

        let completionStream: AsyncIterable<ChatCompletionChunk>;
        try {
            logger.debug(`${turnTag} Chamando OpenAI API (Modelo: ${requestPayload.model}, Histórico: ${requestPayload.messages.length} msgs). Function calling: ${(requestPayload as any).function_call ?? 'omitido'}, Functions count: ${(requestPayload as any).functions?.length ?? 'omitido'}`);
            completionStream = await openai.chat.completions.create(
                requestPayload,
                { signal: aborter.signal }
            );
        } catch (error: any) {
            clearTimeout(timeout);
            logger.error(`${turnTag} Falha na chamada à API OpenAI. Error Name: ${error.name}, Message: ${error.message}. Full Error Object:`, error);
            const apiCallFailMessage = "Desculpe, não consegui conectar com o serviço de IA no momento. Tente mais tarde.";
            currentMsgs.push({ role: 'assistant', content: apiCallFailMessage });
            try { await writer.write(apiCallFailMessage); }
            catch (e) { logger.error(`${fnTag} Erro ao escrever msg de falha da API:`, e); }
            return currentMsgs;
        }

        let pendingAssistantMsg: ChatCompletionAssistantMessageParam | null = null;
        let functionCallName = '';
        let functionCallArgs = '';
        let streamReceivedContent = false;
        let lastFinishReason: ChatCompletionChunk.Choice['finish_reason'] | null | undefined = null;

        try {
            logger.debug(`${turnTag} Iniciando consumo do stream da API...`);
            for await (const chunk of completionStream) {
                const choice = chunk.choices?.[0];
                if (!choice) continue;
                const delta = choice.delta;

                if (delta?.function_call) {
                    streamReceivedContent = true;
                    if (!pendingAssistantMsg) { pendingAssistantMsg = { role: 'assistant', content: null, function_call: { name: '', arguments: '' } }; }
                    if (delta.function_call.name) functionCallName += delta.function_call.name;
                    if (delta.function_call.arguments) functionCallArgs += delta.function_call.arguments;
                    continue;
                }

                if (delta?.content) {
                    streamReceivedContent = true;
                    if (!pendingAssistantMsg) { pendingAssistantMsg = { role: 'assistant', content: '' }; }
                    pendingAssistantMsg.content = (pendingAssistantMsg.content ?? '') + delta.content;
                    try { await writer.write(delta.content); }
                    catch (writeError) { logger.error(`${turnTag} Erro ao escrever no writer:`, writeError); throw writeError; }
                }

                if (choice.finish_reason) { lastFinishReason = choice.finish_reason; logger.debug(`${turnTag} Recebido finish_reason: ${lastFinishReason}`); }
            }
            logger.debug(`${turnTag} Fim do consumo do stream da API. Último Finish Reason: ${lastFinishReason}`);
        } catch (streamError: any) {
            logger.error(`${turnTag} Erro durante o consumo do stream:`, streamError);
            const streamErrMessage = "Desculpe, houve um problema ao receber a resposta da IA. Tente novamente.";
            if (pendingAssistantMsg && typeof pendingAssistantMsg.content === 'string') {
                pendingAssistantMsg.content += `\n${streamErrMessage}`;
            } else {
                pendingAssistantMsg = { role: 'assistant', content: streamErrMessage };
            }
            currentMsgs.push(pendingAssistantMsg);
            try { await writer.write(`\n${streamErrMessage}`); }
            catch (e) { logger.error(`${turnTag} Erro ao escrever msg de erro de stream:`, e); }
            return currentMsgs;
        } finally {
            clearTimeout(timeout);
        }

        if (!streamReceivedContent && lastFinishReason !== 'stop' && lastFinishReason !== 'length' && lastFinishReason !== 'function_call') {
            logger.error(`${turnTag} Stream finalizado sem conteúdo útil e com finish_reason inesperado: ${lastFinishReason}`);
            const noContentMessage = "A IA não forneceu uma resposta utilizável desta vez. Poderia tentar novamente?";
            currentMsgs.push({ role: 'assistant', content: noContentMessage });
            try { await writer.write(noContentMessage); }
            catch (e) { logger.error(`${fnTag} Erro ao escrever msg de 'sem conteúdo útil':`, e); }
            return currentMsgs;
        }
        if (pendingAssistantMsg) {
            if (functionCallName || functionCallArgs) {
                if (isLightweightIntent) {
                    logger.warn(`${turnTag} IA tentou function call (${functionCallName}) para intent leve ('${currentIntent}'), mas os parâmetros de função não foram enviados. Ignorando a chamada de função e tratando como texto.`);
                    if (pendingAssistantMsg.content === null || pendingAssistantMsg.content === '') {
                        pendingAssistantMsg.content = "Entendi.";
                        try { await writer.write(pendingAssistantMsg.content); } catch (e) { /* ignore */ }
                    }
                    pendingAssistantMsg.function_call = undefined;
                } else {
                    pendingAssistantMsg.function_call = { name: functionCallName, arguments: functionCallArgs };
                    pendingAssistantMsg.content = null;
                }
            } else if (pendingAssistantMsg.content === null || pendingAssistantMsg.content === '') {
                if (lastFinishReason !== 'stop' && lastFinishReason !== 'length') {
                    logger.warn(`${turnTag} Mensagem assistente finalizada sem conteúdo/function call. Finish Reason: ${lastFinishReason}. Content será null/vazio.`);
                }
            }
            currentMsgs.push(pendingAssistantMsg as ChatCompletionAssistantMessageParam);
        } else if (lastFinishReason === 'stop' || lastFinishReason === 'length') {
            logger.warn(`${turnTag} Stream finalizado (${lastFinishReason}) mas sem delta de assistente. Adicionando msg de assistente vazia de fallback.`);
            currentMsgs.push({ role: 'assistant', content: '' });
        } else if (!functionCallName && lastFinishReason !== 'function_call') {
            logger.error(`${turnTag} Estado inesperado no final do processamento do stream. Finish Reason: ${lastFinishReason}, sem function call name.`);
        }

        if (pendingAssistantMsg?.function_call && !isLightweightIntent) {
            const { name, arguments: rawArgs } = pendingAssistantMsg.function_call;
            logger.info(`${turnTag} API solicitou Function Call: ${name}. Args RAW: ${rawArgs.slice(0, 100)}...`);

            if (name === lastFnName && iter > 1) {
                logger.warn(`${turnTag} Loop de função (após uma tentativa de correção) detectado e prevenido: ${name} chamada novamente.`);
                const loopErrorMessage = `Ainda estou tendo dificuldades com a função '${name}' após tentar corrigi-la. Poderia reformular sua solicitação ou focar em outro aspecto?`;
                currentMsgs.push({ role: 'assistant', content: loopErrorMessage });
                try {
                    const lastMessageInHistory = currentMsgs[currentMsgs.length - 2];
                    if (!(lastMessageInHistory?.role === 'assistant' && lastMessageInHistory.content)) {
                        await writer.write(loopErrorMessage);
                    }
                }
                catch (writeError) { logger.error(`${turnTag} Erro ao escrever mensagem de loop detectado no writer:`, writeError); }
                return currentMsgs;
            }

            let functionResult: unknown;
            const executor = functionExecutors[name as keyof typeof functionExecutors];
            const validator = functionValidators[name];

            if (!executor) {
                functionResult = { error: `Função "${name}" desconhecida.` };
                logger.error(`${turnTag} Executor não encontrado para "${name}".`);
            } else if (!validator) {
                functionResult = { error: `Configuração interna inválida: Validador não encontrado para a função ${name}.` };
                logger.error(`${turnTag} Validador Zod não encontrado para "${name}".`);
            } else {
                let validatedArgs: any;
                try {
                    const parsedJson = JSON.parse(rawArgs || '{}');
                    logger.debug(`${turnTag} Validando args para "${name}" com Zod...`);
                    const validationResult = validator.safeParse(parsedJson);

                    if (validationResult.success) {
                        validatedArgs = validationResult.data;
                        logger.info(`${turnTag} Args para "${name}" validados com SUCESSO.`);
                        try {
                            logger.debug(`${turnTag} Executando executor para "${name}"...`);
                            functionResult = await executor(validatedArgs, currentUser);
                            logger.info(`${turnTag} Função "${name}" executada com sucesso.`);
                        } catch (execError: any) {
                            logger.error(`${turnTag} Erro ao executar a função "${name}":`, execError);
                            functionResult = { error: `Erro interno ao executar a função ${name}: ${execError.message || String(execError)}` };
                        }
                    } else {
                        logger.warn(`${turnTag} Erro de validação Zod para args da função "${name}":`, validationResult.error.format());
                        const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.') || 'argumento'}: ${e.message}`).join('; ');
                        functionResult = { error: `Argumentos inválidos para a função ${name}. Detalhes: ${errorMessages}` };
                    }
                } catch (parseError) {
                    logger.error(`${turnTag} Erro JSON.parse dos args para "${name}": ${rawArgs}`, parseError);
                    functionResult = { error: `Argumentos inválidos para ${name}. Esperava formato JSON.` };
                }
            }

            currentMsgs.push({ role: 'function', name: name, content: JSON.stringify(functionResult) });
            logger.debug(`${turnTag} Histórico antes da recursão (iter ${iter + 1}, ${currentMsgs.length} msgs).`);
            // Passando currentEnrichedContext para a chamada recursiva
            return processTurn(currentMsgs, iter + 1, name, writer, currentUser, currentIntent, currentEnrichedContext);
        } else if (pendingAssistantMsg?.function_call && isLightweightIntent) {
            logger.warn(`${turnTag} Function call recebida para intent leve '${currentIntent}', mas foi ignorada pois os parâmetros de função não foram enviados à API.`);
        }

        logger.debug(`${turnTag} Turno concluído sem chamada de função processada (ou para intent leve).`);
        return currentMsgs;
    } // Fim da função processTurn
}
