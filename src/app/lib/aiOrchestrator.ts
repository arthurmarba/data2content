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
import * as Sentry from '@sentry/nextjs';
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
// Carrega stateService de forma segura em testes (evita Upstash/Redis)
const stateService =
    process.env.NODE_ENV === 'test'
        ? require('../../../__mocks__/stateService.js')
        : require('@/app/lib/stateService');
import { functionValidators } from './aiFunctionSchemas.zod';
import { DeterminedIntent } from './intentService';
// Importando EnrichedAIContext do local correto
import { EnrichedAIContext } from '@/app/api/whatsapp/process-response/types';
import { buildQuestionFocusPrompt, extractQuestionFocus } from '@/app/lib/ai/questionFocus';
import { applyIntentContract } from '@/app/lib/ai/intentContract';
import { buildAnswerSpec, buildClarifyingResponse, validateRelevance } from '@/app/lib/ai/relevanceValidator';
import aggregateUserPerformanceHighlights from '@/utils/aggregateUserPerformanceHighlights';
import aggregateUserDayPerformance from '@/utils/aggregateUserDayPerformance';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';
import { DEFAULT_METRICS_FETCH_DAYS } from '@/app/lib/constants';
import { formatCurrencySafely, normalizeCurrencyCode } from '@/utils/currency';


// Configuração do cliente OpenAI e constantes
const openai =
    process.env.NODE_ENV === 'test'
        ? ({
            chat: {
                completions: {
                    create: async () => ({ choices: [{ message: { content: '' } }] }),
                },
            },
        } as unknown as OpenAI)
        : new OpenAI({
            apiKey: process.env.OPENAI_API_KEY!,
            baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            dangerouslyAllowBrowser: true,
        });
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

const MONETIZATION_KEYWORDS = [
    'quanto cobrar', 'quanto devo cobrar', 'preço', 'valor', 'cache', 'cachê',
    'publi', 'publicidade', 'parceria', 'patrocínio', 'patrocinio', 'marca',
    'mediakit', 'media kit', 'mídia kit', 'midia kit', 'proposta', 'orçamento',
    'negociar', 'contrato', 'deliverables', 'combo', 'pacote',
    'contraproposta', 'contra proposta', 'contra-proposta'
];

const BUG_KEYWORDS = [
    'sumiu', 'não carrega', 'bug', 'erro', 'quebrou', 'não aparece', 'travou',
    'falha', 'problema', 'não funciona', 'tela branca', '404', '500'
];

const DEEP_ANALYSIS_KEYWORDS = [
    'por que', 'motivo', 'razão', 'razao', 'entender', 'analisa esse',
    'analise esse', 'funcionou tanto', 'deu certo', 'deu errado', 'flopou',
    'bombou', 'viralizou', 'explica', 'explicação'
];


/**
 * Retorno de askLLMWithEnrichedContext.
 */
interface AskLLMResult {
    stream: ReadableStream<string>;
    historyPromise: Promise<ChatCompletionMessageParam[]>;
}

/**
 * Constrói o prompt direto usado para alertas proativos, garantindo personalização correta.
 */
export function buildDirectAlertPrompt(userNameForPrompt: string, incomingText: string): string {
    const safeUserName = userNameForPrompt?.trim() || 'criador';

    return `
Você é Mobi, um radar de performance inteligente para o Instagram. Sua comunicação é direta, proativa e valiosa.

Sua tarefa é gerar a mensagem COMPLETA de um alerta proativo para ser enviada a um usuário no WhatsApp.

**REGRAS CRÍTICAS:**
1.  **NÃO USE SAUDAÇÕES GENÉRICAS.** Nunca comece com "Olá", "Oi", "E aí", etc.
2.  **COMECE DIRETAMENTE COM O DADO MAIS IMPORTANTE.** A primeira frase deve ser o núcleo do alerta. Use o nome do usuário na abertura, por exemplo: "${safeUserName}, notei que...".
3.  **SEJA CONCISO.** Use 1-2 parágrafos curtos.
4.  **PERSONALIZE.** Use o nome do usuário, '${safeUserName}', naturalmente.
5.  **MARCA E EMOJIS.** Use emojis específicos para o tipo de alerta:
    *   🚀 **Crescimento/Sucesso:** Para recordes, altas taxas, metas batidas.
    *   ⚠️ **Atenção/Queda:** Para quedas bruscas ou métricas abaixo do esperado.
    *   💡 **Oportunidade:** Para tendências ou insights de horário.
    *   Adicione a linha "🚨 Alerta do Radar Mobi!" ao final do primeiro parágrafo.
6.  **ENGAJE (CALL TO ACTION).** Termine com uma pergunta que convide o usuário a abrir o chat para saber mais. Ex: "Quer ver quais posts causaram isso?", "Vamos ajustar a estratégia para a próxima semana?".

**Informação-Chave detectada pelo sistema para o alerta de hoje (use-a para construir sua mensagem):**
---
${incomingText}
---

Gere a mensagem final agora.
`;
}

/**
 * Preenche o system prompt com métricas e estatísticas recentes.
 * Exportada para facilitar testes unitários.
 */
const SYSTEM_PROMPT_CACHE_VERSION = 'v2.40';

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

        const totalPostsValue = typeof stats.totalPosts === 'number' ? stats.totalPosts : null;
        const totalPostsText = totalPostsValue !== null ? `${totalPostsValue} posts nos últimos ${periodDays} dias` : 'Dados insuficientes';
        const postsPerWeekNumeric = totalPostsValue !== null ? (totalPostsValue / periodDays) * 7 : null;

        const formatWeekly = (value: number) => {
            if (value <= 0) return '0';
            if (value >= 10) return value.toFixed(0);
            if (value >= 3) return value.toFixed(1);
            return value.toFixed(1);
        };

        let postsPerWeekText = 'Dados insuficientes';
        let postingCadenceGuidance = 'Sem dados recentes de frequência; incentive o criador a registrar mais publicações para calibrar a cadência sugerida.';

        if (postsPerWeekNumeric !== null) {
            const weeklyFormatted = formatWeekly(postsPerWeekNumeric);
            postsPerWeekText = `${weeklyFormatted} posts/semana (média nos últimos ${periodDays} dias)`;

            if (postsPerWeekNumeric < 1) {
                postingCadenceGuidance = `O criador está publicando em média ${weeklyFormatted} posts por semana. Estruture planos para atingir 2 a 3 posts/semana nas próximas duas semanas, sugerindo calendários simples, batching e checkpoints de revisão.`;
            } else if (postsPerWeekNumeric < 2.5) {
                postingCadenceGuidance = `O criador mantém cerca de ${weeklyFormatted} posts por semana. Ajude a evoluir para 3 postagens semanais propondo blocos temáticos fixos, agendas recorrentes e ideias específicas para cada dia.`;
            } else if (postsPerWeekNumeric < 5) {
                postingCadenceGuidance = `O criador já publica em média ${weeklyFormatted} posts por semana. Garanta que ele mantenha essa constância com um calendário claro e introduza formatos criativos extras (séries, desafios, reciclagem de conteúdos) para evitar repetição.`;
            } else {
                postingCadenceGuidance = `O criador publica aproximadamente ${weeklyFormatted} posts por semana. Reconheça a disciplina, proponha otimizações avançadas (reaproveitamento multiplataforma, conteúdos profundos) e cuidados para evitar saturação ou burnout.`;
            }
        }

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

        const surveyProfile = buildSurveyProfileSnippet(user);

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
            .replace('{{TOTAL_POSTS_PERIOD}}', totalPostsText)
            .replace('{{POSTS_PER_WEEK}}', postsPerWeekText)
            .replace('{{POSTING_FREQUENCY_GUIDANCE}}', postingCadenceGuidance)
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
            .replace('{{USER_PROFILE_TONE}}', profileTone)
            .replace('{{SURVEY_PROFILE_SNIPPET}}', surveyProfile.snippet || 'Dados insuficientes; peça preferências rápidas (formato, tom, objetivo 3m).');

        if (surveyProfile.snippet) {
            logger.info(`${fnTag} profile_from_survey=true fields_used=[${surveyProfile.fieldsUsed.join(',')}]`);
        } else {
            logger.info(`${fnTag} profile_from_survey=false`);
        }

        // Injeta alertas/insights recentes (Radar) diretamente no prompt para respostas situadas.
        const alertHistory = Array.isArray((user as any)?.alertHistory) ? (user as any).alertHistory : [];
        if (alertHistory.length) {
            const latestAlerts = alertHistory
                .slice(-3)
                .map((a: any) => {
                    const ageMinutes = a?.date ? Math.max(0, (Date.now() - new Date(a.date).getTime()) / 60000) : null;
                    const ageLabel = ageMinutes === null
                        ? 'recente'
                        : ageMinutes < 60
                            ? `${Math.round(ageMinutes)}min`
                            : ageMinutes < 1440
                                ? `${Math.round(ageMinutes / 60)}h`
                                : `${Math.round(ageMinutes / 1440)}d`;
                    return `${a?.type || 'alerta'} (${ageLabel})`;
                });
            const alertSnippet = latestAlerts.join(' • ');
            systemPrompt += `\n\nContexto de alertas recentes do Radar: ${alertSnippet}. Use para priorizar recomendações e diagnósticos.`;
        }
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
            .replace('{{TOTAL_POSTS_PERIOD}}', 'Dados insuficientes')
            .replace('{{POSTS_PER_WEEK}}', 'Dados insuficientes')
            .replace('{{POSTING_FREQUENCY_GUIDANCE}}', 'Sem dados recentes de frequência; incentive o criador a registrar posts para calcular uma cadência personalizada.')
            .replace('{{USER_TONE_PREF}}', 'Dados insuficientes')
            .replace('{{USER_PREFERRED_FORMATS}}', 'Dados insuficientes')
            .replace('{{USER_DISLIKED_TOPICS}}', 'Dados insuficientes')
            .replace('{{USER_LONG_TERM_GOALS}}', 'Dados insuficientes')
            .replace('{{USER_KEY_FACTS}}', 'Dados insuficientes')
            .replace('{{USER_EXPERTISE_LEVEL}}', 'Dados insuficientes')
            .replace('{{USER_BIO}}', 'Dados insuficientes')
            .replace('{{USER_PROFILE_TONE}}', 'Dados insuficientes')
            .replace('{{SURVEY_PROFILE_SNIPPET}}', 'Dados insuficientes; peça preferências rápidas (formato, tom, objetivo 3m).');
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

export interface PricingAnalysisInput {
    calcResult: {
        segment: string;
        justo: number;
        estrategico?: number;
        premium?: number;
        cpm?: number;
        source?: 'seed' | 'dynamic';
        avgReach?: number | null;
    };
    recentDeal?: {
        value: number;
        reach?: number | null;
        createdAt?: string | null;
        brandSegment?: string | null;
    };
    diff: number | null;
}

