// @/app/lib/consultantService.ts - v3.4 CORRIGIDO (Build Fix)

// <<< IMPORTANTE: Backfill de Dados Históricos >>> // (Mantido)
// =======================================================

import { Model, Types } from "mongoose";
import User, { IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";

// Importa as funções e tipos ATUALIZADOS v3.4 do reportHelpers
import {
    buildAggregatedReport,
    AggregatedReport, // Interface que agora inclui proposalStats e contextStats
    DurationStat,
    OverallStats,
    DetailedContentStat,
    ProposalStat,      // <-- Importado
    ContextStat,       // <-- Importado
    ReportAggregationError,
    DetailedStatsError
} from "@/app/lib/reportHelpers"; // Presume que reportHelpers v3.4 está no local correto

import {
    BaseError, UserNotFoundError, MetricsNotFoundError,
    AIError, CacheError, DatabaseError
} from "@/app/lib/errors";

import { callOpenAIForQuestion } from "@/app/lib/aiService";
import { subDays } from "date-fns";
import opossum from "opossum";
import { logger } from '@/app/lib/logger';
import { createClient } from "redis";

// ====================================================
// Função Auxiliar de Normalização de Texto
// ====================================================
function normalizeText(text: string | undefined | null): string {
    if (!text) return "";
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// ====================================================
// Constantes de Configuração e Palavras-chave (v3.4)
// ====================================================
const METRICS_FETCH_DAYS_LIMIT = 180;
const CONTENT_METRICS_LIMIT = 10;
const GREETING_RECENCY_THRESHOLD_MINUTES = 15;
const HISTORY_RAW_LINES_LIMIT = 10;
const DETAILED_STATS_LIMIT_FOR_PROMPT = 7;
const RANKING_LIMIT = 5;

// Constantes de Cache e TTL
const REDIS_CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const REDIS_STATE_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;

// ====================================================
// Constantes de Palavras-chave (v3.4)
// ====================================================
// (POSITIVE, NEGATIVE, GREETING, BEST_TIME, JUSTIFICATION, FEEDBACK mantidas)
const POSITIVE_SENTIMENT_KEYWORDS = ["bom", "ótimo", "legal", "gostei", "excelente", "feliz", "aumentou", "cresceu", "sim", "curti", "ajudou", "obrigado", "obrigada", "aplicável", "útil", "util"];
const NEGATIVE_SENTIMENT_KEYWORDS = ["ruim", "péssimo", "triste", "problema", "difícil", "caiu", "diminuiu", "preocupado", "não", "nao", "confuso", "perdi", "piorou", "inválido", "genérico"];
const GREETING_KEYWORDS = ["oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite", "e aí", "eae"];
const BEST_TIME_KEYWORDS = ["melhor dia", "melhor hora", "melhor horário", "qual dia", "qual hora", "qual horário", "quando postar", "frequência", "cadência"];
const JUSTIFICATION_KEYWORDS = ["por que", "porque", "pq", "justifica", "explica", "baseado em", "como assim", "detalha", "qual a lógica", "fundamento", "embase", "embasar"];
const FEEDBACK_POSITIVE_KEYWORDS = ["sim", "gostei", "útil", "util", "aplicável", "ajudou", "boa"];
const FEEDBACK_NEGATIVE_KEYWORDS = ["não", "nao"];
const FEEDBACK_NEUTRAL_RESPONSE_WORDS = ["não", "nao"];

// Keywords para diferentes intenções
const REQUEST_KEYWORDS = ["métrica", "dado", "ajuda", "info", "relatório", "resumo", "plano", "performance", "número", "analisa", "analise", "visão geral", "detalhado", "completo", "estratégia", "postar", "ideia", "conteúdo", "sugestão", "justifica", "explica", "detalha", "métricas", "por que", "melhor dia", "melhor hora", "formato", "proposta", "contexto"];
const CONTENT_IDEAS_KEYWORDS = [ "ideia", "conteúdo", "sugestão de post", "sugestões de post", "sugere", "sugestão", "o que postar", "inspiração", "exemplos de posts", "dicas de conteúdo", "ideias criativas" ];
const REPORT_KEYWORDS = ["relatório", "relatorio", "plano", "estratégia", "detalhado", "completo"];
const CONTENT_PLAN_KEYWORDS = ["planejamento", "plano de conteudo", "agenda de posts", "calendario editorial", "o que postar essa semana", "sugestao de agenda", "me da um plano", "cria um plano"];
const RANKING_KEYWORDS = ["ranking", "top", "melhores", "piores", "classificação", "quais performam", "performam melhor", "performam pior", "lista de"];
const METRIC_KEYWORDS = ["compartilhamentos", "compartilhamento", "salvamentos", "salvos", "alcance", "visualizações", "views", "curtidas", "likes", "comentarios", "engajamento"];
const GROUPING_KEYWORDS = ["proposta", "propostas", "contexto", "contextos", "formato", "formatos", "combinacao", "combinações"];

// Normalizadas
const NORMALIZED_REQUEST_KEYWORDS = REQUEST_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_IDEAS_KEYWORDS = CONTENT_IDEAS_KEYWORDS.map(normalizeText);
const NORMALIZED_BEST_TIME_KEYWORDS = BEST_TIME_KEYWORDS.map(normalizeText);
const NORMALIZED_JUSTIFICATION_KEYWORDS = JUSTIFICATION_KEYWORDS.map(normalizeText);
const NORMALIZED_REPORT_KEYWORDS = REPORT_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS = FEEDBACK_POSITIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS = FEEDBACK_NEGATIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_PLAN_KEYWORDS = CONTENT_PLAN_KEYWORDS.map(normalizeText);
const NORMALIZED_RANKING_KEYWORDS = RANKING_KEYWORDS.map(normalizeText);
const NORMALIZED_METRIC_KEYWORDS = METRIC_KEYWORDS.map(normalizeText);
const NORMALIZED_GROUPING_KEYWORDS = GROUPING_KEYWORDS.map(normalizeText);

// ====================================================
// Interfaces e Tipos (v3.4)
// ====================================================
type IAggregatedStats = object;
interface IGrowthComparisons { /* ... */ }
interface IGrowthDataResult { /* ... */ }
interface ReportDataInput { user: IUser; dailyMetricModel: Model<IDailyMetric>; contentMetricModel: Model<IMetric>; }

interface IEnrichedReport {
    overallStats?: OverallStats;
    profileSegment: string; multimediaSuggestion: string;
    top3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    bottom3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[];
    proposalStats?: ProposalStat[];
    contextStats?: ContextStat[];
    historicalComparisons?: IGrowthComparisons; longTermComparisons?: IGrowthComparisons;
}
interface PreparedData { enrichedReport: IEnrichedReport; }
interface IDialogueState { lastInteraction?: number; lastGreetingSent?: number; }

// ====================================================
// Redis: Inicialização e Funções de Cache (Sem alterações)
// ====================================================
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
let redisInitialized = false; let isConnecting = false;
redisClient.on('error', (err: Error) => { logger.error('[Redis] Erro:', err); redisInitialized = false; });
redisClient.on('connect', () => { logger.info('[Redis] Conectando...'); });
redisClient.on('ready', () => { logger.info('[Redis] Conectado.'); redisInitialized = true; isConnecting = false; });
redisClient.on('end', () => { logger.warn('[Redis] Conexão encerrada.'); redisInitialized = false; });
const initializeRedis = async (): Promise<void> => { if (!redisInitialized && !isConnecting) { isConnecting = true; logger.info('[Redis] Tentando conectar...'); try { await redisClient.connect(); } catch (err) { logger.error('[Redis] Falha inicial:', err); isConnecting = false; } } };
initializeRedis();
const ensureRedisConnection = async <T>( operation: () => Promise<T>, operationName: string, key?: string ): Promise<T> => { if (!redisInitialized) { logger.warn(`[Redis] Operação '${operationName}'${key ? ` para key '${key}'` : ''} sem conexão. Tentando reconectar...`); await initializeRedis(); if (!redisInitialized) throw new CacheError(`Redis indisponível para ${operationName}`); logger.info(`[Redis] Reconectado, continuando '${operationName}'...`); } try { const result = await Promise.race([ operation(), new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Redis operation timed out')), 5000)) ]); return result; } catch (error) { const errMsg = `Falha na operação Redis '${operationName}'${key ? ` para key '${key}'` : ''}`; logger.error(`[Redis] ${errMsg}`, error); throw new CacheError(errMsg, error instanceof Error ? error : undefined); } };
const getFromCache = async (key: string): Promise<string | null> => { try { return await ensureRedisConnection<string | null>(() => redisClient.get(key), 'getFromCache', key); } catch (error) { if (error instanceof CacheError) { logger.warn(`[Cache] Falha GET (key: ${key}).`, error.message); return null; } throw error; } };
const setInCache = async (key: string, value: string, ttlSeconds: number): Promise<string | null> => { try { return await ensureRedisConnection<string | null>(() => redisClient.set(key, value, { EX: ttlSeconds }), 'setInCache', key); } catch (error) { if (error instanceof CacheError) { logger.warn(`[Cache] Falha SET (key: ${key}).`, error.message); return null; } throw error; } };

// ====================================================
// Funções Auxiliares Básicas (Sem alterações)
// ====================================================
const selectRandom = <T>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];
const getRandomGreeting = (userName: string): string => selectRandom([`Oi ${userName}! Como posso ajudar hoje?`, `Olá ${userName}! Pronto(a) para analisar seus resultados?`, `E aí ${userName}, tudo certo? O que manda?`]) ?? `Olá ${userName}!`;

// ====================================================
// Análise de Sentimento (Sem alterações)
// ====================================================
const advancedAnalyzeSentiment = (text: string): "positive" | "negative" | "neutral" => { const lt=text.toLowerCase(); const hp=POSITIVE_SENTIMENT_KEYWORDS.some(kw=>lt.includes(kw)); const hn=NEGATIVE_SENTIMENT_KEYWORDS.some(kw=>lt.includes(kw)); if(hp&&!hn)return "positive"; if(hn&&!hp)return "negative"; return"neutral"; };

// ====================================================
// Gerenciamento de Diálogo e Histórico (Sem alterações)
// ====================================================
const getDialogueState = async (userId: string): Promise<IDialogueState> => { const stateJson = await ensureRedisConnection<string|null>(()=>redisClient.get(`state:${userId}`), 'getDialogueState', userId); if (stateJson) { try { return JSON.parse(stateJson); } catch (e) { logger.error(`[Dialogue] Erro parse estado ${userId}`, e); } } return {}; };
const updateDialogueState = async (userId: string, newState: IDialogueState): Promise<string | null> => { try { const stateJson=JSON.stringify(newState); return await ensureRedisConnection<string|null>(()=>redisClient.set(`state:${userId}`, stateJson, { EX: REDIS_STATE_TTL_SECONDS }), 'updateDialogueState', userId); } catch (e) { logger.error(`[Dialogue] Erro save estado ${userId}`, e); if (e instanceof CacheError) throw e; throw new BaseError("Falha ao salvar estado.", e as Error); } };
const getConversationHistory = async (userId: string): Promise<string> => { const historyLines = await ensureRedisConnection<string[]>(()=>redisClient.lRange(`history:${userId}`, -HISTORY_RAW_LINES_LIMIT, -1), 'getConvHist (lRange)', userId); return historyLines.join('\n'); };
const updateConversationHistory = async (userId: string, newEntry: string): Promise<'OK'> => { try { await ensureRedisConnection<number>(()=>redisClient.rPush(`history:${userId}`, newEntry), 'updateConvHist (rPush)', userId); await ensureRedisConnection<string>(()=>redisClient.lTrim(`history:${userId}`, -100, -1), 'updateConvHist (lTrim)', userId); await ensureRedisConnection<boolean>(()=>redisClient.expire(`history:${userId}`, REDIS_HISTORY_TTL_SECONDS), 'updateConvHist (expire)', userId); return 'OK'; } catch (error) { logger.error(`[History] Erro ${userId}:`, error); throw error; } };

// ====================================================
// Sumarização de Histórico (Sem alterações)
// ====================================================
async function summarizeConversationHistory(historyText: string): Promise<string> { const lines=historyText.split('\n'); if (lines.length > HISTORY_RAW_LINES_LIMIT * 2) { logger.warn(`[Summarize] Histórico grande (${lines.length} linhas), usando truncado.`); return lines.slice(-HISTORY_RAW_LINES_LIMIT*2).join('\n'); } return historyText; }

// ====================================================
// Placeholders (Sem alterações)
// ====================================================
const updateUserFeedback = async (userId: string): Promise<number | null> => { /*...*/ return null; };
const getUserProfileSegment = (/* user: IUser */): string => "Geral";
const getMultimediaSuggestion = (): string => "";
const adjustTone = (tone: string): string => tone;
const persistDialogueGraph = async (): Promise<void> => { /*...*/ };
const getGraphSummary = async (): Promise<string> => "";

// ====================================================
// Funções de Busca de Dados (Sem alterações)
// ====================================================
async function getCombinedGrowthData(userId: Types.ObjectId, dailyMetricModel: Model<IDailyMetric>): Promise<IGrowthDataResult> { /*...*/ return {}; }
async function fetchContentDetailsForMetrics(metricsToFetch: IDailyMetric[] | undefined, contentMetricModel: Model<IMetric>): Promise<Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined> { if (!metricsToFetch || metricsToFetch.length === 0) return undefined; const postIds=metricsToFetch.map(dm => dm.postId).filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id)); if (postIds.length === 0) return []; try { const cms=await contentMetricModel.find({ _id: { $in: postIds } }).select('_id description postLink').lean().exec(); const map=new Map(cms.map(cm => [cm._id.toString(), cm])); return metricsToFetch.map(dm => map.get(dm.postId?.toString() ?? '')).filter(Boolean) as Pick<IMetric, '_id' | 'description' | 'postLink'>[]; } catch (error) { logger.error(`[fetchContentDetails] Erro:`, error); throw new DatabaseError(`Falha detalhes conteúdo`, error as Error); } }

// ====================================================
// Preparação de Dados (v3.4)
// ====================================================
async function fetchAndPrepareReportData({ user, dailyMetricModel, contentMetricModel }: ReportDataInput): Promise<PreparedData> {
    const userId = user._id; const userIdStr = userId.toString();
    logger.debug(`[fetchData v3.4] Iniciando para ${userIdStr}`);
    const metricsStartDate = subDays(new Date(), METRICS_FETCH_DAYS_LIMIT);
    let dailyMetricsRaw: IDailyMetric[] = [];
    let growthData: IGrowthDataResult = {};
    let aggregatedReportResult: AggregatedReport | null = null;
    try {
        [ dailyMetricsRaw, growthData ] = await Promise.all([
            dailyMetricModel.find({ user: userId, postDate: { $gte: metricsStartDate } }).select('postDate stats user postId _id').sort({ postDate: -1 }).lean().exec(),
            getCombinedGrowthData(userId, dailyMetricModel),
        ]);
        logger.debug(`[fetchData v3.4] Brutos: ${dailyMetricsRaw.length} DailyMetrics.`);
        if (dailyMetricsRaw.length === 0) { throw new MetricsNotFoundError(`Sem métricas diárias nos últimos ${METRICS_FETCH_DAYS_LIMIT} dias.`); }
        logger.debug(`[fetchData v3.4] Executando buildAggregatedReport v3.4...`);
        aggregatedReportResult = await buildAggregatedReport( dailyMetricsRaw, userId, metricsStartDate, dailyMetricModel, contentMetricModel );
        logger.debug(`[fetchData v3.4] buildAggregatedReport concluído. Stats: F/P/C=${aggregatedReportResult?.detailedContentStats?.length ?? 0}, P=${aggregatedReportResult?.proposalStats?.length ?? 0}, C=${aggregatedReportResult?.contextStats?.length ?? 0}`);
        const [top3Simplified, bottom3Simplified] = await Promise.all([
            fetchContentDetailsForMetrics(aggregatedReportResult.top3, contentMetricModel),
            fetchContentDetailsForMetrics(aggregatedReportResult.bottom3, contentMetricModel)
        ]);
        if (!aggregatedReportResult?.overallStats) { logger.error(`[fetchData v3.4] overallStats ausentes.`); throw new MetricsNotFoundError(`Não foi possível calcular overallStats para ${userIdStr}`); }
        const enrichedReport: IEnrichedReport = {
            overallStats: aggregatedReportResult.overallStats,
            profileSegment: getUserProfileSegment(), multimediaSuggestion: getMultimediaSuggestion(),
            top3Posts: top3Simplified, bottom3Posts: bottom3Simplified,
            durationStats: aggregatedReportResult.durationStats,
            detailedContentStats: aggregatedReportResult.detailedContentStats,
            proposalStats: aggregatedReportResult.proposalStats, contextStats: aggregatedReportResult.contextStats,
            historicalComparisons: undefined, longTermComparisons: undefined,
        };
        logger.debug(`[fetchData v3.4] Relatório enriquecido montado.`);
        return { enrichedReport };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[fetchData v3.4] Falha para ${userIdStr}: ${msg}`, { error });
        if (error instanceof MetricsNotFoundError || error instanceof DatabaseError || error instanceof ReportAggregationError) throw error;
        if (error instanceof Error && error.name === 'MongoServerError') throw new DatabaseError(`DB error: ${msg}`, error);
        throw new DatabaseError(`Falha desconhecida preparar relatório v3.4: ${msg}`, error as Error);
    }
}

// ==================================================================
// Geração de Prompts - ATUALIZADO (v3.4)
// ==================================================================

/** Formata dados GERAIS para prompts (NÃO plano, NÃO ranking) */
function formatGeneralReportDataForPrompt(report: IEnrichedReport, maxDetailedStats: number = 5): string {
    let dataString = "";
    if (report.overallStats) { dataString += `\n## Resumo Geral (Médias Últimos ${METRICS_FETCH_DAYS_LIMIT}d):\n- Alcance: ${report.overallStats.avgAlcance?.toFixed(0)} | Comp.: ${report.overallStats.avgCompartilhamentos?.toFixed(1)}\n- Salv.: ${report.overallStats.avgSalvamentos?.toFixed(1)} | Curt.: ${report.overallStats.avgCurtidas?.toFixed(1)}\n`; }
    if (report.detailedContentStats && report.detailedContentStats.length > 0) {
        dataString += `\n## Desempenho Detalhado (Top ${maxDetailedStats} Combinações F/P/C por Comp.):\n`;
        report.detailedContentStats.slice(0, maxDetailedStats).forEach(stat => {
            const f=stat._id.format!=='Desconhecido'?`F:${stat._id.format}`:''; const p=stat._id.proposal!=='Outro'?`P:${stat._id.proposal}`:''; const c=stat._id.context!=='Geral'?`C:${stat._id.context}`:'';
            const labels=[f,p,c].filter(Boolean).join('/')||'Geral'; const diff=stat.shareDiffPercentage?` (${stat.shareDiffPercentage>=0?'+':''}${stat.shareDiffPercentage.toFixed(0)}% vs geral)`:'';
            dataString += `- ${labels} (${stat.count}p): Comp. Médio=${stat.avgCompartilhamentos?.toFixed(1)}${diff}, Salv. Médio=${stat.avgSalvamentos?.toFixed(1)}\n`; });
        if(report.detailedContentStats.length>maxDetailedStats) dataString += "- ... (outras combinações omitidas)\n";
    } else { dataString += "\nNão há dados detalhados por F/P/C disponíveis.\n"; }
    if (report.durationStats && report.durationStats.length > 0) {
        dataString += "\n## Desempenho por Duração (Comp./Salv. Médio):\n";
        report.durationStats.forEach(stat => { dataString += `- ${stat.range}(${stat.contentCount}p): Comp=${stat.averageShares.toFixed(2)} | Salv=${stat.averageSaves?.toFixed(2)} | `; }); dataString = dataString.slice(0, -3) + "\n";
    } else { dataString += "\nNão há dados de desempenho por duração disponíveis.\n"; }
    return dataString.trim();
}

/** Formata dados para o prompt do PLANO DE CONTEÚDO */
function formatDataForContentPlanPrompt(report: IEnrichedReport): string {
    let dataString = "## Desempenho Detalhado por Combinação (F/P/C) com Diferenças vs Média Geral e Melhor Exemplo:\n";
    if (!report.detailedContentStats || report.detailedContentStats.length === 0) { return dataString + "Nenhum dado detalhado por combinação disponível.\n"; }
    const statsToFormat = report.detailedContentStats.slice(0, DETAILED_STATS_LIMIT_FOR_PROMPT);
    statsToFormat.forEach((stat, index) => {
        if (stat.count < 2) return;
        const f=stat._id.format; const p=stat._id.proposal; const c=stat._id.context;
        const labels = [f!=='Desconhecido'?`F:${f}`:'', p!=='Outro'?`P:${p}`:'', c!=='Geral'?`C:${c}`:''].filter(Boolean).join('/')||'Geral';
        dataString += `\n### Combinação ${index + 1}: ${labels} (${stat.count} posts)\n`; dataString += `- Proposta: ${p}\n- Contexto: ${c}\n- Formato: ${f}\n`;
        const sDiff=stat.shareDiffPercentage?`${stat.shareDiffPercentage>=0?'+':''}${stat.shareDiffPercentage.toFixed(0)}%`:'N/A'; const vDiff=stat.saveDiffPercentage?`${stat.saveDiffPercentage>=0?'+':''}${stat.saveDiffPercentage.toFixed(0)}%`:'N/A'; const rDiff=stat.reachDiffPercentage?`${stat.reachDiffPercentage>=0?'+':''}${stat.reachDiffPercentage.toFixed(0)}%`:'N/A';
        dataString += `- Comp. Médio: ${stat.avgCompartilhamentos?.toFixed(1)} (${sDiff} vs geral)\n`; dataString += `- Salv. Médio: ${stat.avgSalvamentos?.toFixed(1)} (${vDiff} vs geral)\n`; dataString += `- Alcance Médio: ${stat.avgAlcance?.toFixed(0)} (${rDiff} vs geral)\n`;
        if (stat.bestPostInGroup) { const desc=stat.bestPostInGroup.description?`"${stat.bestPostInGroup.description.substring(0,70)}..."`:`ID ${stat.bestPostInGroup._id.toString().slice(-4)}`; const link=stat.bestPostInGroup.postLink||'Sem link'; const comp=stat.bestPostInGroup.shares??'N/A'; const salv=stat.bestPostInGroup.saves??'N/A'; dataString += `- Melhor Exemplo: ${desc} (Comp: ${comp}, Salv: ${salv}) Link: ${link}\n`; } else { dataString += `- Melhor Exemplo: Não identificado.\n`; } });
    if (report.detailedContentStats.length > DETAILED_STATS_LIMIT_FOR_PROMPT) { dataString += "\n(... outras combinações omitidas ...)\n"; }
    if (report.durationStats && report.durationStats.length > 0) { dataString += "\n## Desempenho por Duração (Info Adicional):\n"; report.durationStats.forEach(d => { dataString += `- Faixa ${d.range}(${d.contentCount}p): Comp=${d.averageShares.toFixed(2)}, Salv=${d.averageSaves?.toFixed(2)}\n`; }); }
    return dataString.trim();
}

/** Formata TODOS os dados de ranking para o prompt de Ranking */
function formatRankingDataForPrompt(report: IEnrichedReport): string {
    let dataString = "## Dados Disponíveis para Ranking (Pré-ordenados por Compartilhamento):\n"; const topN = RANKING_LIMIT;
    const formatStatLine = (label: string, stat: DetailedContentStat | ProposalStat | ContextStat): string => {
        const sDiff=stat.shareDiffPercentage?` (${stat.shareDiffPercentage>=0?'+':''}${stat.shareDiffPercentage.toFixed(0)}% Comp)`:''; const vDiff=stat.saveDiffPercentage?` (${stat.saveDiffPercentage>=0?'+':''}${stat.saveDiffPercentage.toFixed(0)}% Salv)`:''; const rDiff=stat.reachDiffPercentage?` (${stat.reachDiffPercentage>=0?'+':''}${stat.reachDiffPercentage.toFixed(0)}% Alc)`:'';
        let line=`${label} (${stat.count}p): Comp=${stat.avgCompartilhamentos.toFixed(1)}${sDiff}, Salv=${stat.avgSalvamentos.toFixed(1)}${vDiff}, Alc=${stat.avgAlcance.toFixed(0)}${rDiff}\n`;
        if (stat.bestPostInGroup?.postLink) { line += `   Melhor Exemplo: ${stat.bestPostInGroup.postLink}\n`; } return line; };
    dataString += "\n### Por PROPOSTA:\n";
    if (report.proposalStats && report.proposalStats.length > 0) { report.proposalStats.slice(0,topN).forEach((stat, i) => { dataString += `${i + 1}. ${formatStatLine(stat._id.proposal, stat)}`; }); if (report.proposalStats.length > topN) dataString += `(... mais ${report.proposalStats.length - topN} propostas ...)\n`; } else { dataString += "N/A\n"; }
    dataString += "\n### Por CONTEXTO:\n";
    if (report.contextStats && report.contextStats.length > 0) { report.contextStats.slice(0,topN).forEach((stat, i) => { dataString += `${i + 1}. ${formatStatLine(stat._id.context, stat)}`; }); if (report.contextStats.length > topN) dataString += `(... mais ${report.contextStats.length - topN} contextos ...)\n`; } else { dataString += "N/A\n"; }
    dataString += "\n### Por COMBINAÇÃO (F/P/C):\n";
    if (report.detailedContentStats && report.detailedContentStats.length > 0) { report.detailedContentStats.slice(0,topN).forEach((stat, i) => { const f=stat._id.format!=='Desconhecido'?`F:${stat._id.format}`:''; const p=stat._id.proposal!=='Outro'?`P:${stat._id.proposal}`:''; const c=stat._id.context!=='Geral'?`C:${stat._id.context}`:''; const labels=[f,p,c].filter(Boolean).join('/') || 'Geral'; dataString += `${i + 1}. ${formatStatLine(labels, stat)}`; }); if (report.detailedContentStats.length > topN) dataString += `(... mais ${report.detailedContentStats.length - topN} combinações ...)\n`; } else { dataString += "N/A\n"; }
    if(report.overallStats){ dataString += `\n## Médias Gerais (Referência):\n- Comp=${report.overallStats.avgCompartilhamentos.toFixed(1)}, Salv=${report.overallStats.avgSalvamentos.toFixed(1)}, Alc=${report.overallStats.avgAlcance.toFixed(0)}\n`; }
    return dataString.trim();
}

/** Instruções GERAIS para a IA (NÃO plano, NÃO ranking) */
function generateAIInstructions(userName: string, report: IEnrichedReport, history: string, tone: string): string {
    const profileSegment = report.profileSegment || "Geral"; const formattedReportData = formatGeneralReportDataForPrompt(report);
    return `
# Persona e Contexto
Você é a Tuca, consultora (${tone}) para ${userName}... [foco em insights acionáveis, ${profileSegment}] ...
# Dados Disponíveis (Resumo ${METRICS_FETCH_DAYS_LIMIT}d)
${formattedReportData}
*Use F/P/C e Duração.*
# Sua Metodologia e Resposta (INTENTS GERAIS):
## Análise Interna: 1. Foco: Comp/Salv/Alc. 2. F/P/C: Melhores médias/% vs geral (count>1). 3. Formato: Dentro melhores F/P/C. 4. Duração: Correlação. 5. Dia/Semana: Cautela. 6. Ideias: 2-3 sugestões NOVAS.
## Resposta (CONCISA): 1. 2-3 insights MAIS IMPORTANTES. 2. Acionável. 3. Justificado (Use %). 4. Cadência (Se aplic.). 5. Pergunta Final Estratégica SEMPRE.
# Histórico Recente:
${history}
`; // Abreviação
}

/** Instruções para gerar o PLANO DE CONTEÚDO */
function generateContentPlanInstructions( userName: string, report: IEnrichedReport, history: string, tone: string, userMessage: string ): string {
    const formattedPlanData = formatDataForContentPlanPrompt(report);
    return `
# Persona e Contexto
Você é a **Tuca**... (${tone}) para ${userName}... Objetivo: **PLANEJAMENTO SEMANAL ACIONÁVEL**... (${report.profileSegment || 'Geral'})...
# Tarefa: Criar Plano de Conteúdo Semanal
Usuário pediu: "${userMessage}". Gere plano (Seg/Ter...) com 3-5 sugestões (F/P/C) MAIS PROMESSORAS.
# Dados Disponíveis (Detalhado F/P/C - ENRIQUECIDOS):
${formattedPlanData}
*Use estes dados. Atenção a % vs geral e Melhores Exemplos. Priorize count > 1.*
# Estrutura OBRIGATÓRIA (Use EXATAMENTE):
**[Dia (P: ..., C: ...)]**
- **Performance Chave:** ... Média: **[Comp.]** (**X%** acima média!). Alcance Y% maior. *(Use avg, diff%)*
- **Formato/Duração Ideal:** Formato [F]..., esp. vídeos [duração]... +Z% [métrica]. *(Use _id.format, durationStats)*
- **Ideia de Conteúdo:** Que tal: "**[SUA IDEIA NOVA AQUI]**"?
- **Sua Melhor Referência:** Inspire-se em "${'desc...'}" (${'link...'})! *(Use bestPostInGroup)*
--- [Separador] ---
**(Repita 2-4x)**
# Observações FINAIS (Tuca):
- Selecione 3-5 F/P/C fortes (% positivo E count>1). Ignore baixo/poucos dados.
- Mencione duração se relevante. Ideia NOVA. Direta, prática (${tone}).
- **NÃO** use Pergunta Final.
- Se dados insuficientes, explique e dê sugestões gerais.
# Histórico Recente:
${history}
# Sua Resposta (Plano Detalhado para ${userName}):
`; // Abreviação
}

/** <<< NOVO v3.4 CORRIGIDO: Instruções para gerar RANKINGS >>> */
function generateRankingInstructions(
    userName: string, report: IEnrichedReport, history: string, tone: string, userMessage: string
): string {
    const formattedRankingData = formatRankingDataForPrompt(report);
    // Escape de backticks dentro do template literal com \`
    const rankingInstructions = `
# Persona e Contexto
Você é a **Tuca**, consultora especialista em mídias sociais (${tone}) para ${userName}. Objetivo: Responder a um pedido de RANKING de desempenho.

# Tarefa Específica: Gerar Ranking
O usuário pediu um ranking/classificação ("${userMessage}"). Sua tarefa é:
1.  **Identificar a Métrica:** Qual métrica o usuário quer usar para ordenar? (Ex: Compartilhamentos, Salvamentos, Alcance, Curtidas). Se não estiver claro, **use Compartilhamentos como padrão**.
2.  **Identificar o Agrupamento:** O usuário quer o ranking por Proposta, Contexto ou Combinação (F/P/C)? Se não estiver claro, **use Proposta como padrão inicial**, mas mencione que outros rankings estão disponíveis.
3.  **Gerar o Ranking:** Apresentar o Top ${RANKING_LIMIT} itens do agrupamento escolhido, ordenados pela métrica identificada (ou padrão), mostrando o valor médio da métrica.
4.  **Listar Exemplos:** Após o ranking, listar os links dos melhores posts de exemplo (\`bestPostInGroup\`) dos ${Math.min(3, RANKING_LIMIT)} primeiros itens do ranking.
5.  **Tratar Ambiguidade/Dados:** Se a métrica ou agrupamento não puderem ser inferidos com segurança, peça esclarecimento ao usuário. Se não houver dados suficientes para o ranking solicitado, informe isso.

# Dados Disponíveis (Rankings Pré-processados por Compartilhamento):
${formattedRankingData}
*Use estes dados para montar o ranking solicitado. Os dados incluem médias, % de diferença vs geral e o melhor post de exemplo para cada item.*

# Estrutura OBRIGATÓRIA da Resposta:

**Ranking de [Agrupamento Inferido] por [Métrica Inferida] (Top ${RANKING_LIMIT}):**

1.  [Nome Item 1] - [Valor Médio] [Nome Métrica Inferida] em média
2.  [Nome Item 2] - [Valor Médio] [Nome Métrica Inferida] em média
3.  [Nome Item 3] - [Valor Médio] [Nome Métrica Inferida] em média
4.  [Nome Item 4] - [Valor Médio] [Nome Métrica Inferida] em média
5.  [Nome Item 5] - [Valor Médio] [Nome Métrica Inferida] em média
*(Se houver menos de ${RANKING_LIMIT} itens com dados, liste apenas os disponíveis)*

**Conteúdos de Referência (Exemplos dos Top ${Math.min(3, RANKING_LIMIT)}):**
- Para "[Nome Item 1]": [Link BestPostInGroup Item 1] (Descrição: "${'descrição curta...'}")
- Para "[Nome Item 2]": [Link BestPostInGroup Item 2] (Descrição: "${'descrição curta...'}")
- Para "[Nome Item 3]": [Link BestPostInGroup Item 3] (Descrição: "${'descrição curta...'}")
*(Liste apenas para os itens que tiverem bestPostInGroup disponível)*

# Observações FINAIS para Você (Tuca):
- **Inferência:** Tente ao máximo inferir a métrica e o agrupamento da pergunta: "${userMessage}". Use os padrões (Compartilhamento, Proposta) se não claro.
- **Clareza:** Indique claramente qual métrica e agrupamento você usou no título do ranking.
- **Formato:** Siga EXATAMENTE a estrutura de resposta acima.
- **Dados Insuficientes:** Se um ranking específico não puder ser gerado (ex: poucos dados para Contexto), informe o usuário (ex: "Ainda não temos dados suficientes para um ranking confiável por Contexto.").
- **Ambiguidade:** Se a pergunta for muito vaga (ex: "qual o melhor?"), peça para especificar a métrica e o agrupamento (ex: "Melhor em relação a qual métrica? Compartilhamentos, salvamentos, alcance...? E você gostaria de ver o ranking por Proposta, Contexto ou pela combinação completa?").
- **Sem Pergunta Final:** NÃO adicione a pergunta estratégica de diálogo no final desta resposta.

# Histórico Recente (Contexto da Conversa):
${history}

# Sua Resposta (Ranking para ${userName}):
`; // Fim do template literal
    return rankingInstructions;
}


/** Seleciona prompt correto para content_plan e ranking_request */
function selectAndBuildPrompt(
    intent: string, userName: string, report: IEnrichedReport, userMessage: string,
    tone: string, sentiment: string, history: string, hobbies: string[]
): string {
    logger.debug(`[Prompt Build v3.4] Intent: ${intent}`); let finalPrompt: string;
    switch (intent) {
        case 'content_plan': finalPrompt = generateContentPlanInstructions(userName, report, history, tone, userMessage); break;
        case 'ranking_request': finalPrompt = generateRankingInstructions(userName, report, history, tone, userMessage); break; // <-- Chama prompt de ranking
        case 'report': const rpt = generateAIInstructions(userName, report, history, tone); finalPrompt = `${rpt}\n\n# Mensagem Atual:\n${userMessage}\n\n# Sua Análise ESTRATÉGICA CONCISA c/ Pergunta Final:`; break;
        case 'content_ideas': const ide = generateAIInstructions(userName, report, history, tone); finalPrompt = `${ide}\n\n# Mensagem Atual:\n${userMessage}\n\n# Suas Ideias de Conteúdo CONCISAS c/ Pergunta Final:`; break;
        default: const def = generateAIInstructions(userName, report, history, tone); finalPrompt = `${def}\n\n# Mensagem Atual:\n${userMessage}\n\n# Sua Resposta CONCISA c/ Pergunta Final Estratégica:`; break;
    }
    logger.info(`[Prompt Construído v3.4] User: ${userName}, Intent: ${intent}, Tamanho: ${finalPrompt.length}`);
    return finalPrompt;
}


// ====================================================
// Circuit Breaker, Retry, Usage Counter (Sem alterações)
// ====================================================
const openAICallWithRetry = async (prompt: string): Promise<string> => { try { logger.debug(`[AI Call] Exec OpenAI (Tam: ${prompt.length})`); const response = await callOpenAIForQuestion(prompt,{temperature: 0.7}); if (!response?.trim()) { throw new Error("Resposta vazia OpenAI"); } logger.debug("[AI Call] Resposta OpenAI OK."); return response; } catch (error) { logger.error("[AI Call] Erro OpenAI:", error); throw new AIError("Falha OpenAI", error instanceof Error ? error : new Error(String(error))); } };
const breakerOptions = { timeout: 20000, errorThresholdPercentage: 50, resetTimeout: 30000 } as opossum.Options; const openAIBreaker = new opossum(openAICallWithRetry, breakerOptions);
openAIBreaker.on('failure', (error) => logger.error(`[Opossum] Breaker falhou: ${error.message}`)); openAIBreaker.on('open', () => logger.warn('[Opossum] Breaker ABERTO')); openAIBreaker.on('close', () => logger.info('[Opossum] Breaker FECHADO'));
const incrementUsageCounter = async (userId: string): Promise<number> => { const count = await ensureRedisConnection<number>(()=>redisClient.hIncrBy(`usage:${userId}`,'count', 1),'incUsage',userId); return count; };

// ====================================================
// Funções Helper para o Fluxo Principal (Sem alterações)
// ====================================================
async function callAIWithResilience(prompt: string): Promise<string> { logger.debug(`[AI Call] Opossum... Prompt: ${prompt.length}`); try { const response = await openAIBreaker.fire(prompt); if (typeof response !== 'string' || !response.trim()) { throw new AIError("Resposta vazia/inválida Opossum."); } logger.debug(`[AI Call] Opossum OK.`); return response; } catch (error) { logger.error('[AI Call] Erro Opossum:', error); if (error instanceof AIError) throw error; throw new AIError("Falha chamada resiliente IA.", error as Error); } }
async function updateConversationContext(userId: string, incomingText: string, aiCoreResponse: string, dialogueState: IDialogueState): Promise<void> { const now=Date.now(); const userEntry=`User: ${incomingText}`; const aiEntry=`AI: ${aiCoreResponse}`; try { const [res]=await Promise.all([ updateDialogueState(userId,{...dialogueState, lastInteraction: now }), updateConversationHistory(userId,userEntry), updateConversationHistory(userId,aiEntry) ]); logger.debug(`[Context Update] OK ${userId}. State: ${res}`); } catch (error) { logger.error(`[Context Update] Falha ${userId}.`, error); throw error; } }
async function lookupUser(fromPhone: string): Promise<IUser> { logger.debug(`[User Lookup] Buscando ${fromPhone.slice(0,-4)}****`); try { const user = await User.findOne({ whatsappPhone: fromPhone }).lean().exec(); if (!user) throw new UserNotFoundError(`Usuário não encontrado: ${fromPhone.slice(0,-4)}****`); logger.debug(`[User Lookup] OK: ${user._id}`); return user as IUser; } catch (error) { if (error instanceof UserNotFoundError) throw error; logger.error(`[User Lookup] Erro DB ${fromPhone.slice(0,-4)}****:`, error); throw new DatabaseError(`Erro buscar usuário`, error as Error); } }
async function loadContext(userIdStr: string): Promise<{ dialogueState: IDialogueState, conversationHistory: string }> { logger.debug(`[Context Load] Carregando ${userIdStr}`); try { const [state, rawHistory]=await Promise.all([ getDialogueState(userIdStr), getConversationHistory(userIdStr) ]); const summarizedHistory = await summarizeConversationHistory(rawHistory); logger.debug(`[Context Load] OK ${userIdStr}. Hist Sumarizado: ${rawHistory.length!==summarizedHistory.length}`); return { dialogueState: state, conversationHistory: summarizedHistory }; } catch (error) { logger.error(`[Context Load] Falha ${userIdStr}.`, error); throw error; } }
async function addGreetingAndGraph(baseResponse: string, userIdStr: string, greeting: string, dialogueState: IDialogueState): Promise<string> { let finalResponse = baseResponse; const now=Date.now(); const minSinceLastInteraction = dialogueState.lastInteraction?(now-dialogueState.lastInteraction)/(1000*60):Infinity; const minSinceLastGreeting = dialogueState.lastGreetingSent?(now-dialogueState.lastGreetingSent)/(1000*60):Infinity; if(minSinceLastInteraction>GREETING_RECENCY_THRESHOLD_MINUTES||minSinceLastGreeting>GREETING_RECENCY_THRESHOLD_MINUTES*2){ finalResponse=`${greeting}\n\n${baseResponse}`; updateDialogueState(userIdStr,{...dialogueState,lastGreetingSent:now}).catch(err=>logger.error(`[addGreeting] Falha upd Saldo ${userIdStr}`, err)); } try { const graphSummary=await getGraphSummary(); finalResponse+=graphSummary; } catch(err){ logger.error(`[addGreeting] Falha graph ${userIdStr}`, err); } return finalResponse; }
async function handleSpecialCases(user: IUser, incomingText: string, normalizedQuery: string, dialogueState: IDialogueState, greeting: string, userIdStr: string): Promise<string | null> { if (GREETING_KEYWORDS.includes(normalizedQuery)) { return `${greeting} Em que posso ajudar?`; } if (NORMALIZED_BEST_TIME_KEYWORDS.some(kw=>normalizedQuery.includes(kw))) { return "Sobre hora/dia: qualidade e consistência > hora exata! 😉 Tática: olhe Insights na plataforma (alcance em 48-72h). Se ainda crescendo, espere. Se estabilizou/caiu, pode postar de novo. Ajuda a não 'atropelar' post que performa!"; } const isPos=NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS.some(p=>normalizedQuery.includes(p)); const isNeg=NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS.some(n=>normalizedQuery.includes(n)&&!FEEDBACK_NEUTRAL_RESPONSE_WORDS.some(w=>normalizedQuery===w)); if(isPos||isNeg){ updateUserFeedback(userIdStr).catch(e=>logger.error("Falha salvar feedback", e)); if(isPos) return selectRandom(["Que bom que gostou!", "Ótimo! Feliz em ajudar.", "Legal! Precisa de mais algo?"])??"Legal!"; if(isNeg) return selectRandom(["Entendido.", "Ok, obrigado pelo feedback.", "Vou registrar."])??"Ok."; } return null; }
function formatPostListWithLinks(posts: Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined, title: string): string { if (!posts || posts.length === 0) return ""; let list=`\n${title}`; posts.forEach((post, i)=>{ const desc=post.description?`"${post.description.substring(0,50)}..."`:`(Post ${post._id?.toString().slice(-4)??i+1})`; const link=post.postLink?` ([ver](${post.postLink}))`:""; list+=`\n- ${desc}${link}`; }); return list; }

// ====================================================
// Processamento Principal da IA - ATUALIZADO (v3.4)
// ====================================================
async function processMainAIRequest(
    user: IUser, incomingText: string, normalizedQuery: string, conversationHistory: string,
    dialogueState: IDialogueState, greeting: string, userIdStr: string, cacheKey: string
): Promise<string> {
    logger.debug(`[processMainAIRequest v3.4] Iniciando para ${userIdStr}`); const dataPrepStartTime=Date.now();

    // 1. Prepara dados (v3.4 com todos stats enriquecidos)
    const { enrichedReport } = await fetchAndPrepareReportData({ user, dailyMetricModel: DailyMetric, contentMetricModel: Metric });
    logger.debug(`[processMainAIRequest v3.4] Preparação dados OK (${Date.now()-dataPrepStartTime}ms).`);

    // 2. Define tom, hobbies, sentimento
    let tone=user.profileTone||"informal e prestativo"; const hobbies:string[]=Array.isArray(user.hobbies)?user.hobbies:[]; tone=adjustTone(tone); const sentiment=advancedAnalyzeSentiment(incomingText);
    logger.debug(`[processMainAIRequest v3.4] Pre-prompt: Sentiment=${sentiment}, Tone=${tone}`);

    // 3. Detecção de Intenção (v3.4)
    let intent: 'report' | 'metrics_summary' | 'content_ideas' | 'content_plan' | 'ranking_request' | 'general' = 'general';
    if (NORMALIZED_CONTENT_PLAN_KEYWORDS.some(kw => normalizedQuery.includes(kw))) intent = 'content_plan';
    else if (NORMALIZED_RANKING_KEYWORDS.some(kw => normalizedQuery.includes(kw))) intent = 'ranking_request';
    else if (NORMALIZED_REPORT_KEYWORDS.some(kw => normalizedQuery.includes(kw) && !NORMALIZED_CONTENT_PLAN_KEYWORDS.some(cpkw => normalizedQuery.includes(cpkw)))) intent = 'report';
    else if (NORMALIZED_CONTENT_IDEAS_KEYWORDS.some(kw => normalizedQuery.includes(kw))) intent = 'content_ideas';
    else if (NORMALIZED_REQUEST_KEYWORDS.some(kw => normalizedQuery.includes(kw) && !NORMALIZED_JUSTIFICATION_KEYWORDS.some(jkw => normalizedQuery.includes(jkw)))) intent = 'metrics_summary';
    logger.info(`[processMainAIRequest v3.4] Intenção: ${intent}`);

    // 4. Constrói Prompt (v3.4)
    const prompt = selectAndBuildPrompt( intent, user.name||"usuário", enrichedReport, incomingText, tone, sentiment, conversationHistory, hobbies );

    // 5. Chama IA
    const aiCoreResponse = await callAIWithResilience(prompt); const originalAICoreResponseForContext = aiCoreResponse;
    logger.debug(`[processMainAIRequest v3.4] Resposta CORE IA OK.`);

    // 6. Adiciona infos extras (se não for plano, ranking, ideias, resumo)
    let postsInfo = ""; const intentsWithoutGeneralPosts = ['content_plan', 'ranking_request', 'content_ideas', 'metrics_summary'];
    if (!intentsWithoutGeneralPosts.includes(intent)) {
        const topF = formatPostListWithLinks(enrichedReport.top3Posts, "📈 Posts gerais que se destacaram:"); const botF = formatPostListWithLinks(enrichedReport.bottom3Posts, "📉 Posts gerais com menor desempenho:");
        if (topF || botF) { postsInfo = `\n\n---\n**Posts gerais referência:**${topF}${topF && botF ? '\n':''}${botF}`; } }
    const responseWithExtras = aiCoreResponse + postsInfo;

    // 7. Adiciona saudação/grafo
    const finalResponse = await addGreetingAndGraph(responseWithExtras, userIdStr, greeting, dialogueState);

    // 8. Atualiza contexto/cache/contador
    logger.debug(`[processMainAIRequest v3.4] Agendando updates async...`);
    Promise.allSettled([ setInCache(cacheKey, finalResponse, REDIS_CACHE_TTL_SECONDS), updateConversationContext(userIdStr, incomingText, originalAICoreResponseForContext, dialogueState), incrementUsageCounter(userIdStr), persistDialogueGraph() ]).then(results => { results.forEach((result, i) => { if (result.status === 'rejected') { const ops=['cache','context','usage','graph']; logger.warn(`[AsyncUpdate] Falha op ${i} (${ops[i]}):`, result.reason); } }); });

    // 9. Retorna
    return finalResponse;
}

// ====================================================
// Tratamento Global de Erros (Sem alterações)
// ====================================================
function handleError(error: unknown, fromPhone: string, userId: string | 'N/A', startTime: number): string { const duration=Date.now()-startTime; let userMessage=`Ops! 😅 Problema inesperado (${error instanceof Error ? error.constructor.name : 'Unknown'}). Tente de novo. Se persistir, contate suporte.`; let errorType="UnknownError"; if(error instanceof Error){ errorType=error.constructor.name; const cause=error.cause instanceof Error?error.cause:error.cause; logger.error(`[handleError] Erro! Tipo: ${errorType}, User: ${userId}, Phone: ${fromPhone}, Dur: ${duration}ms`, { msg: error.message, stack: error.stack, cause: cause }); } else { errorType=typeof error; logger.error(`[handleError] Erro Não-Padrão! User: ${userId}, Phone: ${fromPhone}, Dur: ${duration}ms`, { error }); } if(error instanceof UserNotFoundError) userMessage="Olá! Não encontrei seu cadastro. Verifique o número ou contate suporte."; else if(error instanceof MetricsNotFoundError) userMessage=`🤔 Não encontrei dados recentes (${error.message}). Verifique o envio das métricas.`; else if(error instanceof AIError) userMessage=`Dificuldade em conectar com a IA agora 🧠 (${error.message}). Tente de novo logo!`; else if(error instanceof ReportAggregationError) userMessage=`Problema ao processar dados p/ relatório (${error.message}) 📊. Tente mais tarde.`; else if(error instanceof DatabaseError) userMessage=`Falha ao acessar banco de dados (${error.message}) 💾. Tente mais tarde.`; else if(error instanceof CacheError) userMessage=`Lentidão temporária (${error.message}) 🐢. Pode tentar de novo?`; return userMessage; }

// ====================================================
// Função Exportada para Resumo Semanal (Placeholder - Sem alterações)
// ====================================================
export async function generateStrategicWeeklySummary(userName: string, aggregatedReport: AggregatedReport): Promise<string> { logger.warn("[generateWeeklySummary] Não implementado."); const prompt=`Resumo semanal curto para ${userName}: ${JSON.stringify(aggregatedReport.overallStats)}`; try { return await callAIWithResilience(prompt); } catch(error){ logger.error(`[generateWeeklySummary] Falha ${userName}`, error); if (error instanceof AIError) return "Desculpe, falha na IA para gerar resumo semanal."; return "Desculpe, erro inesperado no resumo semanal."; } }

// ====================================================
// Função Principal Exportada (getConsultantResponse - v3.4)
// ====================================================
export async function getConsultantResponse(fromPhone: string, incomingText: string): Promise<string> {
    const startTime = Date.now();
    logger.info(`[getConsultantResponse v3.4] INÍCIO: Chamada de ${fromPhone}. Msg: "${incomingText.substring(0, 50)}..."`);
    const normalizedQueryForCache = normalizeText(incomingText).trim().replace(/\s+/g, '_').substring(0, 100);
    const cacheKey = `response:${fromPhone}:${normalizedQueryForCache}`;
    let user: IUser | null = null; let userIdStr: string | 'N/A' = 'N/A'; let dialogueState: IDialogueState = {};

    try {
        const cachedResponse = await getFromCache(cacheKey);
        if (cachedResponse) { logger.info(`[Cache] HIT ${cacheKey}. T: ${Date.now()-startTime}ms`); return cachedResponse; }
        logger.debug(`[Cache] MISS ${cacheKey}`);
        user = await lookupUser(fromPhone); userIdStr = user._id.toString();
        let conversationHistory: string;
        ({ dialogueState, conversationHistory } = await loadContext(userIdStr));
        const greeting = getRandomGreeting(user.name || 'usuário');
        const normalizedQuery = normalizeText(incomingText.trim());
        if (!normalizedQuery) { logger.warn(`[getConsultantResponse v3.4] Msg vazia ${fromPhone}.`); return `${greeting} Como posso ajudar? 😊`; }
        const specialCaseResponse = await handleSpecialCases(user, incomingText, normalizedQuery, dialogueState, greeting, userIdStr);
        if (specialCaseResponse !== null) { logger.info(`[Flow] Resposta caso especial. User: ${userIdStr}. T: ${Date.now()-startTime}ms`); Promise.allSettled([setInCache(cacheKey, specialCaseResponse, REDIS_CACHE_TTL_SECONDS), incrementUsageCounter(userIdStr)]).then(()=>{/*log*/}); return specialCaseResponse; }
        logger.debug(`[getConsultantResponse v3.4] Iniciando fluxo principal IA... User: ${userIdStr}`);
        const aiResponse = await processMainAIRequest( user, incomingText, normalizedQuery, conversationHistory, dialogueState, greeting, userIdStr, cacheKey );
        const totalDuration = Date.now()-startTime; logger.info(`[getConsultantResponse v3.4] FIM OK. User: ${userIdStr}. Tam: ${aiResponse.length}. T: ${totalDuration}ms`);
        return aiResponse;
    } catch (error: unknown) {
        const errorName = error instanceof Error ? error.constructor.name : "Unknown"; logger.error(`[getConsultantResponse v3.4] ERRO CAPTURADO (${errorName}). User: ${userIdStr}, Phone: ${fromPhone}.`, error); const errorResponse = handleError(error, fromPhone, userIdStr, startTime); const totalErrorDuration = Date.now()-startTime; logger.info(`[getConsultantResponse v3.4] ERRO HANDLED. Phone: ${fromPhone}. Tipo: ${errorName}. T: ${totalErrorDuration}ms`); return errorResponse;
    }
}
// ====================================================
// FIM
// ====================================================