export async function generatePricingAnalysisInsight(input: PricingAnalysisInput): Promise<string> {
    const fnTag = '[pricingAnalysisInsight v1.1.0]';

    const { calcResult, recentDeal } = input;

    const isSeed = calcResult.source === 'seed';
    const segmentLabel = calcResult.segment || 'default';

    const formatCurrency = (value: number, currency: string = 'BRL') => {
        try {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency,
                maximumFractionDigits: 2,
            }).format(value);
        } catch {
            return value.toFixed(2);
        }
    };

    const cpmValue =
        typeof calcResult.cpm === 'number' && Number.isFinite(calcResult.cpm) && calcResult.cpm > 0
            ? calcResult.cpm
            : null;
    const avgReachFromCalc =
        typeof calcResult.avgReach === 'number' && Number.isFinite(calcResult.avgReach) && calcResult.avgReach > 0
            ? calcResult.avgReach
            : null;
    const reachFromDeal =
        typeof recentDeal?.reach === 'number' && Number.isFinite(recentDeal.reach) && recentDeal.reach > 0
            ? recentDeal.reach
            : null;
    const reachForEstimate = avgReachFromCalc ?? reachFromDeal ?? null;
    const estimatedValueRaw =
        cpmValue !== null && reachForEstimate !== null ? (reachForEstimate / 1000) * cpmValue : null;
    const estimatedValue =
        estimatedValueRaw !== null && Number.isFinite(estimatedValueRaw) && estimatedValueRaw >= 200
            ? estimatedValueRaw
            : null;
    const offeredBudget =
        typeof recentDeal?.value === 'number' && Number.isFinite(recentDeal.value) && recentDeal.value > 0
            ? recentDeal.value
            : null;
    const justoValid =
        typeof calcResult.justo === 'number' &&
            Number.isFinite(calcResult.justo) &&
            calcResult.justo >= 200
            ? calcResult.justo
            : null;
    const comparisonBase = estimatedValue ?? justoValid;
    const diffPercent =
        comparisonBase && offeredBudget ? ((offeredBudget - comparisonBase) / comparisonBase) * 100 : null;

    const classifyDiff = (value: number | null) => {
        if (value === null || !Number.isFinite(value)) return null;
        if (value < -15) return 'below';
        if (value > 15) return 'above';
        return 'within';
    };

    const diffClassification = classifyDiff(diffPercent);
    const diffText =
        diffPercent !== null && Number.isFinite(diffPercent)
            ? `${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(1)}%`
            : 'indefinido';

    const contextLog = {
        segment: segmentLabel,
        cpm: cpmValue,
        avgReach: reachForEstimate,
        estimatedValue:
            estimatedValue !== null ? Number(estimatedValue.toFixed(2)) : estimatedValueRaw ?? null,
        comparisonValue: comparisonBase !== null ? Number(comparisonBase.toFixed(2)) : null,
        offered: offeredBudget !== null ? Number(offeredBudget.toFixed(2)) : null,
        diff: diffPercent !== null ? Number(diffPercent.toFixed(2)) : null,
    };
    logger.info(`[PRICING_CONTEXT] ${JSON.stringify(contextLog)}`);
    Sentry.captureMessage(`[PRICING_CONTEXT] ${JSON.stringify(contextLog)}`, 'info');

    if (isSeed) {
        const seedMessage =
            'Como ainda não há publis registradas no seu nicho, usei o CPM médio de mercado para gerar uma estimativa inicial. Esse valor será ajustado à medida que novos criadores registrarem campanhas.';
        const logLine = `[PRICING_INSIGHT] ${segmentLabel}: seed benchmark → ${seedMessage}`;
        logger.info(logLine);
        Sentry.captureMessage(logLine, 'info');
        return seedMessage;
    }

    const reachText =
        reachForEstimate !== null ? Math.round(reachForEstimate).toLocaleString('pt-BR') : null;
    const estimatedText = estimatedValue !== null ? formatCurrency(estimatedValue) : null;
    const offeredText = offeredBudget !== null ? formatCurrency(offeredBudget) : 'sem registro';
    const dealReachText =
        typeof recentDeal?.reach === 'number' && recentDeal.reach > 0
            ? `${Math.round(recentDeal.reach).toLocaleString('pt-BR')} pessoas`
            : 'alcance não informado';

    const contextSentences: string[] = [
        'Esses valores representam o custo médio por mil visualizações (CPM) com base no seu nicho e desempenho médio.',
    ];

    if (cpmValue !== null) {
        contextSentences.push(`Seu CPM médio é de ${formatCurrency(cpmValue)}.`);
    }

    if (reachText && estimatedText) {
        contextSentences.push(
            `Com seu alcance médio de ${reachText} visualizações, o valor justo estimado para uma entrega seria de ${estimatedText}.`
        );
    } else if (justoValid !== null) {
        contextSentences.push(
            `Sem um alcance médio disponível, considere o valor base sugerido pela calculadora: ${formatCurrency(justoValid)}.`
        );
    } else {
        contextSentences.push(
            'Ainda não temos alcance recente suficiente para estimar o valor total da campanha. Registre novas publis para calibrar melhor.'
        );
    }

    if (offeredBudget !== null) {
        const diffAbsText = diffPercent !== null ? `${Math.abs(diffPercent).toFixed(1)}%` : null;
        let comparisonSentence: string;
        if (diffClassification === 'below' && diffAbsText) {
            comparisonSentence = `O orçamento oferecido pela marca (${formatCurrency(
                offeredBudget
            )}) está cerca de ${diffAbsText} abaixo do valor justo estimado.`;
        } else if (diffClassification === 'above' && diffAbsText) {
            comparisonSentence = `O orçamento oferecido pela marca (${formatCurrency(
                offeredBudget
            )}) está cerca de ${diffAbsText} acima do valor médio do mercado.`;
        } else if (diffClassification === 'within' && diffAbsText) {
            comparisonSentence = `O orçamento oferecido pela marca (${formatCurrency(
                offeredBudget
            )}) está dentro da faixa esperada (variação de ${diffAbsText}).`;
        } else {
            comparisonSentence = `O orçamento oferecido pela marca é de ${formatCurrency(offeredBudget)}.`;
        }
        contextSentences.push(comparisonSentence);
    }

    let recommendation: string | null = null;
    if (comparisonBase !== null && offeredBudget !== null && diffClassification) {
        const diffAbs = Math.abs(diffPercent ?? 0).toFixed(1);
        const baseFormatted = formatCurrency(comparisonBase);
        if (diffClassification === 'below') {
            recommendation = `Para não desvalorizar sua entrega, recomendo contra-propor algo próximo de ${baseFormatted} — a oferta atual representa cerca de ${diffAbs}% abaixo do valor justo estimado.`;
        } else if (diffClassification === 'above') {
            recommendation = `A proposta vem ${diffAbs}% acima da média estimada (${baseFormatted}). Avalie aproveitar a margem negociando entregáveis extra ou consolidando um pacote premium.`;
        } else {
            recommendation = `A oferta da marca está alinhada ao valor estimado (${baseFormatted}). Vale reforçar diferenciais para manter a negociação nessa faixa.`;
        }
    } else if (comparisonBase !== null) {
        const baseFormatted = formatCurrency(comparisonBase);
        recommendation = `Use ${baseFormatted} como referência ao responder a marca — esse é o valor médio justo para sua entrega com base nas métricas recentes.`;
    } else {
        recommendation =
            'Ainda precisamos de mais cálculos recentes ou alcance consistente para estimar um valor total. Registre novas publis para deixarmos essa referência mais precisa.';
    }

    const closingQuestion = 'Quer que eu te ajude a montar a contraproposta ideal?';

    if (!isSeed) {
        contextSentences.unshift('Agora seus valores refletem o comportamento real da comunidade Data2Content.');
    }

    const finalMessage = [contextSentences.join(' '), recommendation, closingQuestion]
        .filter(Boolean)
        .join('\n\n');

    const logLine = `[PRICING_INSIGHT] ${segmentLabel} (dynamic): diff=${diffText} → ${finalMessage}`;
    logger.info(logLine);
    Sentry.captureMessage(logLine, 'info');

    return finalMessage;
}

export interface ProposalAnalysisMessageInput {
    brandName: string;
    campaignTitle?: string;
    campaignDescription?: string;
    deliverables?: string[];
    offeredBudget?: number;
    currency?: string;
    latestCalculation?: {
        segment: string;
        justo: number;
        estrategico?: number | null;
        premium?: number | null;
        createdAt?: string | null;
        metrics?: {
            engagement?: number | null;
            reach?: number | null;
        };
    };
    historicalAverage?: number | null;
    creatorName?: string;
    creatorHandle?: string;
}

export interface ProposalAnalysisMessageOutput {
    analysis: string;
    replyDraft: string;
    suggestionType: 'aceitar' | 'ajustar' | 'aceitar_com_extra';
    suggestedValue: number | null;
}

export async function generateProposalAnalysisMessage(
    input: ProposalAnalysisMessageInput
): Promise<ProposalAnalysisMessageOutput> {
    const fnTag = '[proposalAnalysis v1.0.0]';

    const {
        brandName,
        campaignTitle,
        campaignDescription,
        deliverables,
        offeredBudget,
        currency,
        latestCalculation,
        historicalAverage,
        creatorName,
        creatorHandle,
    } = input;

    const INTERNAL_CURRENCY = 'BRL';
    const offerCurrency = normalizeCurrencyCode(currency) ?? INTERNAL_CURRENCY;

    const formatOfferCurrency = (value: number | undefined | null): string | null => {
        if (typeof value !== 'number' || Number.isNaN(value)) return null;
        return formatCurrencySafely(value, offerCurrency);
    };

    const formatInternalCurrency = (value: number | undefined | null): string | null => {
        if (typeof value !== 'number' || Number.isNaN(value)) return null;
        return formatCurrencySafely(value, INTERNAL_CURRENCY);
    };

    const offeredBudgetValue = typeof offeredBudget === 'number' ? offeredBudget : undefined;
    const justoValue = typeof latestCalculation?.justo === 'number' ? latestCalculation.justo : undefined;
    const estrategicoValue =
        typeof latestCalculation?.estrategico === 'number' ? latestCalculation.estrategico : undefined;
    const premiumValue =
        typeof latestCalculation?.premium === 'number' ? latestCalculation.premium : undefined;
    const historicalAverageValue = typeof historicalAverage === 'number' ? historicalAverage : undefined;

    const budgetFormatted = formatOfferCurrency(offeredBudgetValue);
    const calculationFormatted = formatInternalCurrency(justoValue);
    const estrategicoFormatted = formatInternalCurrency(estrategicoValue);
    const premiumFormatted = formatInternalCurrency(premiumValue);
    const historicalAvgFormatted = formatInternalCurrency(historicalAverageValue);

    const engagementRate =
        typeof latestCalculation?.metrics?.engagement === 'number'
            ? latestCalculation.metrics.engagement
            : null;
    const avgReach =
        typeof latestCalculation?.metrics?.reach === 'number' ? latestCalculation.metrics.reach : null;
    const profileSegment = latestCalculation?.segment || null;

    const formatList = (items: string[]): string => {
        if (items.length === 0) return '';
        if (items.length === 1) return items[0] ?? '';
        if (items.length === 2) return `${items[0] ?? ''} e ${items[1] ?? ''}`.trim();
        const leading = items.slice(0, -1).map((item) => item ?? '');
        const last = items[items.length - 1] ?? '';
        return `${leading.join(', ')} e ${last}`.trim();
    };

    const metricsParts: string[] = [];
    if (typeof engagementRate === 'number') {
        metricsParts.push(
            `engajamento de ${engagementRate.toLocaleString('pt-BR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
            })}%`
        );
    }
    if (typeof avgReach === 'number' && avgReach > 0) {
        metricsParts.push(`alcance médio de ${Math.round(avgReach).toLocaleString('pt-BR')} pessoas`);
    }
    const metricsSnippet = metricsParts.length > 0 ? metricsParts.join(' e ') : null;

    const deliverablesList = Array.isArray(deliverables)
        ? deliverables
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item): item is string => item.length > 0)
        : [];
    const deliverablesText = deliverablesList.length > 0 ? formatList(deliverablesList) : null;

    const normalizedSegment = profileSegment
        ? profileSegment.toString().replace(/[_\-]+/g, ' ').trim().toLowerCase()
        : null;

    const cpmValues = [justoValue, estrategicoValue, premiumValue].filter(
        (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
    );

    let faixaRange: string | null = null;
    if (cpmValues.length > 0 && typeof avgReach === 'number' && avgReach > 0) {
        const totals = cpmValues.map((cpm) => (cpm * avgReach) / 1000);
        const minTotal = Math.min(...totals);
        const maxTotal = Math.max(...totals);
        if (minTotal === maxTotal) {
            faixaRange = formatCurrencySafely(Math.round(minTotal), INTERNAL_CURRENCY);
        } else {
            const minRounded = Math.floor(minTotal / 100) * 100;
            const maxRounded = Math.ceil(maxTotal / 100) * 100;
            faixaRange = `${formatCurrencySafely(minRounded, INTERNAL_CURRENCY)} a ${formatCurrencySafely(maxRounded, INTERNAL_CURRENCY)}`;
        }
    } else if (calculationFormatted && historicalAvgFormatted && calculationFormatted !== historicalAvgFormatted) {
        faixaRange = `${calculationFormatted} a ${historicalAvgFormatted}`;
    } else {
        faixaRange = calculationFormatted ?? historicalAvgFormatted ?? null;
    }

    const faixaRangeText = faixaRange
        ? faixaRange.includes(' a ')
            ? ` (entre ${faixaRange})`
            : ` (${faixaRange})`
        : '';

    let suggestionTargetValue: number | null = null;
    if (typeof justoValue === 'number') {
        suggestionTargetValue =
            typeof avgReach === 'number' && avgReach > 0
                ? (justoValue * avgReach) / 1000
                : justoValue;
    }
    const suggestionTargetRounded =
        suggestionTargetValue !== null
            ? Math.round(suggestionTargetValue / 100) * 100
            : null;
    const suggestionTargetFormatted =
        suggestionTargetRounded !== null
            ? formatCurrencySafely(suggestionTargetRounded, INTERNAL_CURRENCY)
            : null;

    const scenarioThreshold = 7.5;
    let scenario: 'above' | 'within' | 'below' | 'unknown' = 'unknown';

    if (
        offerCurrency === INTERNAL_CURRENCY &&
        typeof offeredBudgetValue === 'number' &&
        typeof justoValue === 'number' &&
        justoValue > 0
    ) {
        const diffPercent = ((offeredBudgetValue - justoValue) / justoValue) * 100;
        if (diffPercent > scenarioThreshold) {
            scenario = 'above';
        } else if (diffPercent < -scenarioThreshold) {
            scenario = 'below';
        } else {
            scenario = 'within';
        }
    } else if (
        offerCurrency === INTERNAL_CURRENCY &&
        typeof offeredBudgetValue === 'number' &&
        typeof historicalAverageValue === 'number' &&
        historicalAverageValue > 0
    ) {
        const diffPercent = ((offeredBudgetValue - historicalAverageValue) / historicalAverageValue) * 100;
        if (diffPercent > scenarioThreshold) {
            scenario = 'above';
        } else if (diffPercent < -scenarioThreshold) {
            scenario = 'below';
        } else {
            scenario = 'within';
        }
    }

    const proposalSnippetParts = [`a proposta da ${brandName}`];
    if (budgetFormatted) proposalSnippetParts.push(`de ${budgetFormatted}`);
    if (deliverablesText) proposalSnippetParts.push(`para ${deliverablesText}`);
    const proposalSnippet = proposalSnippetParts.join(' ');

    const nicheSuffix = normalizedSegment ? ` de ${normalizedSegment}` : '';

    let classificationSentence: string;
    switch (scenario) {
        case 'above':
            classificationSentence = `${proposalSnippet} está acima da faixa de mercado do seu nicho${nicheSuffix}${faixaRangeText}.`;
            break;
        case 'within':
            classificationSentence = `${proposalSnippet} está dentro da faixa de mercado do seu nicho${nicheSuffix}${faixaRangeText}.`;
            break;
        case 'below':
            classificationSentence = `${proposalSnippet} ficou abaixo da faixa de mercado do seu nicho${nicheSuffix}${faixaRangeText}.`;
            break;
        default:
            classificationSentence = `${proposalSnippet} foi avaliada com base nas referências mais recentes disponíveis para o seu perfil.`;
            break;
    }

    const introSentence = metricsSnippet
        ? `Com base no seu desempenho atual (${metricsSnippet}), `
        : 'Com base no seu desempenho atual, ';

    const diagnosisParagraph = `${introSentence}${classificationSentence}`;

    let suggestionSentence: string;
    let suggestionType: 'aceitar' | 'ajustar' | 'aceitar_com_extra';
    switch (scenario) {
        case 'above':
            suggestionSentence =
                'Essa valorização é positiva — mantenha o valor e proponha um extra (por exemplo, um stories adicional) para amplificar o retorno da marca.';
            suggestionType = 'aceitar_com_extra';
            break;
        case 'within':
            suggestionSentence =
                `O investimento está alinhado à faixa de mercado${faixaRangeText} — destaque seus resultados recentes e avance para fechar a campanha com segurança.`;
            suggestionType = 'aceitar';
            break;
        case 'below':
            suggestionSentence = suggestionTargetFormatted
                ? `Sugiro reposicionar o valor em torno de ${suggestionTargetFormatted}, justificando com suas métricas e entregáveis.`
                : faixaRange
                    ? `Sugiro reposicionar o valor para se aproximar da faixa de mercado ${faixaRange}, reforçando seu histórico e a qualidade das entregas.`
                    : 'Sugiro reposicionar o valor, reforçando seus indicadores principais e o escopo completo da entrega.';
            suggestionType = 'ajustar';
            break;
        default:
            suggestionSentence =
                'Reforce seus resultados recentes e proponha um pacote que traduza o valor real da sua entrega.';
            suggestionType = 'ajustar';
            break;
    }

    const analysis = [
        '🧩 Diagnóstico do Mobi',
        diagnosisParagraph,
        '',
        '💡 Sugestão:',
        suggestionSentence,
        '',
        'Quer que eu te ajude a estruturar a resposta?',
    ].join('\n');

    const metricsEmailSnippet = metricsSnippet ?? 'métricas recentes';
    const deliverablesEmailSnippet = deliverablesText ? ` (${deliverablesText})` : '';
    const valueEmailSnippet = budgetFormatted ? `o valor de ${budgetFormatted}` : 'o orçamento sugerido';
    let scenarioEmailSentence: string;
    let scenarioEmailSuggestion: string;
    switch (scenario) {
        case 'above':
            scenarioEmailSentence = 'esse investimento é excelente para potencializar a campanha.';
            scenarioEmailSuggestion =
                'Para aproveitar essa margem, posso incluir um stories extra (ou reforço de bastidores) sem custo adicional.';
            break;
        case 'within':
            scenarioEmailSentence = 'esse investimento está alinhado com o retorno que venho entregando.';
            scenarioEmailSuggestion =
                'Podemos seguir com esse valor e já alinhar roteiro e cronograma para iniciar.';
            break;
        case 'below':
            scenarioEmailSentence = suggestionTargetFormatted
                ? `esse investimento fica próximo do que costumo praticar, mas para esse pacote eu trabalho na faixa de ${suggestionTargetFormatted}, considerando minhas métricas.`
                : 'prefiro ajustar levemente o investimento para equilibrar com o escopo e manter o padrão de entrega.';
            scenarioEmailSuggestion = suggestionTargetFormatted
                ? `Se quiserem o pacote completo, podemos alinhar por ${suggestionTargetFormatted}; assim garanto o resultado que vocês buscam. Caso prefiram manter o orçamento atual, posso adaptar o escopo mantendo consistência.`
                : 'Se fizer sentido, posso sugerir um pequeno ajuste no investimento ou adaptar o escopo mantendo o impacto do plano.';
            break;
        default:
            scenarioEmailSentence = 'esse investimento está alinhado com o que tenho trabalhado recentemente.';
            scenarioEmailSuggestion =
                'Fico à disposição para ajustar qualquer detalhe e seguir com a campanha.';
            break;
    }

    const normalizedHandle =
        creatorHandle && creatorHandle.trim().length > 0
            ? creatorHandle.trim().startsWith('@')
                ? creatorHandle.trim()
                : `@${creatorHandle.trim()}`
            : null;
    const signatureLines = [
        `— ${creatorName?.trim() || 'Seu nome'}`,
        normalizedHandle ? `${normalizedHandle} | via Data2Content` : 'via Data2Content',
    ];

    const emailParagraphs: string[] = [];
    emailParagraphs.push(`Oi, pessoal da ${brandName}! Tudo bem?`);
    emailParagraphs.push(
        campaignTitle
            ? `Vi a proposta “${campaignTitle}”, com investimento de ${valueEmailSnippet}, e ela está super alinhada com o que meu público procura.`
            : `Vi a proposta de ${valueEmailSnippet} e ela está super alinhada com o que meu público procura.`
    );
    emailParagraphs.push(
        `${metricsSnippet ? `Pelas minhas métricas (${metricsEmailSnippet})` : 'Pelas minhas métricas recentes'}${deliverablesText ? ` e pelo formato solicitado${deliverablesEmailSnippet}` : ''
        }, ${scenarioEmailSentence}`
    );
    emailParagraphs.push(scenarioEmailSuggestion);
    emailParagraphs.push('Obrigado pelo contato e parabéns pela iniciativa!');
    emailParagraphs.push(signatureLines.join('\n'));

    const replyDraft = emailParagraphs.join('\n\n').trim();

    const normalizedSuggestedValue =
        suggestionTargetRounded !== null
            ? suggestionTargetRounded
            : typeof offeredBudgetValue === 'number'
                ? offeredBudgetValue
                : null;

    logger.info(`${fnTag} ${brandName}: analysis="${analysis.slice(0, 80)}..." reply="${replyDraft.slice(0, 80)}..."`);
    Sentry.captureMessage(`${fnTag} ${brandName}`, 'info');

    return {
        analysis,
        replyDraft,
        suggestionType,
        suggestedValue: normalizedSuggestedValue,
    };
}


/**
 * Envia uma mensagem ao LLM com Function Calling em modo streaming para a resposta principal.
 * MODIFICADO: Agora espera EnrichedAIContext que pode conter currentAlertDetails.
 */
export function buildSurveyProfileSnippet(user: any) {
    const fieldsUsed: string[] = [];
    const lines: string[] = ['survey_profile:'];
    const pushLine = (key: string, value: string | null | undefined) => {
        if (!value) return;
        lines.push(`  ${key}: ${value}`);
    };
    const priceLabels: Record<string, string> = {
        permuta: 'permuta/sem cobrança',
        '0-500': 'até R$ 500',
        '500-1500': 'R$ 500–1.500',
        '1500-3000': 'R$ 1.500–3.000',
        '3000-5000': 'R$ 3.000–5.000',
        '5000-8000': 'R$ 5.000–8.000',
        '8000-plus': 'R$ 8.000+',
        '3000-plus': 'R$ 3.000+',
    };
    const platformReasonLabels: Record<string, string> = {
        metricas: 'entender métricas',
        'media-kit': 'atualizar mídia kit',
        planejar: 'planejar conteúdo com IA',
        negociar: 'negociar com marcas',
        oportunidades: 'receber oportunidades',
        mentorias: 'suporte em mentorias',
        'posicionamento-marcas': 'posicionar marca para marcas',
        outro: 'outro',
    };
    const nextPlatformLabels: Record<string, string> = {
        tiktok: 'ir para TikTok',
        youtube: 'ir para YouTube',
        outra: 'explorar outra plataforma',
        nenhuma: 'ficar apenas no Instagram',
    };
    const learningStyleLabels: Record<string, string> = {
        videos: 'prefere aprender com vídeo',
        texto: 'prefere texto direto',
        checklist: 'prefere checklist curto',
        aula: 'prefere mini-aulas estruturadas',
    };
    const notificationLabels: Record<string, string> = {
        email: 'avisos por e-mail',
        whatsapp: 'avisos por WhatsApp',
        'in-app': 'avisos no app',
    };
    const pricingFearLabels: Record<string, string> = {
        caro: 'medo de cobrar caro',
        barato: 'medo de cobrar barato',
        justificar: 'medo de não justificar preço',
        amador: 'medo de parecer amador',
        outro: 'outro receio de preço',
    };

    const formatPriceRange = (value: any) => priceLabels[String(value)] || null;
    const formatMonetizationStatus = (value: any) => {
        if (value === 'varias') return 'faz publis com frequência';
        if (value === 'poucas') return 'já fez algumas publis';
        if (value === 'nunca-quero') return 'quer começar publis';
        if (value === 'nunca-sem-interesse') return 'sem interesse em publis agora';
        return null;
    };

    const profile = user?.creatorProfileExtended || {};
    if (user?.creatorContext?.id) {
        fieldsUsed.push('creatorContext');
        pushLine('contexto', String(user.creatorContext.id));
    }
    if (Array.isArray(profile.stage) && profile.stage.length) {
        pushLine('etapa', profile.stage.slice(0, 2).join('/'));
        fieldsUsed.push('stage');
    }
    if (Array.isArray(profile.niches) && profile.niches.length) {
        pushLine('nichos', profile.niches.slice(0, 3).join(', '));
        fieldsUsed.push('niches');
    }
    if (Array.isArray(profile.brandTerritories) && profile.brandTerritories.length) {
        pushLine('territorios_marca', profile.brandTerritories.slice(0, 3).join(', '));
        fieldsUsed.push('brandTerritories');
    }
    if (Array.isArray(profile.mainPains) && profile.mainPains.length) {
        pushLine('dores', profile.mainPains.slice(0, 3).join(', '));
        fieldsUsed.push('pains');
    }
    if (Array.isArray(profile.hasHelp) && profile.hasHelp.length) {
        pushLine('suporte', profile.hasHelp.slice(0, 2).join(', '));
        fieldsUsed.push('helpers');
    }
    if (profile.mainGoal3m) {
        pushLine('meta_3m', profile.mainGoal3m);
        fieldsUsed.push('mainGoal3m');
        if (profile.mainGoal3m === 'outro' && profile.mainGoalOther) {
            pushLine('meta_3m_det', profile.mainGoalOther.slice(0, 80));
            fieldsUsed.push('mainGoalOther');
        }
    }
    if (profile.success12m) {
        pushLine('sucesso_12m', profile.success12m.slice(0, 80));
        fieldsUsed.push('success12m');
    }

    if (Array.isArray(profile.mainPlatformReasons) && profile.mainPlatformReasons.length) {
        const reasons = profile.mainPlatformReasons
            .slice(0, 2)
            .map((r: any) => platformReasonLabels[String(r)] || String(r))
            .join(', ');
        const reasonDetail = profile.reasonOther ? ` (${profile.reasonOther.slice(0, 60)})` : '';
        pushLine('motivo_plataforma', `${reasons}${reasonDetail}`);
        fieldsUsed.push('mainPlatformReasons');
    }

    if (Array.isArray(profile.hardestStage) && profile.hardestStage.length) {
        pushLine('trava', profile.hardestStage.slice(0, 2).join('/'));
        fieldsUsed.push('hardestStage');
    }

    if (Array.isArray(profile.nextPlatform) && profile.nextPlatform.length) {
        const nextLabel = profile.nextPlatform
            .slice(0, 2)
            .map((n: any) => nextPlatformLabels[String(n)] || String(n))
            .join(', ');
        pushLine('proxima_plataforma', nextLabel);
        fieldsUsed.push('nextPlatform');
    }

    if (Array.isArray(profile.dreamBrands) && profile.dreamBrands.length) {
        pushLine('marcas_desejo', profile.dreamBrands.slice(0, 2).join(', '));
        fieldsUsed.push('dreamBrands');
    }

    const monetization = formatMonetizationStatus(profile.hasDoneSponsoredPosts);
    if (monetization) {
        pushLine('publis', monetization);
        fieldsUsed.push('hasDoneSponsoredPosts');
    }

    const avgRange = formatPriceRange(profile.avgPriceRange);
    const bundleRange = formatPriceRange(profile.bundlePriceRange);
    if (avgRange || bundleRange) {
        const priceParts = [];
        if (avgRange) priceParts.push(`unitário ${avgRange}`);
        if (bundleRange) priceParts.push(`pacote ${bundleRange}`);
        pushLine('preco', priceParts.join(' | '));
        fieldsUsed.push('pricingRange');
    }

    if (profile.pricingMethod) {
        pushLine('metodo_preco', profile.pricingMethod);
        fieldsUsed.push('pricingMethod');
    }

    if (profile.pricingFear) {
        const fearLabel = pricingFearLabels[String(profile.pricingFear)] || String(profile.pricingFear);
        const fearDetail = profile.pricingFear === 'outro' && profile.pricingFearOther
            ? ` (${profile.pricingFearOther.slice(0, 80)})`
            : '';
        pushLine('medo_preco', `${fearLabel}${fearDetail}`);
        fieldsUsed.push('pricingFear');
    }

    const learningPrefs = Array.isArray(profile.learningStyles) ? profile.learningStyles : [];
    if (learningPrefs.length) {
        const learning = learningPrefs
            .slice(0, 2)
            .map((l: any) => learningStyleLabels[String(l)] || String(l))
            .join(', ');
        pushLine('aprendizado', learning);
        fieldsUsed.push('learningStyles');
    }

    const notifyPrefs = Array.isArray(profile.notificationPref) ? profile.notificationPref : [];
    if (notifyPrefs.length) {
        const notify = notifyPrefs
            .slice(0, 2)
            .map((n: any) => notificationLabels[String(n)] || String(n))
            .join(', ');
        pushLine('avisos', notify);
        fieldsUsed.push('notificationPref');
    }

    const prefs = user?.userPreferences || {};
    if (Array.isArray(prefs.preferredFormats) && prefs.preferredFormats.length) {
        pushLine('formatos_pref', prefs.preferredFormats.slice(0, 3).join(', '));
        fieldsUsed.push('preferredFormats');
    }
    if (Array.isArray(prefs.dislikedTopics) && prefs.dislikedTopics.length) {
        pushLine('evitar_temas', prefs.dislikedTopics.slice(0, 3).join(', '));
        fieldsUsed.push('dislikedTopics');
    }
    if (prefs.preferredAiTone) {
        pushLine('tom_preferido', prefs.preferredAiTone);
        fieldsUsed.push('preferredAiTone');
    }

    const goals = Array.isArray(user?.userLongTermGoals) ? user.userLongTermGoals : [];
    if (goals.length) {
        const goalTexts = goals.map((g: any) => g?.goal).filter(Boolean).slice(0, 2);
        if (goalTexts.length) {
            pushLine('objetivos_longos', goalTexts.join(' | '));
            fieldsUsed.push('userLongTermGoals');
        }
    }

    const facts = Array.isArray(user?.userKeyFacts) ? user.userKeyFacts : [];
    if (facts.length) {
        const factTexts = facts.map((f: any) => f?.fact).filter(Boolean).slice(0, 3);
        if (factTexts.length) {
            pushLine('fatos', factTexts.join(' | '));
            fieldsUsed.push('userKeyFacts');
        }
    }

    if (fieldsUsed.length === 0) {
        return { snippet: '', fieldsUsed };
    }

    return { snippet: lines.join('\n'), fieldsUsed };
}

export async function askLLMWithEnrichedContext(
    enrichedContext: EnrichedAIContext, // Tipo atualizado para EnrichedAIContext
    incomingText: string,
    intent: DeterminedIntent | 'generate_proactive_alert' // <<< ATUALIZAÇÃO DE TIPO AQUI >>>
): Promise<AskLLMResult> {
    const fnTag = '[askLLMWithEnrichedContext v1.0.8]'; // Versão atualizada
    const { user, historyMessages, userName, dialogueState, currentAlertDetails, intentConfidence, intentLabel, scriptContext } = enrichedContext; // currentAlertDetails agora disponível
    const promptVariant = (enrichedContext as any)?.promptVariant || process.env.PROMPT_VARIANT || 'A';
    const chatContextJson = (enrichedContext as any)?.chatContextJson || null;
    const safeUserName = userName?.trim() || user.name || 'criador';
    const isWebChannel = enrichedContext.channel === 'web';
    const answerEnginePack = (enrichedContext as any)?.answerEnginePack || null;
    const isCardIntent = intent === 'ask_community_inspiration' || intent === 'content_ideas';
    const isScriptIntent =
        intent === 'script_request' ||
        intent === 'humor_script_request' ||
        intent === 'proactive_script_accept';
    const baseFocus = isWebChannel && intent !== 'generate_proactive_alert'
        ? extractQuestionFocus(incomingText, intent)
        : null;
    const questionFocus = baseFocus ? applyIntentContract(baseFocus, intent) : null;
    const lastTopic = dialogueState?.lastResponseContext?.topic || null;
    const lastEntities = dialogueState?.lastResponseContext?.entities || null;
    const requiresTopic =
        intent === 'CONTINUE_PREVIOUS_TOPIC' ||
        intent === 'ASK_CLARIFICATION_PREVIOUS_RESPONSE' ||
        intent === 'REQUEST_METRIC_DETAILS_FROM_CONTEXT';
    const answerSpec = isWebChannel && questionFocus
        ? buildAnswerSpec(questionFocus, answerEnginePack, {
            lastTopic,
            lastEntities,
            requireTopic: requiresTopic,
        })
        : null;
    const skipPertinenceIntents = new Set([
        'greeting',
        'social_query',
        'meta_query_personal',
        'clarification_follow_up',
        'proactive_script_accept',
        'proactive_script_reject',
        'user_confirms_pending_action',
        'user_denies_pending_action',
        'user_stated_preference',
        'user_shared_goal',
        'user_mentioned_key_fact',
        'user_requests_memory_update',
        'script_request',
        'humor_script_request',
    ]);
    const relevanceGate = {
        enabled: Boolean(
            isWebChannel &&
            !isCardIntent &&
            !skipPertinenceIntents.has(intent) &&
            questionFocus &&
            answerSpec
        ),
        spec: answerSpec || undefined,
        focus: questionFocus || undefined,
    };
    if (questionFocus) {
        if (baseFocus && questionFocus.missing.join('|') !== baseFocus.missing.join('|')) {
            logger.info(`${fnTag} IntentContract aplicado. missing_before=${baseFocus.missing.join(',') || 'none'} missing_after=${questionFocus.missing.join(',') || 'none'}`);
        }
        logger.info(`${fnTag} QuestionFocus anchor="${questionFocus.anchor}" type=${questionFocus.type} missing=${questionFocus.missing.join(',') || 'none'} required=${JSON.stringify(questionFocus.required)}`);
    }
    logger.info(`${fnTag} Iniciando para usuário ${user._id} (Nome para prompt: ${safeUserName}). Intenção: ${intent}. Texto: "${incomingText.slice(0, 50)}..." Usando modelo: ${MODEL}`);

    let initialMsgs: ChatCompletionMessageParam[];

    if (relevanceGate.enabled && questionFocus?.needsClarification) {
        const clarification = buildClarifyingResponse(questionFocus);
        const { readable, writable } = new TransformStream<string, string>();
        const writer = writable.getWriter();
        await writer.write(clarification);
        await writer.close();
        const history = [
            ...historyMessages,
            { role: 'user', content: incomingText },
            { role: 'assistant', content: clarification },
        ];
        logger.info(`${fnTag} Clarificacao direta solicitada antes do LLM. missing=${questionFocus.missing.join(',')}`);
        return { stream: readable, historyPromise: Promise.resolve(history) };
    }

    if (intent === 'generate_proactive_alert') {
        logger.info(`${fnTag} Intenção 'generate_proactive_alert' detectada. Usando prompt direto e especializado.`);

        const directAlertPromptTemplate = buildDirectAlertPrompt(safeUserName, incomingText);

        initialMsgs = [{ role: 'system', content: directAlertPromptTemplate }];

    } else {
        // Lógica original para todas as outras intenções
        const systemPrompt = await populateSystemPrompt(user, safeUserName);

        // --- PHASE 2 & 4: INTENT REFINEMENT & LOGIC INJECTION ---

        const lowerText = incomingText.toLowerCase();

        // 1. Monetization Logic (with Anti-Bug Guard)
        const isBugReport = BUG_KEYWORDS.some(kw => lowerText.includes(kw));
        const isMonetizationTopic = !isBugReport && MONETIZATION_KEYWORDS.some(kw => lowerText.includes(kw));

        if (isMonetizationTopic) {
            logger.info(`${fnTag} Tópico de MONETIZAÇÃO detectado. Injetando instruções de Pricing/Business.`);
            initialMsgs = [
                { role: 'system', content: systemPrompt },
                {
                    role: 'system',
                    content: `CONTEXTO DE NEGÓCIOS E PRECIFICAÇÃO:
                    1. O usuário está perguntando sobre valores, parcerias ou estratégia comercial.
                    2. Use o "Mobi Methodology" para explicar como marcas compram (CPM, Alcance, Nicho).
                    3. Se o usuário perguntar "quanto cobrar", NÃO dê um número solto imediatamente. PRIMEIRO pergunte: "Qual a entrega exata (Reels, Stories, Combo)?", "Tem exclusividade?", "Uso de imagem?".
                    4. Se já tiver detalhes, use as faixas de preço do 'PricingKnowledge' e 'adDealInsights' (se disponíveis nos relatórios) para estimar um valor.
                    5. Se não houver dados de 'adDealInsights', use o CPM de mercado para o nicho como base (R$ 30-60 CPM é uma média segura para micro/meso, mas varie conforme engajamento).
                    6. SEMPRE relacione preço com entrega de resultado (Alcance estimado).`
                }
            ];
        } else {
            initialMsgs = [
                { role: 'system', content: systemPrompt },
            ];
        }

        if (isWebChannel && questionFocus) {
            initialMsgs.push({
                role: 'system',
                content: buildQuestionFocusPrompt(questionFocus)
            });
        }

        // 2. Deep Analysis Trigger
        const isDeepAnalysis = DEEP_ANALYSIS_KEYWORDS.some(kw => lowerText.includes(kw));
        if (isDeepAnalysis) {
            logger.info(`${fnTag} Tópico de ANÁLISE PROFUNDA detectado. Injetando instrução de drill-down.`);
            initialMsgs.push({
                role: 'system',
                content: `MODO ANÁLISE PROFUNDA:
                - O usuário quer entender a CAUSA RAIZ de uma performance.
                - NÃO APENAS LISTE NÚMEROS. Analise a RELAÇÃO entre eles.
                - Exemplo: "Muitos comentários mas poucos shares" = Comunidade forte, mas baixo potencial viral (bolha).
                - Exemplo: "Muitos shares mas baixa retenção" = Gancho forte (clickbait?) mas conteúdo não segurou.
                - CRÍTICO: Se estiver analisando um post específico, você DEVE usar a ferramenta 'getMetricDetailsById' para ver a retenção (se disponível) e fontes de tráfego.`
            });
        }

        // 3. Screenwriter Protocol (Script Generation)
        if (isScriptIntent && !intent.includes('proactive')) {
            logger.info(`${fnTag} Intent de ROTEIRO detectado. Injetando protocolo Screenwriter.`);
            initialMsgs.push({
                role: 'system',
                content: `PROTOCOLO ROTEIRISTA ATIVADO:
                1. SEARCH: Use 'fetchCommunityInspirations' (count=3) para encontrar estrutura viral compatível e envie 'narrativeQuery' com o gancho principal do pedido.
                2. ADAPT: Nunca copie. Adapte a estrutura viral para o nicho do usuário.
                3. FORMAT: O output FINAL deve ser estritamente em [ROTEIRO]...[/ROTEIRO] + [LEGENDA]...[/LEGENDA].
                4. REASONING: Quando usar inspiração, explique em 1 linha por que ela foi escolhida.`
            });
        }


        if (chatContextJson) {
            initialMsgs.push({
                role: 'system',
                content: `Contexto estruturado v1 (use para personalizar e não repetir perguntas):\n\`\`\`json\n${chatContextJson}\n\`\`\``
            });
        }

        if (answerEnginePack) {
            const condensedPack = {
                intent: answerEnginePack.intent,
                thresholds: answerEnginePack.policy.thresholds,
                top_posts: answerEnginePack.top_posts.slice(0, 8),
                user_profile: answerEnginePack.user_profile,
                notes: answerEnginePack.notes,
            };
            initialMsgs.push({
                role: 'system',
                content:
                    'PACK DE EVIDÊNCIAS (v1): use apenas estes posts/métricas já validados pelo motor de ranking. ' +
                    'NÃO defina o que é alto engajamento; apenas explique e recomende usando o ranking abaixo. ' +
                    'Se precisar citar posts, use somente os IDs/links listados. ' +
                    'Se o pack estiver vazio, peça autorização para relaxar o critério ou explique a falta de evidências.\n' +
                    `\`\`\`json\n${JSON.stringify(condensedPack, null, 2)}\n\`\`\``,
            });
            initialMsgs.push({
                role: 'system',
                content:
                    'POLÍTICA: Posts fora do pack ou abaixo do threshold não podem ser recomendados. ' +
                    'Sempre cite métricas e o quanto estão acima da mediana do usuário.',
            });
        }

        const hasAnswerEvidence = Array.isArray(answerEnginePack?.top_posts) && answerEnginePack.top_posts.length > 0;

        if (isScriptIntent && scriptContext) {
            const scriptPayload = {
                objectiveHint: scriptContext.objectiveHint || undefined,
                toneHint: scriptContext.toneHint || undefined,
                narrativePreference: scriptContext.narrativePreference || undefined,
                topCategories: scriptContext.topCategories || undefined,
                topPosts: scriptContext.topPosts || undefined,
                communityOptIn: scriptContext.communityOptIn ?? false,
                plannerSignals: scriptContext.plannerSignals || undefined,
            };
            initialMsgs.push({
                role: 'system',
                content:
                    'SCRIPT CONTEXT PACK (USO OBRIGATÓRIO): use estes sinais para orientar o roteiro, gancho e CTA. ' +
                    'As categorias abaixo são do histórico do criador (taxonomia interna). ' +
                    'Se for chamar `fetchCommunityInspirations`, traduza para a taxonomia da comunidade (Proposal/Context/Format/Tone do tool). ' +
                    'Quando o pedido do usuário for genérico (ex.: "o que postar amanhã"), priorize `plannerSignals.themes` como pauta principal e reaproveite padrões narrativos de `plannerSignals.winningCaptions` e `topPosts.captionSnippet`. ' +
                    'NUNCA repita literalmente frases genéricas do usuário como título ou roteiro. ' +
                    'Se narrativePreference=prefer_similar, mantenha estrutura próxima das últimas inspirações aprovadas. ' +
                    'Se narrativePreference=prefer_different, varie gancho e CTA em relação ao padrão anterior. ' +
                    'Se communityOptIn=false, NÃO chame `fetchCommunityInspirations`.\n' +
                    `\`\`\`json\n${JSON.stringify(scriptPayload, null, 2)}\n\`\`\``,
            });
        }

        // Se for canal WEB, adiciona instrução de formatação rica
        if (isWebChannel && !isCardIntent) {
            initialMsgs.push({
                role: 'system',
                content: 'INSTRUÇÃO DE FORMATAÇÃO WEB: Você está respondendo no chat web. Use formatação rica Markdown para melhor didática: use **negrito** para conceitos-chave, listas (bullet points) para passos, e headers (###) para separar seções. Seja visualmente organizado.'
            });
            if (intent === 'content_plan') {
                initialMsgs.push({
                    role: 'system',
                    content:
                        'PLANO ESTRATÉGICO DE CONTEÚDO (DATA-DRIVEN): Além do calendário, forneça conselhos sobre O QUE dizer em cada post e POR QUE aquela abordagem funciona. ' +
                        'PROATIVIDADE DATA-DRIVEN: Antes de finalizar o plano, você DEVE integrar os melhores horários (`TOP_DAY_PCO_COMBOS` e `HOT_TIMES_LAST_ANALYSIS`) e as categorias em alta (`TOP_CATEGORY_RANKINGS`) para garantir que sua sugestão seja fundamentada nos dados reais do criador. ' +
                        'Cite explicitamente quando um dia/tema foi escolhido com base nos dados (ex: "Sugerido para Terça devido ao alto engajamento histórico"). ' +
                        'Para cada sugestão de post, busque ou sugira uma inspiração real da comunidade para ilustrar a ideia. ' +
                        'Mantenha o calendário organizado: use bullets para os dias e mantenha o dia na mesma linha. ' +
                        'Formato recomendado:\n' +
                        '### Semana [X]\n' +
                        '- **[Dia] — [Formato] ([Tema]):** [Descrição curta]. *Por que funciona:* [Explicação baseada em dados ou estratégia].'
                });
            }
        } else if (isWebChannel && isCardIntent) {
            initialMsgs.push({
                role: 'system',
                content: 'IDEIAS EM CARDS (WEB): responda prioritariamente em JSON, no formato {"type":"content_ideas","items":[{"label":"Reel 1","title":"...","description":"...","highlights":["..."],"link":null}],"next_step_question":"Qual dessas ideias quer priorizar?"}. Se não puder JSON, use texto plano curto, sem Markdown (sem ###, ** ou listas).'
            });
        }

        if (isCardIntent) {
            initialMsgs.push({
                role: 'system',
                content: 'Gere 3 ideias não sobrepostas. Cada card deve ter um gancho diferente (ex.: rotina, desafio, antes-e-depois) e incluir um "por que funciona" curto. Não repita variações da mesma ideia.'
            });
            initialMsgs.push({
                role: 'system',
                content: hasAnswerEvidence
                    ? 'Você pode mencionar que as ideias usam exemplos reais apenas se conseguir citar links/permalinks fornecidos. Não invente referências.'
                    : 'Como não há evidências personalizadas fortes (pack vazio ou insuficiente), você DEVE usar a ferramenta `fetchCommunityInspirations` para encontrar exemplos reais da comunidade que ilustrem suas sugestões. Evite dar conselhos puramente teóricos sem buscar referências práticas.'
            });
        }

        // Phase 4: Throttling fetchCommunityInspirations
        // Only explicitly suggest it if user asks or if we really need illustration.
        // The instruction below is general advice provided to the model.
        if (!isCardIntent && !hasAnswerEvidence && !isMonetizationTopic && !isDeepAnalysis) {
            initialMsgs.push({
                role: 'system',
                content: 'Se o usuário pedir exemplos práticos ou se você sentir que a explicação ficou muito abstrata, use `fetchCommunityInspirations` para buscar casos reais. Não use indiscriminadamente para economizar tokens, apenas quando agregar valor visual.'
            });
        }

        if (isScriptIntent) {
            initialMsgs.push({
                role: 'system',
                content:
                    'MODO ROTEIRO (CRÍTICO): responda SOMENTE com 2 blocos, nesta ordem exata: [ROTEIRO]...[/ROTEIRO] e [LEGENDA]...[/LEGENDA]. ' +
                    'IGNORE a estrutura "Diagnóstico/Plano/Próximo Passo" para este caso. ' +
                    'Se faltar tema/produto/assunto, faça UMA pergunta objetiva e pare (não gere roteiro incompleto). ' +
                    'Use formato pedido pelo usuário; se não houver, escolha entre USER_PREFERRED_FORMATS; fallback: Reels. ' +
                    'Infira objetivo principal (educar, engajar, viralizar, converter, autoridade) e mantenha CTA coerente. ' +
                    'No bloco [ROTEIRO], use o contrato abaixo sem inventar seções extras:\n' +
                    '**Título Sugerido:** ...\n' +
                    '**Formato Ideal:** ... | **Duração Estimada:** ...\n' +
                    '(opcional) **Áudio Sugerido:** ...\n' +
                    '(opcional, quando houver inspiração) **Por que essa inspiração:** ...\n' +
                    '| Tempo | Visual (o que aparece) | Fala (o que dizer) |\n' +
                    '| :--- | :--- | :--- |\n' +
                    '| ... |\n' +
                    'REGRAS DA TABELA: mínimo 3 linhas de cena, máximo 6; linha final deve ter CTA explícito. ' +
                    'Se formato for carrossel/foto, adapte para Slides na coluna Visual/Fala. ' +
                    'Se for humor, inclua setup -> conflito -> punchline -> reação na progressão das cenas. ' +
                    'Se houver top_posts no pack, use somente como referência estrutural (nunca copiar frases). ' +
                    'Se communityOptIn=true e dados suficientes, chame fetchCommunityInspirations antes de escrever com count=3 e inclua narrativeQuery com 1 frase do gancho; se faltar contexto para a busca, faça UMA pergunta e pare. ' +
                    'No bloco [LEGENDA], sempre entregar V1, V2 e V3 (1-3 frases cada + 3-6 hashtags). ' +
                    'NÃO adicionar [BUTTON], introduções, conclusões ou texto fora dos blocos.'
            });
        } else {
            // Instruções de estilo e próxima ação — mantém o assistente sempre acionável.
            initialMsgs.push({
                role: 'system',
                content:
                    'ESTILO OBRIGATÓRIO (NÃO NEGOCIÁVEL): Responda diretamente, sem intros. ' +
                    'REQUISITO DE PERTINÊNCIA: Comece o Diagnóstico citando EXATAMENTE o ponto da pergunta do usuário (ex: "Para aumentar seu alcance...", "Sobre sua dúvida de horários..."). ' +
                    'Use EXCLUSIVAMENTE estes headers: ### Diagnóstico (curto), ### Plano Estratégico (passos práticos) e ### Próximo Passo (pergunta acionável). ' +
                    'ANTI-DESVIO: Priorize responder a dúvida central antes de sugerir ações de expansão. ' +
                    'Ao final da resposta, SEMPRE ofereça 2 botões de ação rápida no formato: `[BUTTON: ...]` com rótulos específicos do contexto (nunca use placeholders genéricos).'
            });
        }
        initialMsgs.push({
            role: 'system',
            content:
                'Use dados declarados pelo criador (pesquisa/onboarding) como primeira camada de contexto. Priorize preferências, metas e dores informadas pelo usuário antes de sugerir ações.'
        });

        // Variantes de prompt para experimentação (A/B/C)
        if (promptVariant === 'A') {
            initialMsgs.push({
                role: 'system',
                content: 'VARIANTE A (Objetiva): Responda com BLUF na primeira frase + 3-5 passos acionáveis. Evite parágrafos longos.'
            });
        } else if (promptVariant === 'B') {
            initialMsgs.push({
                role: 'system',
                content: 'VARIANTE B (Didática): Estruture em passo a passo numerado ou checklist curto conforme o tema. Explique o porquê em 1 linha por passo.'
            });
        } else if (promptVariant === 'C') {
            initialMsgs.push({
                role: 'system',
                content: 'VARIANTE C (Consultor): Se contexto for fraco ou dúvida ampla, faça 1-2 perguntas de diagnóstico curtas antes do plano. Depois, entregue um plano resumido.'
            });
        }

        // Preferências salvas no diálogo (evita variação entre turnos)
        const surveyPrefs = (dialogueState as any)?.surveyPrefs;
        if (surveyPrefs && typeof surveyPrefs === 'object') {
            const lines: string[] = ['survey_profile_runtime:'];
            const pushLine = (k: string, v: string | null | undefined) => { if (v) lines.push(`  ${k}: ${v}`); };
            if (Array.isArray(surveyPrefs.stage) && surveyPrefs.stage.length) pushLine('etapa', surveyPrefs.stage.slice(0, 2).join('/'));
            if (Array.isArray(surveyPrefs.niches) && surveyPrefs.niches.length) pushLine('nichos', surveyPrefs.niches.slice(0, 3).join(', '));
            if (surveyPrefs.mainGoal3m) pushLine('meta_3m', surveyPrefs.mainGoal3m);
            if (Array.isArray(surveyPrefs.mainPlatformReasons) && surveyPrefs.mainPlatformReasons.length) pushLine('motivo_plataforma', surveyPrefs.mainPlatformReasons.slice(0, 2).join(', '));
            if (Array.isArray(surveyPrefs.nextPlatform) && surveyPrefs.nextPlatform.length) pushLine('proxima_plataforma', surveyPrefs.nextPlatform.slice(0, 2).join(', '));
            if (surveyPrefs.pricingFear) pushLine('medo_preco', surveyPrefs.pricingFear);
            if (Array.isArray(surveyPrefs.learningStyles) && surveyPrefs.learningStyles.length) pushLine('aprendizado', surveyPrefs.learningStyles.slice(0, 2).join(', '));
            initialMsgs.push({
                role: 'system',
                content: `Preferências declaradas (use antes de sugerir qualquer plano):\n\`\`\`yaml\n${lines.join('\n')}\n\`\`\``
            });

            // Formatos de resposta conforme estilo de aprendizado
            const learningPref: string | null = Array.isArray(surveyPrefs.learningStyles) ? surveyPrefs.learningStyles[0] ?? null : null;
            if (learningPref === 'checklist') {
                initialMsgs.push({
                    role: 'system',
                    content: 'FORMATO: entregue em checklist enxuto (3-6 bullets), cada bullet com verbo de ação. Evite parágrafos longos.'
                });
            } else if (learningPref === 'aula') {
                initialMsgs.push({
                    role: 'system',
                    content: 'FORMATO: estruture como mini-aula com 2-3 seções (###) e passos curtos. Abra com o que fazer agora.'
                });
            } else if (learningPref === 'videos') {
                initialMsgs.push({
                    role: 'system',
                    content: 'FORMATO: use passos numerados curtos + 1 exemplo prático. Mantenha cada passo em 1-2 frases.'
                });
            } else if (learningPref === 'texto') {
                initialMsgs.push({
                    role: 'system',
                    content: 'FORMATO: responda em 2-3 parágrafos curtos com uma lista final de próximos passos.'
                });
            }
        }

        if (typeof intentConfidence === 'number' && intentConfidence < 0.5) {
            initialMsgs.push({
                role: 'system',
                content: `A confiança na intenção detectada (${intentLabel || intent}) está baixa (${Math.round(intentConfidence * 100)}%). Priorize pedir esclarecimento curto antes de executar planos longos.`
            });
        }

        // Dados declarados do criador (perfil, metas, fatos) para respostas mais personalizadas.
        const buildUserContextSnippets = () => {
            const snippets: string[] = [];
            const creatorProfile = (user as any)?.creatorProfileExtended || {};
            if (Array.isArray(creatorProfile.stage) && creatorProfile.stage.length) {
                snippets.push(`Etapa: ${creatorProfile.stage.join('/')}`);
            }
            if (Array.isArray(creatorProfile.niches) && creatorProfile.niches.length) {
                snippets.push(`Nichos: ${creatorProfile.niches.slice(0, 3).join(', ')}`);
            }
            if (creatorProfile.mainGoal3m) {
                snippets.push(`Meta 3m: ${creatorProfile.mainGoal3m}`);
            }
            const preferences = (user as any)?.userPreferences;
            if (preferences?.preferredFormats?.length) {
                snippets.push(`Prefere formatos: ${preferences.preferredFormats.slice(0, 3).join(', ')}`);
            }
            if (preferences?.dislikedTopics?.length) {
                snippets.push(`Evitar temas: ${preferences.dislikedTopics.slice(0, 3).join(', ')}`);
            }
            if (preferences?.preferredAiTone) {
                snippets.push(`Tom desejado: ${preferences.preferredAiTone}`);
            }
            const longTermGoals = Array.isArray((user as any)?.userLongTermGoals) ? (user as any).userLongTermGoals : [];
            if (longTermGoals.length) {
                const goals = longTermGoals
                    .map((g: any) => g?.goal)
                    .filter(Boolean)
                    .slice(0, 2);
                if (goals.length) snippets.push(`Objetivos declarados: ${goals.join(' | ')}`);
            }
            const keyFacts = Array.isArray((user as any)?.userKeyFacts) ? (user as any).userKeyFacts : [];
            if (keyFacts.length) {
                const facts = keyFacts
                    .map((f: any) => f?.fact)
                    .filter(Boolean)
                    .slice(0, 3);
                if (facts.length) snippets.push(`Fatos relevantes: ${facts.join(' | ')}`);
            }
            return snippets;
        };

        const userContextSnippets = buildUserContextSnippets();
        const surveyProfile = buildSurveyProfileSnippet(user);
        const surveySnippet = surveyProfile.snippet;

        if (userContextSnippets.length || surveySnippet) {
            initialMsgs.push({
                role: 'system',
                content: `Dados conhecidos do criador para personalizar a resposta:\n${[...userContextSnippets].join(' • ')}${userContextSnippets.length && surveySnippet ? '\n' : ''}${surveySnippet ? `\n\`\`\`yaml\n${surveySnippet}\n\`\`\`` : ''}`
            });
            logger.info(`${fnTag} Perfil da pesquisa aplicado ao prompt. fieldsUsed=${surveyProfile.fieldsUsed.join(',') || 'none'}`);
        }
        if (!surveySnippet || surveyProfile.fieldsUsed.length < 2) {
            initialMsgs.push({
                role: 'system',
                content: 'Faltam preferências detalhadas (tom, formatos, metas). Faça UMA pergunta curta para completar antes de dar planos longos.'
            });
        }

        // Aplicação direta de preferências em runtime (tom e formatos).
        const prefsForRuntime = (user as any)?.userPreferences || {};
        if (prefsForRuntime.preferredAiTone) {
            initialMsgs.push({
                role: 'system',
                content: `Adapte o TOM para: ${prefsForRuntime.preferredAiTone} (sem perder clareza).`
            });
        }
        const prefFormats = Array.isArray(prefsForRuntime.preferredFormats)
            ? prefsForRuntime.preferredFormats.filter(Boolean).slice(0, 3)
            : [];
        const disliked = Array.isArray(prefsForRuntime.dislikedTopics)
            ? prefsForRuntime.dislikedTopics.filter(Boolean).slice(0, 3)
            : [];
        if (prefFormats.length || disliked.length) {
            const parts: string[] = [];
            if (prefFormats.length) parts.push(`priorize formatos: ${prefFormats.join(', ')}`);
            if (disliked.length) parts.push(`evite temas: ${disliked.join(', ')}`);
            initialMsgs.push({
                role: 'system',
                content: `Guia rápido de preferências do criador: ${parts.join(' | ')}`
            });
        }

        // Instruções condicionais derivadas da survey (runtime).
        const profileExt: any = (user as any)?.creatorProfileExtended || {};
        const hardestStage = Array.isArray(profileExt.hardestStage) ? profileExt.hardestStage[0] : null;
        if (hardestStage) {
            initialMsgs.push({
                role: 'system',
                content: `Direcione a resposta para destravar o estágio mais travado: ${hardestStage}. Seja específico e dê 1 próximo passo.`
            });
        }
        const mainReason = Array.isArray(profileExt.mainPlatformReasons) ? profileExt.mainPlatformReasons[0] : null;
        if (mainReason) {
            const mainReasonLabel: Record<string, string> = {
                metricas: 'entender métricas',
                'media-kit': 'atualizar mídia kit',
                planejar: 'planejar conteúdo',
                negociar: 'negociação com marcas',
                oportunidades: 'receber oportunidades',
                mentorias: 'ter suporte/mentoria',
                'posicionamento-marcas': 'posicionar a marca para marcas',
                outro: 'outro motivo',
            };
            initialMsgs.push({
                role: 'system',
                content: `Objetivo principal do criador na plataforma: ${mainReasonLabel[mainReason] || mainReason}. Mantenha esse desfecho como foco ao sugerir ações.`
            });
        }
        const pricingFear = profileExt.pricingFear;

        if (pricingFear) {
            initialMsgs.push({
                role: 'system',
                content: 'Ao falar de preço/negociação, traga 1 âncora de valor e uma frase de justificativa curta para reduzir insegurança do criador.'
            });
        }
        const learningPref = Array.isArray(profileExt.learningStyles) ? profileExt.learningStyles[0] : null;
        if (learningPref) {
            initialMsgs.push({
                role: 'system',
                content: `Adapte o formato da resposta para o estilo de aprendizado preferido(${learningPref}): mantenha a estrutura clara e enxuta.`
            });
        }
        const nextPlatformPref = Array.isArray(profileExt.nextPlatform) ? profileExt.nextPlatform[0] : null;
        if (nextPlatformPref && nextPlatformPref !== 'nenhuma') {
            const nextLabelMap: Record<string, string> = {
                tiktok: 'TikTok',
                youtube: 'YouTube',
                outra: 'outro canal',
            };
            initialMsgs.push({
                role: 'system',
                content: `Inclua 1 ação que ajude a expandir para ${nextLabelMap[nextPlatformPref] || nextPlatformPref}(se fizer sentido para o tema).`
            });
        }

        // Histórico rápido de alertas/insights recentes (fallbacks) para dar cor ao contexto.
        const recentFallbacks = dialogueState?.fallbackInsightsHistory;
        if (Array.isArray(recentFallbacks) && recentFallbacks.length) {
            const formatElapsed = (ts: number) => {
                const diffMinutes = Math.max(0, Date.now() - ts) / 60000;
                if (diffMinutes < 60) return `${Math.round(diffMinutes)}min`;
                if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)}h`;
                return `${Math.round(diffMinutes / 1440)}d`;
            };
            const fallbackSnippet = recentFallbacks
                .slice(-3)
                .map((f: any) => `${f.type ?? 'alerta'}(${f.timestamp ? formatElapsed(Number(f.timestamp)) : 'recente'})`)
                .join(' • ');
            if (fallbackSnippet) {
                initialMsgs.push({
                    role: 'system',
                    content: `Alertas / insights recentes do Radar: ${fallbackSnippet}`
                });
            }
        }

        // Hints contextuais curtos para orientar a LLM sem inflar muito o histórico.
        const contextualHints: string[] = [];
        const lastCtx = dialogueState?.lastResponseContext;
        if (dialogueState?.currentTask?.name) {
            contextualHints.push(
                `Tarefa atual: ${dialogueState.currentTask.name} ` +
                (dialogueState.currentTask.objective ? ` — objetivo: ${dialogueState.currentTask.objective} ` : '')
            );
        }
        if (lastCtx?.topic) {
            contextualHints.push(`Último tópico da IA: ${lastCtx.topic} `);
        }
        if (lastCtx?.entities?.length) {
            contextualHints.push(`Entidades recentes: ${lastCtx.entities.slice(0, 4).join(', ')} `);
        }
        if (dialogueState?.pendingActionContext) {
            contextualHints.push('Há uma ação pendente aguardando confirmação do usuário.');
        }
        if (contextualHints.length) {
            initialMsgs.push({
                role: 'system',
                content: `Contexto curto da sessão: ${contextualHints.join(' | ')} `
            });
        }

        // Se houver resumo de conversa no estado, adiciona como mensagem de sistema para reduzir contexto
        try {
            const summary = (enrichedContext as any)?.dialogueState?.conversationSummary as string | undefined;
            if (summary && typeof summary === 'string' && summary.trim().length > 0) {
                initialMsgs.push({ role: 'system', content: `Resumo da conversa até agora: \n${summary.trim()} ` });
            }
        } catch {/* ignore */ }

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
            logger.debug(`${fnTag} processTurn concluído com sucesso.Fechando writer.`);
            writer.close();
            resolveHistoryPromise(finalHistory);
        })
        .catch(async (error) => {
            logger.error(`${fnTag} Erro durante processTurn: `, error);
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
                logger.error(`${fnTag} Erro ao escrever erro / abortar writer: `, abortError);
            }
        });

    logger.debug(`${fnTag} Retornando stream e historyPromise imediatamente.`);
    return { stream: readable, historyPromise };

    // ============================================================
    // Funcoes auxiliares para pertinencia (web)
    // ============================================================
    async function rewriteForRelevance(original: string, issues: string[]): Promise<string | null> {
        if (!relevanceGate.focus || !relevanceGate.spec) return null;
        const allowed = relevanceGate.spec.evidence
            ? {
                allowed_ids: relevanceGate.spec.evidence.allowedIds,
                allowed_urls: relevanceGate.spec.evidence.allowedUrls,
            }
            : { allowed_ids: [], allowed_urls: [] };
        const needsEvidenceDisclaimer = issues.some((issue) =>
            issue === 'metric_number_without_evidence' ||
            issue === 'strong_claim_without_evidence' ||
            issue === 'recommendation_without_evidence'
        );
        const requirements = [
            relevanceGate.spec.requiredMentions.length ? `obrigatorio mencionar: ${relevanceGate.spec.requiredMentions.join(', ')}` : null,
            relevanceGate.spec.requiredAnyOf.length
                ? `inclua pelo menos um termo de cada grupo: ${relevanceGate.spec.requiredAnyOf.map((g) => g.join(' | ')).join(' ; ')}`
                : null,
        ].filter(Boolean).join(' | ');

        const rewriteMessages: ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content:
                    'Voce e um revisor de pertinencia. Reescreva a resposta para cobrir a pergunta central logo na primeira frase. ' +
                    'Mantenha a resposta direta, sem intro, e use os headers: ### Diagnostico, ### Plano Estrategico, ### Proximo Passo. ' +
                    'Finalize com 2 botoes no formato [BUTTON: ...]. Nao invente evidencias. ' +
                    (needsEvidenceDisclaimer ? 'Se nao houver evidencias suficientes, diga isso explicitamente e faca 1 pergunta direta.' : '')
            },
            {
                role: 'user',
                content:
                    `Pergunta do usuario: "${incomingText}"\n` +
                    `Pergunta central (anchor): "${relevanceGate.focus.anchor}"\n` +
                    `Requisitos: ${requirements || 'nenhum'}\n` +
                    `Evidencias permitidas (ids/urls): ${JSON.stringify(allowed)}\n` +
                    `Problemas detectados: ${issues.join(', ') || 'nenhum'}\n\n` +
                    `Resposta atual:\n${original}`
            }
        ];

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL,
                temperature: 0.2,
                max_tokens: Math.min(TOKENS, 900),
                stream: false,
                messages: rewriteMessages,
            });
            const content = completion.choices?.[0]?.message?.content?.trim();
            return content || null;
        } catch (err) {
            logger.warn(`${fnTag} Falha ao reescrever por pertinencia:`, err);
            return null;
        }
    }

    async function applyRelevanceGate(answer: string) {
        if (!relevanceGate.spec || !relevanceGate.focus) {
            return { finalContent: answer, validation: { passed: true, score: 100, issues: [] }, rewritten: false };
        }

        const validation = validateRelevance(answer, relevanceGate.spec);
        logger.info(`${fnTag} Pertinencia check: intent=${intent} anchor="${relevanceGate.focus.anchor}" passed=${validation.passed} score=${validation.score} issues=${validation.issues.join('|') || 'none'}`);

        if (validation.passed) {
            return { finalContent: answer, validation, rewritten: false };
        }

        logger.info(`${fnTag} Pertinencia falhou, tentando reescrita.`);
        const rewritten = await rewriteForRelevance(answer, validation.issues);
        if (rewritten) {
            const secondPass = validateRelevance(rewritten, relevanceGate.spec);
            logger.info(`${fnTag} Pertinencia recheck: passed=${secondPass.passed} score=${secondPass.score} issues=${secondPass.issues.join('|') || 'none'}`);
            if (secondPass.passed) {
                return { finalContent: rewritten, validation: secondPass, rewritten: true };
            }
        }

        logger.info(`${fnTag} Pertinencia ainda falhou, retornando clarificacao.`);
        const clarification = buildClarifyingResponse(relevanceGate.focus);
        return { finalContent: clarification, validation, rewritten: false };
    }

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
        const shouldBufferOutput = Boolean(relevanceGate.enabled && relevanceGate.spec && relevanceGate.focus);
        logger.debug(`${turnTag} Iniciando.Intenção atual do turno: ${currentIntent}`);

        if (iter >= MAX_ITERS) {
            logger.warn(`${turnTag} Function - call loop excedeu MAX_ITERS(${MAX_ITERS}).`);
            const maxIterMessage = `Desculpe, parece que estou tendo dificuldades em processar sua solicitação após várias tentativas.Poderia tentar de outra forma ? `;
            currentMsgs.push({ role: 'assistant', content: maxIterMessage });
            try { await writer.write(maxIterMessage); }
            catch (e) { logger.error(`${fnTag} Erro ao escrever msg de MAX_ITERS: `, e); }
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
            logger.info(`${turnTag} Intenção '${currentIntent}' é leve.Function calling desabilitado.`);
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
            logger.debug(`${turnTag} Chamando OpenAI API(Modelo: ${requestPayload.model}, Histórico: ${requestPayload.messages.length} msgs).Function calling: ${(requestPayload as any).function_call ?? 'omitido'}, Functions count: ${(requestPayload as any).functions?.length ?? 'omitido'} `);
            completionStream = await openai.chat.completions.create(
                requestPayload,
                { signal: aborter.signal }
            );
        } catch (error: any) {
            clearTimeout(timeout);
            logger.error(`${turnTag} Falha na chamada à API OpenAI.Error Name: ${error.name}, Message: ${error.message}. Full Error Object: `, error);
            const apiCallFailMessage = "Desculpe, não consegui conectar com o serviço de IA no momento. Tente mais tarde.";
            currentMsgs.push({ role: 'assistant', content: apiCallFailMessage });
            try { await writer.write(apiCallFailMessage); }
            catch (e) { logger.error(`${fnTag} Erro ao escrever msg de falha da API: `, e); }
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
                    if (!shouldBufferOutput) {
                        try { await writer.write(delta.content); }
                        catch (writeError) { logger.error(`${turnTag} Erro ao escrever no writer: `, writeError); throw writeError; }
                    }
                }

                if (choice.finish_reason) { lastFinishReason = choice.finish_reason; logger.debug(`${turnTag} Recebido finish_reason: ${lastFinishReason} `); }
            }
            logger.debug(`${turnTag} Fim do consumo do stream da API.Último Finish Reason: ${lastFinishReason} `);
        } catch (streamError: any) {
            logger.error(`${turnTag} Erro durante o consumo do stream: `, streamError);
            const streamErrMessage = "Desculpe, houve um problema ao receber a resposta da IA. Tente novamente.";
            if (pendingAssistantMsg && typeof pendingAssistantMsg.content === 'string') {
                pendingAssistantMsg.content += `\n${streamErrMessage} `;
            } else {
                pendingAssistantMsg = { role: 'assistant', content: streamErrMessage };
            }
            currentMsgs.push(pendingAssistantMsg);
            try { await writer.write(`\n${streamErrMessage} `); }
            catch (e) { logger.error(`${turnTag} Erro ao escrever msg de erro de stream: `, e); }
            return currentMsgs;
        } finally {
            clearTimeout(timeout);
        }

        if (!streamReceivedContent && lastFinishReason !== 'stop' && lastFinishReason !== 'length' && lastFinishReason !== 'function_call') {
            logger.error(`${turnTag} Stream finalizado sem conteúdo útil e com finish_reason inesperado: ${lastFinishReason} `);
            const noContentMessage = "A IA não forneceu uma resposta utilizável desta vez. Poderia tentar novamente?";
            currentMsgs.push({ role: 'assistant', content: noContentMessage });
            try { await writer.write(noContentMessage); }
            catch (e) { logger.error(`${fnTag} Erro ao escrever msg de 'sem conteúdo útil': `, e); }
            return currentMsgs;
        }
        if (pendingAssistantMsg) {
            if (functionCallName || functionCallArgs) {
                if (isLightweightIntent) {
                    logger.warn(`${turnTag} IA tentou function call(${functionCallName}) para intent leve('${currentIntent}'), mas os parâmetros de função não foram enviados.Ignorando a chamada de função e tratando como texto.`);
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
                    logger.warn(`${turnTag} Mensagem assistente finalizada sem conteúdo / function call.Finish Reason: ${lastFinishReason}. Content será null / vazio.`);
                }
            }

            if (!pendingAssistantMsg.function_call && shouldBufferOutput && typeof pendingAssistantMsg.content === 'string') {
                const gated = await applyRelevanceGate(pendingAssistantMsg.content);
                pendingAssistantMsg.content = gated.finalContent;
                try { await writer.write(pendingAssistantMsg.content); }
                catch (writeError) { logger.error(`${turnTag} Erro ao escrever resposta validada: `, writeError); }
            }
            currentMsgs.push(pendingAssistantMsg as ChatCompletionAssistantMessageParam);
        } else if (lastFinishReason === 'stop' || lastFinishReason === 'length') {
            logger.warn(`${turnTag} Stream finalizado(${lastFinishReason}) mas sem delta de assistente.Adicionando msg de assistente vazia de fallback.`);
            currentMsgs.push({ role: 'assistant', content: '' });
        } else if (!functionCallName && lastFinishReason !== 'function_call') {
            logger.error(`${turnTag} Estado inesperado no final do processamento do stream.Finish Reason: ${lastFinishReason}, sem function call name.`);
        }

        if (pendingAssistantMsg?.function_call && !isLightweightIntent) {
            const { name, arguments: rawArgs } = pendingAssistantMsg.function_call;
            logger.info(`${turnTag} API solicitou Function Call: ${name}. Args RAW: ${rawArgs.slice(0, 100)}...`);

            if (name === lastFnName && iter > 1) {
                logger.warn(`${turnTag} Loop de função(após uma tentativa de correção) detectado e prevenido: ${name} chamada novamente.`);
                const loopErrorMessage = `Ainda estou tendo dificuldades com a função '${name}' após tentar corrigi - la.Poderia reformular sua solicitação ou focar em outro aspecto ? `;
                currentMsgs.push({ role: 'assistant', content: loopErrorMessage });
                try {
                    const lastMessageInHistory = currentMsgs[currentMsgs.length - 2];
                    if (!(lastMessageInHistory?.role === 'assistant' && lastMessageInHistory.content)) {
                        await writer.write(loopErrorMessage);
                    }
                }
                catch (writeError) { logger.error(`${turnTag} Erro ao escrever mensagem de loop detectado no writer: `, writeError); }
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
                            logger.error(`${turnTag} Erro ao executar a função "${name}": `, execError);
                            functionResult = { error: `Erro interno ao executar a função ${name}: ${execError.message || String(execError)} ` };
                        }
                    } else {
                        logger.warn(`${turnTag} Erro de validação Zod para args da função "${name}": `, validationResult.error.format());
                        const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.') || 'argumento'}: ${e.message} `).join('; ');
                        functionResult = { error: `Argumentos inválidos para a função ${name}.Detalhes: ${errorMessages} ` };
                    }
                } catch (parseError) {
                    logger.error(`${turnTag} Erro JSON.parse dos args para "${name}": ${rawArgs} `, parseError);
                    functionResult = { error: `Argumentos inválidos para ${name}. Esperava formato JSON.` };
                }
            }

            currentMsgs.push({ role: 'function', name: name, content: JSON.stringify(functionResult) });
            logger.debug(`${turnTag} Histórico antes da recursão(iter ${iter + 1}, ${currentMsgs.length} msgs).`);
            // Passando currentEnrichedContext para a chamada recursiva
            return processTurn(currentMsgs, iter + 1, name, writer, currentUser, currentIntent, currentEnrichedContext);
        } else if (pendingAssistantMsg?.function_call && isLightweightIntent) {
            logger.warn(`${turnTag} Function call recebida para intent leve '${currentIntent}', mas foi ignorada pois os parâmetros de função não foram enviados à API.`);
        }

        logger.debug(`${turnTag} Turno concluído sem chamada de função processada(ou para intent leve).`);
        return currentMsgs;
    } // Fim da função processTurn
}
