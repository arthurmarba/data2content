// @/app/lib/consultantService.ts - v3.35 (Correção Comparação Intent + Roteiro Proativo)

// --- Imports Essenciais e Módulos ---
import { Model, Types } from "mongoose";
import { subDays, format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import opossum from "opossum";
import { logger } from '@/app/lib/logger';
import { createClient } from "redis";

// Importa os novos módulos de serviço
import * as intentService from './intentService';
// Assuming DeterminedIntent type is exported from intentService or defined appropriately
import { getRandomGreeting, normalizeText as normalizeTextInput, isSimpleConfirmation, DeterminedIntent } from './intentService';
import * as dataService from './dataService';
// Importa funções específicas com alias e tipos explícitos
import {
    generateAIInstructions as importedGenerateAIInstructions,
    generateContentPlanInstructions as importedGenerateContentPlanInstructions,
    generateGroupedContentPlanInstructions as importedGenerateGroupedContentPlanInstructions,
    generateRankingInstructions as importedGenerateRankingInstructions,
    generateScriptInstructions as importedGenerateScriptInstructions
} from './promptService'; // Assuming v3.Z.8 or later
import { callOpenAIForQuestion } from "@/app/lib/aiService";

// Importa tipos de erro
import {
    BaseError, UserNotFoundError, MetricsNotFoundError, AIError, CacheError, DatabaseError, ReportAggregationError, DetailedStatsError
} from "@/app/lib/errors";

// Importa modelos
import User, { IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";

// Importa tipos dos outros serviços e helpers
import { IEnrichedReport, ReferenceSearchResult } from './dataService';
import { DetailedContentStat, AggregatedReport, StatId } from './reportHelpers'; // Assuming DetailedContentStat is exported from reportHelpers

// --- Novas Interfaces para Contexto do Plano ---
interface IPlanItemContext { identifier: string; description: string; proposal?: string; context?: string; }
interface IMetricMinimal { _id?: Types.ObjectId; description?: string; postLink?: string; proposal?: string; context?: string; }
type OriginalSourceContext = { description: string; proposal?: string; context?: string; } | null;
interface IDialogueState { lastInteraction?: number; lastGreetingSent?: number; recentPlanIdeas?: IPlanItemContext[] | null; recentPlanTimestamp?: number; lastOfferedScriptIdea?: { aiGeneratedIdeaDescription: string; originalSource: OriginalSourceContext; timestamp: number; } | null; }


// --- Constantes ---
const GREETING_RECENCY_THRESHOLD_MINUTES = 15;
const HISTORY_RAW_LINES_LIMIT = 10;
const MAX_PLAN_CONTEXT_AGE_MINUTES = 30;
const MAX_OFFERED_SCRIPT_CONTEXT_AGE_MINUTES = 15;
const REDIS_CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const REDIS_STATE_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;
const MIN_POST_COUNT_FOR_PROACTIVE = 1; // Minimum posts for a combo to be considered

// --- Definições para Extração de Métrica Alvo ---
const METRIC_FOCUS_MAP: { [keyword: string]: string | null } = { 'comentarios': 'commentDiffPercentage', 'comentario': 'commentDiffPercentage', 'alcance': 'reachDiffPercentage', 'alcancadas': 'reachDiffPercentage', 'salvamentos': 'saveDiffPercentage', 'salvos': 'saveDiffPercentage', 'compartilhamentos': 'shareDiffPercentage', 'shares': 'shareDiffPercentage', 'curtidas': 'likeDiffPercentage', 'likes': 'likeDiffPercentage', 'visualizacoes': 'avgVisualizacoes', 'views': 'avgVisualizacoes', };
const METRIC_FRIENDLY_NAMES: { [field: string]: string } = { 'commentDiffPercentage': 'Comentários', 'reachDiffPercentage': 'Alcance', 'saveDiffPercentage': 'Salvamentos', 'shareDiffPercentage': 'Compartilhamentos', 'likeDiffPercentage': 'Curtidas', 'avgVisualizacoes': 'Visualizações', 'taxaRetencao': 'Retenção', 'taxaEngajamento': 'Engajamento (Geral)' };
function extractTargetMetricFocus(normalizedQuery: string): { targetMetricField: string | null, friendlyName: string | null } { const fnTag = "[extractTargetMetricFocus]"; const patterns = [ /focado em (?:ter |gerar )?mais (\w+)/, /priorizando (\w+)/, /com mais (\w+)/, /aumentar (\w+)/, /melhorar (\w+)/, /gerar (\w+)/ ]; for (const pattern of patterns) { const match = normalizedQuery.match(pattern); const keyword = match?.[1]; if (keyword && METRIC_FOCUS_MAP[keyword]) { const targetField = METRIC_FOCUS_MAP[keyword]; if (targetField) { const friendlyName = METRIC_FRIENDLY_NAMES[targetField] || targetField; logger.debug(`${fnTag} Métrica alvo identificada: ${keyword} -> ${targetField} (Nome amigável: ${friendlyName})`); return { targetMetricField: targetField, friendlyName: friendlyName }; } } } logger.debug(`${fnTag} Nenhuma métrica alvo específica identificada na query. Usando padrão.`); const defaultSortField = 'shareDiffPercentage'; const defaultFriendlyName = METRIC_FRIENDLY_NAMES[defaultSortField] || defaultSortField; return { targetMetricField: defaultSortField, friendlyName: defaultFriendlyName }; }

// --- Tipagem Explícita para Funções Importadas do promptService ---
type GenerateAIInstructionsType = (userName: string, report: IEnrichedReport, history: string, tone: string, userQuery: string) => string;
type GenerateContentPlanInstructionsType = (userName: string, report: IEnrichedReport, history: string, tone: string, userMessage: string, targetMetricField: keyof DetailedContentStat | null, targetMetricFriendlyName: string | null) => string;
type GenerateGroupedContentPlanInstructionsType = (userName: string, commonCombinationData: { proposal: string; context: string; stat: DetailedContentStat }, enrichedReport: IEnrichedReport, history: string, tone: string, userMessage: string, targetMetricField: keyof DetailedContentStat | null, targetMetricFriendlyName: string | null) => string;
type GenerateRankingInstructionsType = (userName: string, report: IEnrichedReport, history: string, tone: string, userMessage: string) => string;
type GenerateScriptInstructionsType = (userName: string, sourceDescription: string, sourceProposal: string | undefined, sourceContext: string | undefined, history: string, tone: string, userMessage: string) => string;
const generateAIInstructions: GenerateAIInstructionsType = importedGenerateAIInstructions;
const generateContentPlanInstructions: GenerateContentPlanInstructionsType = importedGenerateContentPlanInstructions;
const generateGroupedContentPlanInstructions: GenerateGroupedContentPlanInstructionsType = importedGenerateGroupedContentPlanInstructions;
const generateRankingInstructions: GenerateRankingInstructionsType = importedGenerateRankingInstructions;
const generateScriptInstructions: GenerateScriptInstructionsType = importedGenerateScriptInstructions;

// --- Lógica de Cache (Redis) ---
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
let redisInitialized = false; let isConnecting = false;
redisClient.on('error', (err: Error) => { logger.error('[Redis] Erro:', err); redisInitialized = false; });
redisClient.on('connect', () => { logger.info('[Redis] Conectando...'); });
redisClient.on('ready', () => { logger.info('[Redis] Conectado.'); redisInitialized = true; isConnecting = false; });
redisClient.on('end', () => { logger.warn('[Redis] Conexão encerrada.'); redisInitialized = false; });
const initializeRedis = async (): Promise<void> => { if (!redisInitialized && !isConnecting) { isConnecting = true; logger.info('[Redis] Tentando conectar...'); try { await redisClient.connect(); } catch (err) { logger.error('[Redis] Falha inicial:', err); isConnecting = false; } } };
initializeRedis(); // Initialize on load
const getFromCache = async (key: string): Promise<string | null> => { logger.debug(`[getFromCache] Buscando ${key}`); try { if (!redisInitialized) {await initializeRedis();} return await redisClient.get(key); } catch (err) { logger.error(`[getFromCache] Falha ao buscar ${key}:`, err); return null; } };
const setInCache = async (key: string, value: string, ttlSeconds: number): Promise<string | null> => { logger.debug(`[setInCache] Salvando ${key}`); try { if (!redisInitialized) {await initializeRedis();} return await redisClient.set(key, value, { EX: ttlSeconds }); } catch (err) { logger.error(`[setInCache] Falha ao salvar ${key}:`, err); return null; } };

// --- Lógica de Diálogo/Histórico (Redis) ---
const getDialogueState = async (userId: string): Promise<IDialogueState> => { const key = `dialogue:${userId}`; const fnTag = "[getDialogueState v1.1]"; logger.debug(`${fnTag} Buscando estado para ${userId} (key: ${key})`); try { if (!redisInitialized) await initializeRedis(); const stateString = await redisClient.get(key); logger.debug(`${fnTag} Estado bruto lido do Redis para ${userId}: ${stateString ? stateString.substring(0, 200) + '...' : 'null'}`); if (stateString) { const state = JSON.parse(stateString) as IDialogueState; logger.debug(`${fnTag} Estado parseado para ${userId}:`, state); if(state.recentPlanIdeas && !Array.isArray(state.recentPlanIdeas)) { state.recentPlanIdeas = null; state.recentPlanTimestamp = undefined; } if(state.lastOfferedScriptIdea && typeof state.lastOfferedScriptIdea !== 'object') { state.lastOfferedScriptIdea = null; } if(state.lastOfferedScriptIdea && typeof state.lastOfferedScriptIdea.aiGeneratedIdeaDescription !== 'string') { logger.warn(`${fnTag} Campo lastOfferedScriptIdea.aiGeneratedIdeaDescription inválido, resetando oferta.`); state.lastOfferedScriptIdea = null; } return state; } return {}; } catch (error) { logger.error(`${fnTag} Falha ao buscar ou parsear estado para ${userId}:`, error); return {}; } };
const updateDialogueState = async (userId: string, newState: IDialogueState): Promise<string | null> => { const key = `dialogue:${userId}`; const fnTag = "[updateDialogueState v1.1]"; try { if (!redisInitialized) await initializeRedis(); const stateToSave = Object.entries(newState).reduce((acc, [k, v]) => { if (v !== undefined) { acc[k as keyof IDialogueState] = v; } return acc; }, {} as Partial<IDialogueState>); if (stateToSave.lastOfferedScriptIdea?.timestamp) { const offerAgeMinutes = (Date.now() - stateToSave.lastOfferedScriptIdea.timestamp) / (1000 * 60); if (offerAgeMinutes > MAX_OFFERED_SCRIPT_CONTEXT_AGE_MINUTES) { logger.debug(`${fnTag} Oferta de roteiro antiga (${offerAgeMinutes.toFixed(1)} min) sendo limpa.`); stateToSave.lastOfferedScriptIdea = null; } } if (stateToSave.recentPlanTimestamp) { const planAgeMinutes = (Date.now() - stateToSave.recentPlanTimestamp) / (1000 * 60); if (planAgeMinutes > MAX_PLAN_CONTEXT_AGE_MINUTES) { logger.debug(`${fnTag} Contexto de plano antigo (${planAgeMinutes.toFixed(1)} min) sendo limpo.`); stateToSave.recentPlanIdeas = null; stateToSave.recentPlanTimestamp = undefined; } } const stateString = JSON.stringify(stateToSave); logger.debug(`${fnTag} Estado a ser salvo para ${userId}: ${stateString.substring(0, 200)}...`); await redisClient.set(key, stateString, { EX: REDIS_STATE_TTL_SECONDS }); logger.info(`${fnTag} Estado atualizado para user ${userId}`, { keysUpdated: Object.keys(stateToSave) }); return 'OK'; } catch (err) { logger.error(`${fnTag} Falha ao salvar estado para ${userId}:`, err); return null; } };
const getConversationHistory = async (userId: string): Promise<string> => { const key = `history:${userId}`; logger.debug(`[getConversationHistory] Buscando histórico para ${userId}`); try { if (!redisInitialized) await initializeRedis(); return await redisClient.get(key) ?? ""; } catch (error) { logger.error(`[getConversationHistory] Falha ao buscar histórico para ${userId}:`, error); return ""; } };
const updateConversationContext = async (userId: string, incomingText: string, aiCoreResponse: string, currentHistory?: string): Promise<void> => { const key = `history:${userId}`; const fnTag = '[updateConversationContext v1.1]'; logger.info(`${fnTag} Atualizando histórico para ${userId}`); try { if (!redisInitialized) await initializeRedis(); const historyToUpdate = currentHistory ?? await getConversationHistory(userId); const newEntry = `User: ${incomingText}\nAI: ${aiCoreResponse}`; const updatedHistory = (historyToUpdate ? historyToUpdate + '\n' : '') + newEntry; const historyLines = updatedHistory.split('\n'); const limitedHistory = historyLines.slice(-HISTORY_RAW_LINES_LIMIT * 4).join('\n'); await redisClient.set(key, limitedHistory, { EX: REDIS_HISTORY_TTL_SECONDS }); logger.debug(`${fnTag} Histórico atualizado para ${userId}. Novo tamanho: ${limitedHistory.length} chars.`); } catch (error) { logger.error(`${fnTag} Falha ao atualizar histórico para ${userId}:`, error); } };
const incrementUsageCounter = async (userId: string): Promise<number> => { const key = `usage:${userId}`; logger.debug(`[incrementUsageCounter] Incrementando para ${userId}`); try { if (!redisInitialized) await initializeRedis(); const newValue = await redisClient.incr(key); await redisClient.expire(key, REDIS_STATE_TTL_SECONDS); logger.debug(`[incrementUsageCounter] Novo valor para ${userId}: ${newValue}`); return newValue; } catch (error) { logger.error(`[incrementUsageCounter] Falha ao incrementar uso para ${userId}:`, error); return 0; } };

// --- Sumarização de Histórico ---
function getPromptHistory(fullHistory: string): string { const lines = fullHistory.split('\n'); const linesToTake = Math.min(lines.length, HISTORY_RAW_LINES_LIMIT * 2); return lines.slice(-linesToTake).join('\n'); }
function getLastAIResponse(fullHistory: string): string | null { if (!fullHistory) return null; const lines = fullHistory.trim().split('\n'); for (let i = lines.length - 1; i >= 0; i--) { const line = lines[i]; if (line !== undefined && line !== null && line.trim().startsWith('AI:')) { return line.substring(3).trim(); } } return null; }


// --- Lógica de IA (Opossum, Retry) ---
const openAICallAction = async (prompt: string): Promise<string> => { logger.debug("[openAICallAction] Executando callOpenAIForQuestion..."); return await callOpenAIForQuestion(prompt); };
const breakerOptions: opossum.Options = { timeout: 60000, errorThresholdPercentage: 50, resetTimeout: 30000 }; const openAIBreaker = new opossum(openAICallAction, breakerOptions); openAIBreaker.on('open', () => logger.warn(`[Opossum] Circuito ABERTO para AI Service.`)); openAIBreaker.on('close', () => logger.info(`[Opossum] Circuito FECHADO para AI Service.`)); openAIBreaker.on('halfOpen', () => logger.info(`[Opossum] Circuito MEIO-ABERTO para AI Service.`)); openAIBreaker.on('success', (result) => logger.debug(`[Opossum] Chamada AI Service SUCCESS.`)); openAIBreaker.on('failure', (error) => logger.warn(`[Opossum] Chamada AI Service FAILURE. Erro: ${error?.constructor?.name || typeof error} - ${error instanceof Error ? error.message : String(error)}`));
async function callAIWithResilience(prompt: string): Promise<string> { const fnTag = "[callAIWithResilience]"; logger.debug(`${fnTag} Tentando executar via Opossum...`); try { const result = await openAIBreaker.fire(prompt); if (typeof result === 'string' && result.trim() !== '') { logger.debug(`${fnTag} Opossum executou com SUCESSO e resultado é NÃO VAZIO.`); return result; } logger.error(`${fnTag} Opossum retornou SUCESSO mas resultado é INESPERADO ou VAZIO. Tipo: ${typeof result}`, { result }); throw new AIError("Resultado inesperado ou vazio recebido da camada de resiliência da IA.", undefined); } catch (error: unknown) { logger.warn(`${fnTag} Falha ao executar via Opossum. Processando erro...`); if (error instanceof AIError) { throw error; } if (error instanceof Error && error.name === 'BreakerOpenError') { throw new AIError("Serviço da IA temporariamente indisponível (Circuito Aberto). Tente novamente mais tarde.", error); } let errorMessage = "Erro desconhecido na camada de resiliência da IA."; let originalError: Error | undefined; if (error instanceof Error) { originalError = error; errorMessage = `Falha na camada de resiliência da IA: ${error.message}`; logger.error(`${fnTag} Erro capturado:`, { name: error.name, message: error.message }); } else { errorMessage = `Falha inesperada (não-Error) na camada de resiliência da IA: ${String(error)}`; logger.error(`${fnTag} Falha inesperada (não-Error) capturada:`, { error }); originalError = undefined; } throw new AIError(errorMessage, originalError); } }

// --- Funções Auxiliares para Contexto e Parsing (Definidas ANTES do uso) ---
const CONTEXT_NOISE_WORDS = new Set(normalizeTextInput(`o a os as um uma uns umas de do da dos das em no na nos nas por para com quero queria gostaria faz fazer faca pode ser me da manda cria crie o a roteiro script estrutura sobre pra pro p`).split(/\s+/).filter(w => w.length > 1));

function parsePlanItemsFromResponse(responseText: string): IPlanItemContext[] | null {
    const fnTag = "[parsePlanItemsFromResponse v3.X]";
    logger.debug(`${fnTag} Tentando extrair itens do plano...`);
    const items: IPlanItemContext[] = [];
    if (!responseText) {
        logger.warn(`${fnTag} Texto de resposta vazio.`);
        return null;
    }
    try {
        // Try grouped format first
        const groupedHeaderRegex = /🎯 \*\*Análise da Estratégia Principal: Foco em\s*["']([^"']+)["']\s*sobre\s*["']([^"']+)["']\*\*?/i;
        const groupedHeaderMatch = responseText.match(groupedHeaderRegex);

        if (groupedHeaderMatch && groupedHeaderMatch[1] && groupedHeaderMatch[2]) {
            const commonProposal = groupedHeaderMatch[1].trim();
            const commonContext = groupedHeaderMatch[2].trim();
            logger.info(`${fnTag} Detectado formato de plano AGRUPADO. Proposta: ${commonProposal}, Contexto: ${commonContext}`);
            const ideasSectionRegex = /(?:💡 \*\*Ideias de Conteúdo Sugeridas.*?\*\*|Sugestões para a Semana:)\s*\n([\s\S]+?)(?:---|\n#|$)/i;
            const ideasSectionMatch = responseText.match(ideasSectionRegex);

            if (ideasSectionMatch && ideasSectionMatch[1]) {
                const ideasBlock = ideasSectionMatch[1];
                // Regex for items like: * **[Day/ID]:** "Description"
                const ideaItemRegex = /^\s*[\*\-]\s*\**\[?([^:\]]+)\]?:\**\s*["“]?(.*?)["”]?\s*$/gm;
                let ideaMatch;
                while ((ideaMatch = ideaItemRegex.exec(ideasBlock)) !== null) {
                    const identifier = ideaMatch[1]?.trim();
                    let description = ideaMatch[2]?.trim();
                    if (identifier && description) {
                        logger.debug(`${fnTag} Item Agrupado Extraído: ID='${identifier}', Desc='${description.substring(0, 30)}...'`);
                        items.push({ identifier, description, proposal: commonProposal, context: commonContext });
                    } else {
                        logger.warn(`${fnTag} Falha ao extrair grupos do match da regex para item agrupado: Match[0]='${ideaMatch[0]}', Match[1]='${ideaMatch[1]}', Match[2]='${ideaMatch[2]}'`);
                    }
                }
                if (items.length === 0) {
                    logger.warn(`${fnTag} Bloco de ideias agrupadas encontrado, mas a regex não extraiu nenhum item. Verifique a regex e o formato da resposta da IA no bloco: \n---\n${ideasBlock}\n---`);
                }
            } else {
                logger.warn(`${fnTag} Formato agrupado detectado, mas seção/bloco de ideias não encontrada ou formato inesperado após o header.`);
                if (groupedHeaderMatch?.index !== undefined && groupedHeaderMatch[0] !== undefined) {
                    const startIndex = groupedHeaderMatch.index + groupedHeaderMatch[0].length;
                    const endIndex = startIndex + 500;
                    logger.debug(`${fnTag} Conteúdo após header agrupado para análise: ${responseText.substring(startIndex, endIndex)}...`);
                }
             }
        } else {
            // Try standard day-by-day format
            logger.debug(`${fnTag} Formato agrupado não detectado, tentando formato padrão (dia a dia).`);
            // Regex for headers like: **[Day]: Foco em [Proposal] sobre [Context]**
            const headerRegex = /\*\*\s*\[?([^\]:]+?)\]?:\s*Foco em\s*\[?([^\]]+?)\]?\s*sobre\s*\[?([^\]]+?)\]?\s*\*\*/g;
            // Regex for the idea description following the header
            const ideaRegex = /(?:Ideia de Conteúdo:|Que tal:)(?:.*?)(?:\*\*"([^"]+)"|\*\*([^*]+)\*\*|"?([^"\n]+)"?)/si;
            let headerMatch;

            // Find all header matches first
            const headers: { match: RegExpExecArray; index: number; length: number; }[] = [];
            while ((headerMatch = headerRegex.exec(responseText)) !== null) {
                // Ensure headerMatch is not null before accessing properties
                 if (headerMatch && headerMatch.index !== undefined && headerMatch[0] !== undefined) {
                    headers.push({ match: headerMatch, index: headerMatch.index, length: headerMatch[0].length });
                 }
            }
            headerRegex.lastIndex = 0; // Reset regex

            // Process each header section
            for(let i = 0; i < headers.length; i++) {
                const currentHeader = headers[i];
                // --- CORREÇÃO APLICADA AQUI ---
                if (currentHeader) { // Add safety check for currentHeader
                    const identifier = currentHeader.match[1]?.trim();
                    const proposal = currentHeader.match[2]?.trim();
                    const context = currentHeader.match[3]?.trim();

                    const currentHeaderEnd = currentHeader.index + currentHeader.length;
                    const nextHeaderStart = (i + 1 < headers.length) ? headers[i+1]?.index ?? responseText.length : responseText.length; // Add nullish coalescing for safety
                    const searchArea = responseText.substring(currentHeaderEnd, nextHeaderStart);

                    const ideaMatch = searchArea.match(ideaRegex);
                    const description = (ideaMatch?.[1] || ideaMatch?.[2] || ideaMatch?.[3])?.trim();

                    if (identifier && description) {
                        logger.debug(`${fnTag} Item Padrão: ID='${identifier}', Desc='${description.substring(0, 30)}...'`);
                        items.push({ identifier, description, proposal, context });
                    } else {
                        logger.warn(`${fnTag} Falha ao extrair item completo para header padrão: ${currentHeader.match[0]} (Descrição não encontrada na área [${currentHeaderEnd}..${nextHeaderStart}])`);
                        logger.debug(`${fnTag} Conteúdo da área de busca para header padrão: '${searchArea.substring(0,100)}...'`);
                    }
                } else {
                     logger.error(`${fnTag} Erro inesperado: currentHeader é undefined no loop index ${i}.`);
                }
                // --- FIM DA CORREÇÃO ---
            }
        }

        logger.info(`${fnTag} Extraídos ${items.length} itens do plano no total.`);
        return items.length > 0 ? items : null;
    } catch (error) {
        logger.error(`${fnTag} Erro durante parsing do plano:`, error);
        return null;
    }
}

function findPlanItemByUserInput( userInput: string, planItems: IPlanItemContext[] ): IPlanItemContext | null {
    const fnTag = "[findPlanItemByUserInput v1.2]";
    const normalizedInput = normalizeTextInput(userInput);

    if (!normalizedInput || !planItems || planItems.length === 0) {
        logger.debug(`${fnTag} Input ou itens do plano inválidos/vazios.`);
        return null;
    }

    const inputWords = normalizedInput.split(' ');
    const cleanedInputWords = inputWords
        .map(word => word.replace(/[?.,!]/g, '')) // Remove punctuation
        .filter(word => !CONTEXT_NOISE_WORDS.has(word) && word.length > 0); // Remove noise words and empty strings

    const cleanedInput = cleanedInputWords.join(' ').trim();

    logger.debug(`${fnTag} Buscando por input limpo "${cleanedInput}" (palavras: [${cleanedInputWords.join(', ')}]) em ${planItems.length} itens.`);
    if (!cleanedInput) {
        logger.debug(`${fnTag} Input vazio após limpeza.`);
        return null;
    }

    // Iterate through plan items trying different matching strategies
    for (let i = 0; i < planItems.length; i++) {
        const item = planItems[i];
        if (!item || !item.identifier) continue;

        // Normalize the item identifier (remove accents, lowercase, remove brackets)
        const normalizedIdentifier = normalizeTextInput(item.identifier.replace(/[\[\]]/g, ''));
        if (!normalizedIdentifier) continue; // Skip if normalized identifier is empty

        // --- Strategy 1: Exact Match ---
        if (normalizedIdentifier === cleanedInput) {
            logger.info(`${fnTag} Match Exato: ID='${item.identifier}', Input Limpo='${cleanedInput}'`);
            return item;
        }

        // --- Strategy 2: Index or Ordinal Match ---
        const itemIndexStr = (i + 1).toString();
        for (const word of cleanedInputWords) { // Use cleaned words
            const inputIsIndex = word === itemIndexStr;
            // Regex for ordinals (1, 1º, 1a, 2, 2º, 2a..., primeiro, segunda...) - Improved regex
            const ordinalMatch = word.match(/^(?:([1-7])(?:[ºªo]?)|(primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|quint[ao]|sext[ao]|setim[ao]))$/);
            let inputIsOrdinal = false;
            if (ordinalMatch) {
                const numPart = ordinalMatch[1] ? parseInt(ordinalMatch[1], 10) : null; // Numeric group
                const textPart = ordinalMatch[2]; // Textual group

                if (numPart !== null && !isNaN(numPart)) {
                    inputIsOrdinal = (numPart === i + 1);
                } else if (textPart) { // Compare textual part
                    inputIsOrdinal =
                        (textPart.startsWith("primeir") && i === 0) ||
                        (textPart.startsWith("segund") && i === 1) ||
                        (textPart.startsWith("terceir") && i === 2) ||
                        (textPart.startsWith("quart") && i === 3) ||
                        (textPart.startsWith("quint") && i === 4) ||
                        (textPart.startsWith("sext") && i === 5) ||
                        (textPart.startsWith("setim") && i === 6); // Expanded to 7
                }
            }

            if (inputIsIndex || inputIsOrdinal) {
                logger.info(`${fnTag} Match por Índice/Ordinal ('${word}'): ID='${item.identifier}'`);
                return item;
            }
        }

        // --- Strategy 3: Identifier Prefix Match ---
        // Get the prefix of the ALREADY NORMALIZED identifier
        const identifierPrefix = normalizedIdentifier.split(/[\s:-]/)[0]?.replace('.', '') ?? '';

        // Compare the FULL cleaned input with the normalized prefix
        if (identifierPrefix && cleanedInput === identifierPrefix) {
             logger.info(`${fnTag} Match por Prefixo Exato ('${cleanedInput}'): ID='${item.identifier}' (Prefixo Normalizado: '${identifierPrefix}')`);
             return item;
        }
        // Compare EACH cleaned input word with the prefix (e.g., input "a segunda", prefix "segunda")
        for (const word of cleanedInputWords) {
             if (identifierPrefix && word === identifierPrefix) {
                 logger.info(`${fnTag} Match por Palavra=Prefixo ('${word}'): ID='${item.identifier}' (Prefixo Normalizado: '${identifierPrefix}')`);
                 return item;
             }
        }

        // --- Strategy 4: Word Inclusion Match (More Restrictive) ---
        // Only attempt if input has at least 1 significant word
        if (cleanedInputWords.length >= 1) {
            const identifierWords = new Set(normalizedIdentifier.split(' ')); // Use Set for faster lookup
            // Check if ALL cleaned input words are included in the normalized identifier
            const allInputWordsIncluded = cleanedInputWords.every(inputWord =>
                identifierWords.has(inputWord) || normalizedIdentifier.includes(inputWord) // Check exact word or substring
            );

            if (allInputWordsIncluded) {
                // Additional check: Avoid match if input is just a single contained letter but not the exact word
                const isSingleCharMisMatch = cleanedInput.length === 1 && cleanedInputWords.length === 1 && !identifierWords.has(cleanedInput);
                if (!isSingleCharMisMatch) {
                    logger.info(`${fnTag} Match por Inclusão de Palavras: ID='${item.identifier}', Input Limpo='${cleanedInput}'`);
                    return item;
                } else {
                    logger.debug(`${fnTag} Match por Inclusão evitado para input de letra única não exata: '${cleanedInput}' em '${normalizedIdentifier}'`);
                }
            }
        }
    } // End loop through items

    logger.warn(`${fnTag} Nenhuma correspondência encontrada para input limpo "${cleanedInput}".`);
    return null; // Return null if no strategy finds a match
}

function extractProactiveSuggestionContext(aiResponse: string): { aiGeneratedIdeaDescription: string } | null {
    const fnTag = "[extractProactiveSuggestionContext v3.0]";
    if (!aiResponse) return null;
    try {
        // Regex to find the placeholder and capture the description
        const placeholderRegex = /\*\*Próximo Passo Roteiro:\*\*.*?\(["\*]([^")]+)["\*]\)/i;
        const match = aiResponse.match(placeholderRegex);
        if (match && match[1]) {
            const description = match[1].trim();
            logger.info(`${fnTag} Contexto de sugestão proativa extraído do placeholder: AI Gen Desc='${description}'`);
            return { aiGeneratedIdeaDescription: description };
        }
        logger.debug(`${fnTag} Placeholder de oferta proativa de roteiro não encontrado na resposta da IA.`);
        return null;
    } catch (error) {
        logger.error(`${fnTag} Erro durante parsing do placeholder de sugestão proativa:`, error);
        return null;
    }
}

// --- Funções Auxiliares de Orquestração (Definidas ANTES do uso) ---
async function loadContext(userIdStr: string): Promise<{ dialogueState: IDialogueState, conversationHistory: string }> {
    logger.debug(`[loadContext] Carregando contexto para ${userIdStr}`);
    const [dialogueState, conversationHistory] = await Promise.all([
        getDialogueState(userIdStr),
        getConversationHistory(userIdStr)
    ]);
    logger.debug(`[loadContext] Contexto carregado para ${userIdStr}. Estado Keys: ${Object.keys(dialogueState).join(', ')}. Tam Histórico: ${conversationHistory.length}. Oferta Roteiro:`, dialogueState.lastOfferedScriptIdea);
    return { dialogueState, conversationHistory };
}

const adjustTone = (tone: string): string => tone;

const persistDialogueGraph = async (): Promise<void> => {
    // Placeholder for future graph persistence logic
    logger.debug("[persistDialogueGraph] Placeholder chamado.");
};

const getGraphSummary = async (): Promise<string> => {
    // Placeholder for future graph summary logic
    logger.debug("[getGraphSummary] Placeholder chamado.");
    return "";
};

async function addGreetingAndGraph(
    baseResponse: string,
    userIdStr: string,
    greeting: string,
    dialogueState: IDialogueState
): Promise<{ finalResponse: string; greetingAdded: boolean }> {
    const fnTag = "[addGreetingAndGraph]";
    logger.debug(`${fnTag} Recebeu baseResponse: "${baseResponse?.substring(0, 100)}..."`);
    let finalResponse = baseResponse;
    let greetingAdded = false;
    const now = Date.now();

    if (greeting) {
        const lastGreetingTime = dialogueState.lastGreetingSent;
        const needsGreeting = !lastGreetingTime || (now - lastGreetingTime > GREETING_RECENCY_THRESHOLD_MINUTES * 60 * 1000);

        if (needsGreeting) {
            logger.debug(`${fnTag} Adicionando saudação para user ${userIdStr}`);
            finalResponse = `${greeting}\n\n${baseResponse}`;
            greetingAdded = true;
            // Note: Updating dialogueState.lastGreetingSent happens in the calling function AFTER this returns
        }
    }

    // Placeholder for adding graph summary - currently does nothing
    // const graphSummary = await getGraphSummary();
    // if (graphSummary) {
    //     finalResponse += `\n\n${graphSummary}`;
    // }

    return { finalResponse, greetingAdded };
}

function formatPostListWithLinks(posts: IMetricMinimal[] | undefined, title: string): string {
    if (!posts || posts.length === 0) return "";
    let formatted = `\n${title}\n`;
    posts.forEach(post => {
        const description = post.description?.substring(0, 50) || 'Post sem descrição';
        const link = post.postLink ? `([ver](${post.postLink}))` : '';
        formatted += `- ${description}... ${link}\n`;
    });
    return formatted;
}


// =========================================================================
// <<< INÍCIO: Definições de Tipo e Type Guard para _handleGeneralRequest >>>
// =========================================================================
type BestPostType = { _id: Types.ObjectId; description?: string | null; postLink?: string; shares?: number; saves?: number; };
// Type guard to check if a post object is valid and has a non-empty description
function isValidBestPostWithDescription(post: any): post is BestPostType & { description: string } {
    return !!post && typeof post.description === 'string' && post.description.trim().length > 0;
}
// =========================================================================
// <<< FIM: Definições de Tipo e Type Guard >>>
// =========================================================================

// --- Funções Auxiliares para Lógica Proativa de Roteiro ---
function containsDayOfWeek(normalizedQuery: string): boolean {
    const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
    return days.some(day => normalizedQuery.includes(day));
}

function isGenericScriptRequest(normalizedQuery: string): boolean {
    // Checks if the query asks for a script without specifying much else
    // Examples: "me da um roteiro", "cria roteiro", "faz um script"
    const patterns = [
        /^(me )?(da|de|cria|crie|gera|gere|faz|faca) (um|o) (roteiro|script)$/,
        /^(quero|gostaria de) (um|o) (roteiro|script)$/
    ];
    return patterns.some(pattern => pattern.test(normalizedQuery));
}

function extractDayOfWeek(normalizedQuery: string): string | null {
    // Maps variations to a standard name or returns null
    if (normalizedQuery.includes('segunda')) return 'segunda-feira';
    if (normalizedQuery.includes('terca')) return 'terça-feira';
    if (normalizedQuery.includes('quarta')) return 'quarta-feira';
    if (normalizedQuery.includes('quinta')) return 'quinta-feira';
    if (normalizedQuery.includes('sexta')) return 'sexta-feira';
    if (normalizedQuery.includes('sabado')) return 'sábado';
    if (normalizedQuery.includes('domingo')) return 'domingo';
    return null;
}

/**
 * Finds the best performing combination based on report data.
 * Currently prioritizes overall best by shareDiffPercentage.
 * Day-specific filtering needs data structure support.
 */
async function findBestCombinationForScript(report: IEnrichedReport, targetDay: string | null): Promise<DetailedContentStat | null> {
    const fnTag = "[findBestCombinationForScript]";
    logger.debug(`${fnTag} Buscando melhor combinação. Dia alvo: ${targetDay || 'Geral'}`);

    if (!report.detailedContentStats || report.detailedContentStats.length === 0) {
        logger.warn(`${fnTag} Não há detailedContentStats no relatório.`);
        return null;
    }

    let candidates = [...report.detailedContentStats];

    if (targetDay) {
        // !!! IMPORTANT: Day-specific filtering logic needs implementation here.
        // This requires the 'detailedContentStats' or the underlying metrics
        // to have date information associated with them to allow filtering by day of the week.
        // If this is not possible with the current data structure, this part should be skipped
        // or return an empty array, forcing fallback to overall best.
        logger.warn(`${fnTag} Filtro por dia (${targetDay}) NÃO IMPLEMENTADO. Usando dados gerais.`);
        // Example: candidates = candidates.filter(stat => isStatForDay(stat, targetDay));
    }

    // Filter for combinations with at least MIN_POST_COUNT_FOR_PROACTIVE post(s) and a usable description in bestPostInGroup
    candidates = candidates.filter(stat =>
        stat &&
        stat.count >= MIN_POST_COUNT_FOR_PROACTIVE &&
        stat.bestPostInGroup &&
        typeof stat.bestPostInGroup.description === 'string' &&
        stat.bestPostInGroup.description.trim().length > 0
    );

    if (candidates.length === 0) {
        logger.warn(`${fnTag} Nenhuma combinação candidata encontrada ${targetDay ? `para ${targetDay}` : 'geral'} após filtros (count >= ${MIN_POST_COUNT_FOR_PROACTIVE}, descrição válida).`);
        return null;
    }

    // Sort by the desired metric (e.g., shareDiffPercentage descending)
    candidates.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));

    const bestOverall = candidates[0];
    if (bestOverall) {
        logger.info(`${fnTag} Melhor combinação encontrada ${targetDay ? `(considerando ${targetDay})` : '(geral)'}: P='${bestOverall._id?.proposal}', C='${bestOverall._id?.context}'`);
    } else {
         logger.warn(`${fnTag} Ordenação não retornou melhor combinação.`);
    }
    return bestOverall || null;
}

// --- Funções Handler Refatoradas ---

interface HandlerParams {
    user: IUser;
    incomingText: string;
    normalizedQuery: string;
    promptHistoryForAI: string;
    conversationHistory: string; // Full history for context updates
    initialDialogueState: IDialogueState;
    tone: string;
    userIdStr: string;
    greeting: string;
    enrichedReport?: IEnrichedReport; // Report data, fetched before calling handler
}
interface HandlerResult {
    aiCoreResponse: string; // The core response from the AI (without greeting/extras)
    nextDialogueState: IDialogueState; // The state to be saved
    finalResponseString: string; // The final response to send to the user (with greeting/extras)
}

/**
 * Handler for script_request intent (v1.5 - Proactive Logic)
 */
async function _handleScriptRequest(params: HandlerParams): Promise<HandlerResult> {
    const { user, incomingText, normalizedQuery, promptHistoryForAI, conversationHistory, initialDialogueState, tone, userIdStr, greeting, enrichedReport } = params;
    const scriptFlowTag = "[_handleScriptRequest v1.5 - Proactive Logic]";
    logger.debug(`${scriptFlowTag} Iniciando...`);

    let sourceDescription: string | undefined;
    let sourceProposal: string | undefined;
    let sourceContext: string | undefined;
    let scriptSourceFound = false;
    let finalClarificationMessage: string | null = null;
    // Start with initial state, update as needed, ensure lastInteraction is set
    let nextState: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now() };

    logger.debug(`${scriptFlowTag} Estado inicial recebido:`, initialDialogueState);

    // 1. Try finding explicit source (post reference)
    logger.debug(`${scriptFlowTag} Tentando extrair referência explícita...`);
    const referenceResult = await dataService.extractReferenceAndFindPost(incomingText, user._id);
    if (referenceResult.status === 'found' && referenceResult.post) {
        if (referenceResult.post.description) {
            logger.info(`${scriptFlowTag} Fonte explícita encontrada: Post ID ${referenceResult.post._id}`);
            sourceDescription = referenceResult.post.description;
            sourceProposal = referenceResult.post.proposal;
            sourceContext = referenceResult.post.context;
            scriptSourceFound = true;
        } else {
            logger.warn(`${scriptFlowTag} Post ${referenceResult.post._id} encontrado, mas sem descrição.`);
            finalClarificationMessage = 'Encontrei o post que você mencionou, mas ele parece não ter uma descrição para eu poder analisar e criar o roteiro. 🤔';
        }
    } else if (referenceResult.status === 'error') {
        logger.error(`${scriptFlowTag} Erro de dataService ao buscar referência: ${referenceResult.message}`);
        // Preserve state before throwing
        nextState = { ...nextState, recentPlanIdeas: initialDialogueState.recentPlanIdeas, recentPlanTimestamp: initialDialogueState.recentPlanTimestamp, lastOfferedScriptIdea: initialDialogueState.lastOfferedScriptIdea };
        await updateDialogueState(userIdStr, nextState); // Attempt to save state before erroring
        throw new DatabaseError(referenceResult.message || "Desculpe, tive um problema ao buscar a referência do seu post.");
    } else {
        logger.debug(`${scriptFlowTag} Referência explícita não encontrada ou ambígua. Status: ${referenceResult.status}`);
        if (referenceResult.status === 'clarify' && referenceResult.message) {
            finalClarificationMessage = referenceResult.message;
        }
    }

    // 2. Try finding contextual source (recent plan)
    if (!scriptSourceFound) {
        logger.debug(`${scriptFlowTag} Verificando contexto de plano recente no estado...`);
        const recentIdeas = initialDialogueState.recentPlanIdeas;
        const planTimestamp = initialDialogueState.recentPlanTimestamp;
        logger.debug(`${scriptFlowTag} Contexto do plano no estado:`, { hasIdeas: !!recentIdeas, count: recentIdeas?.length, timestamp: planTimestamp });

        if (recentIdeas && recentIdeas.length > 0 && planTimestamp) {
            const planAgeMinutes = (Date.now() - planTimestamp) / (1000 * 60);
            if (planAgeMinutes < MAX_PLAN_CONTEXT_AGE_MINUTES) {
                const matchedItem = findPlanItemByUserInput(incomingText, recentIdeas);
                if (matchedItem) {
                    logger.info(`${scriptFlowTag} Fonte contextual (plano) encontrada: Identifier='${matchedItem.identifier}'`);
                    sourceDescription = matchedItem.description;
                    sourceProposal = matchedItem.proposal;
                    sourceContext = matchedItem.context;
                    scriptSourceFound = true;
                    nextState.recentPlanIdeas = null; // Clear used context
                    nextState.recentPlanTimestamp = undefined;
                }
            } else {
                logger.debug(`${scriptFlowTag} Contexto do plano antigo (>${MAX_PLAN_CONTEXT_AGE_MINUTES} min). Limpando.`);
                nextState.recentPlanIdeas = null;
                nextState.recentPlanTimestamp = undefined;
            }
        } else {
            logger.debug(`${scriptFlowTag} Nenhum contexto de plano válido no estado.`);
        }
    }

    // 3. Try finding contextual source (accepted proactive offer)
    if (!scriptSourceFound) {
        logger.debug(`${scriptFlowTag} Verificando última oferta proativa de roteiro no estado...`);
        const offeredContext = initialDialogueState.lastOfferedScriptIdea;
        logger.debug(`${scriptFlowTag} Contexto da oferta no estado:`, offeredContext);

        if (offeredContext && offeredContext.timestamp) {
            const offerAgeMinutes = (Date.now() - offeredContext.timestamp) / (1000 * 60);
            logger.debug(`${scriptFlowTag} Idade da oferta: ${offerAgeMinutes.toFixed(1)} min (Max: ${MAX_OFFERED_SCRIPT_CONTEXT_AGE_MINUTES})`);
            if (offerAgeMinutes < MAX_OFFERED_SCRIPT_CONTEXT_AGE_MINUTES) {
                 if (isSimpleConfirmation(normalizedQuery)) {
                    logger.info(`${scriptFlowTag} Contexto de oferta proativa válido e input é confirmação. Usando como fonte.`);
                    // Prioritize original source if available
                    if (offeredContext.originalSource?.description) {
                        sourceDescription = offeredContext.originalSource.description;
                        sourceProposal = offeredContext.originalSource.proposal;
                        sourceContext = offeredContext.originalSource.context;
                        logger.debug(`${scriptFlowTag} Usando fonte original da oferta: "${sourceDescription.substring(0,50)}..."`);
                    } else {
                        sourceDescription = offeredContext.aiGeneratedIdeaDescription;
                        sourceProposal = undefined; // Cannot infer from AI description alone
                        sourceContext = undefined;
                        logger.debug(`${scriptFlowTag} Usando descrição gerada pela IA da oferta: "${sourceDescription.substring(0,50)}..."`);
                    }
                    scriptSourceFound = true;
                    nextState.lastOfferedScriptIdea = null; // Clear used context
                 } else {
                     logger.debug(`${scriptFlowTag} Contexto de oferta recente, mas input não é confirmação simples. Mantendo oferta no estado.`);
                     // Keep the offer in the state if not explicitly accepted/rejected by non-confirmation
                     nextState.lastOfferedScriptIdea = initialDialogueState.lastOfferedScriptIdea;
                 }
            } else {
                logger.debug(`${scriptFlowTag} Contexto de oferta proativa encontrado, mas muito antigo. Limpando.`);
                 nextState.lastOfferedScriptIdea = null; // Clear expired context
            }
        } else {
            logger.debug(`${scriptFlowTag} Nenhuma oferta proativa válida encontrada no estado.`);
            nextState.lastOfferedScriptIdea = null; // Ensure it's null if not found
        }
    }

    // --- START: New Proactive Logic Block ---
    if (!scriptSourceFound) {
        const isProactiveTrigger = containsDayOfWeek(normalizedQuery) || isGenericScriptRequest(normalizedQuery);
        logger.debug(`${scriptFlowTag} Verificando gatilho proativo: ${isProactiveTrigger}`);

        if (isProactiveTrigger) {
            // Ensure we have report data (should have been fetched by processMainAIRequest)
            if (!enrichedReport) {
                logger.error(`${scriptFlowTag} Erro Crítico: Lógica proativa de roteiro requer enrichedReport, mas não foi fornecido. Verifique processMainAIRequest.`);
                // Handle this critical error - maybe throw or return a specific error message
                throw new Error("Relatório de dados não disponível para roteiro proativo.");
            }

            const targetDay = extractDayOfWeek(normalizedQuery);
            logger.debug(`${scriptFlowTag} Tentando análise proativa. Dia alvo: ${targetDay}`);

            // Find the best combination (prioritizes overall best for now)
            const bestCombination = await findBestCombinationForScript(enrichedReport, targetDay);

            if (bestCombination) {
                // Description is already validated within findBestCombinationForScript
                logger.info(`${scriptFlowTag} Melhor combinação proativa encontrada: P='${bestCombination._id.proposal}', C='${bestCombination._id.context}'`);
                sourceDescription = bestCombination.bestPostInGroup!.description!; // Non-null assertion based on filter
                sourceProposal = bestCombination._id.proposal;
                sourceContext = bestCombination._id.context;
                scriptSourceFound = true;
                logger.info(`${scriptFlowTag} Usando descrição do bestPostInGroup para roteiro proativo.`);
                // Clear potentially lingering context from previous steps if proactive is used
                nextState.recentPlanIdeas = null;
                nextState.recentPlanTimestamp = undefined;
                nextState.lastOfferedScriptIdea = null;
            } else {
                logger.warn(`${scriptFlowTag} Nenhuma combinação adequada encontrada na análise proativa.`);
                // Proactive analysis was triggered but failed to find a source
                const overallBest = await findBestCombinationForScript(enrichedReport, null); // Find overall best as fallback suggestion
                const suggestion = overallBest?.bestPostInGroup?.description // Check if overall best has description
                    ? `Que tal criarmos um roteiro baseado na sua combinação de maior sucesso geral: **${overallBest._id.proposal || 'N/A'}** sobre **${overallBest._id.context || 'N/A'}**?`
                    : "Você prefere me dar uma ideia ou tema específico?";
                const dayMentioned = targetDay ? `para ${targetDay.charAt(0).toUpperCase() + targetDay.slice(1)} ` : "";
                finalClarificationMessage = `Não encontrei dados específicos ${dayMentioned}no seu histórico recente para basear um roteiro proativo. 😕 ${suggestion}`;
                logger.info(`${scriptFlowTag} Análise proativa falhou. Definindo mensagem de clarificação específica.`);
                // Clear context as proactive failed
                nextState.recentPlanIdeas = null;
                nextState.recentPlanTimestamp = undefined;
                nextState.lastOfferedScriptIdea = null;
            }
        } else {
             logger.debug(`${scriptFlowTag} Não é um gatilho proativo.`);
             // If not proactive trigger and no source found yet, ensure context is cleared if expired
             if (nextState.recentPlanTimestamp && (Date.now() - nextState.recentPlanTimestamp) / (1000 * 60) > MAX_PLAN_CONTEXT_AGE_MINUTES) {
                 nextState.recentPlanIdeas = null;
                 nextState.recentPlanTimestamp = undefined;
             }
             if (nextState.lastOfferedScriptIdea?.timestamp && (Date.now() - nextState.lastOfferedScriptIdea.timestamp) / (1000 * 60) > MAX_OFFERED_SCRIPT_CONTEXT_AGE_MINUTES) {
                 nextState.lastOfferedScriptIdea = null;
             }
        }
    }
    // --- END: New Proactive Logic Block ---

    // 4. Final Decision: Generate Script or Clarify
    logger.debug(`${scriptFlowTag} Decisão final: scriptSourceFound=${scriptSourceFound}, sourceDescription=${!!sourceDescription}`);
    if (scriptSourceFound && sourceDescription) {
        logger.info(`${scriptFlowTag} Fonte final encontrada. Gerando prompt de roteiro...`);
        // Ensure proposal/context are strings or undefined
        const finalSourceProposal = typeof sourceProposal === 'string' ? sourceProposal : undefined;
        const finalSourceContext = typeof sourceContext === 'string' ? sourceContext : undefined;

        const prompt = generateScriptInstructions(
            user.name || "usuário",
            sourceDescription,
            finalSourceProposal,
            finalSourceContext,
            promptHistoryForAI,
            tone,
            incomingText // Pass original user message for context in prompt
        );
        const aiCoreResponse = await callAIWithResilience(prompt);

        // Add greeting if needed, update lastGreetingSent in nextState
        const { finalResponse, greetingAdded } = await addGreetingAndGraph(aiCoreResponse, userIdStr, greeting, nextState);
        if (greetingAdded) {
            nextState.lastGreetingSent = Date.now();
        }

        logger.debug(`${scriptFlowTag} Roteiro gerado pela IA OK.`);
        // Ensure lastInteraction is updated
        nextState.lastInteraction = Date.now();
        return { aiCoreResponse, nextDialogueState: nextState, finalResponseString: finalResponse };

    } else {
        logger.info(`${scriptFlowTag} Fonte não encontrada ou inválida. Retornando clarificação.`);
        // Use the specific message if proactive failed, otherwise use the default/reference clarification
        const response = finalClarificationMessage ?? "Não consegui identificar exatamente sobre qual ideia você quer o roteiro. Pode me dar uma referência mais clara?";

        // Add greeting if needed, update lastGreetingSent in nextState
        // IMPORTANT: Preserve relevant context if clarification is needed (e.g., keep plan ideas if asking about them)
        // The current logic clears context when proactive logic runs and finds something OR fails.
        // If clarification is the *standard* one (not the proactive failure one), we might need to preserve context.
        // Let's stick to the state as modified by the logic above for now.
        const { finalResponse: finalClarificationWithGreeting, greetingAdded } = await addGreetingAndGraph(response, userIdStr, greeting, nextState);
        if (greetingAdded) {
            nextState.lastGreetingSent = Date.now();
        }
        // Ensure lastInteraction is updated
        nextState.lastInteraction = Date.now();
        return { aiCoreResponse: response, nextDialogueState: nextState, finalResponseString: finalClarificationWithGreeting };
    }
}


/** Handler para a intenção content_plan */
async function _handleContentPlanRequest(params: HandlerParams): Promise<HandlerResult> {
    const { user, incomingText, normalizedQuery, promptHistoryForAI, initialDialogueState, tone, userIdStr, greeting, enrichedReport } = params;
    const planFlowTag = "[_handleContentPlanRequest v1.3 - Dynamic Metric]";
    logger.debug(`${planFlowTag} Iniciando...`);
    if (!enrichedReport) { throw new Error("Relatório enriquecido (enrichedReport) não foi fornecido para _handleContentPlanRequest. Verifique o fluxo de dados."); }
    const { targetMetricField, friendlyName: targetMetricFriendlyName } = extractTargetMetricFocus(normalizedQuery);
    let prompt: string;
    let commonCombinationDataForPlan: { proposal: string; context: string; stat: DetailedContentStat } | null = null;
    const reliableStats = (enrichedReport.detailedContentStats || []) .filter(stat => !!(stat && stat._id && stat.count >= 2)); // Require count >= 2 for planning reliability
    if (reliableStats.length === 1) { const bestStat = reliableStats[0]!; commonCombinationDataForPlan = { proposal: bestStat._id.proposal || 'N/A', context: bestStat._id.context || 'N/A', stat: bestStat as DetailedContentStat }; } else if (reliableStats.length > 1) { const bestStat = reliableStats[0]!; const bestPCKey = `${bestStat._id.proposal || 'N/A'}|${bestStat._id.context || 'N/A'}`; const top3Keys = reliableStats.slice(0, 3).map(stat => `${stat._id.proposal || 'N/A'}|${stat._id.context || 'N/A'}`); if (top3Keys.filter(key => key === bestPCKey).length >= 2) { commonCombinationDataForPlan = { proposal: bestStat._id.proposal || 'N/A', context: bestStat._id.context || 'N/A', stat: bestStat as DetailedContentStat }; } }
    if (commonCombinationDataForPlan) { prompt = generateGroupedContentPlanInstructions( user.name || "usuário", commonCombinationDataForPlan, enrichedReport, promptHistoryForAI, tone, incomingText, targetMetricField as keyof DetailedContentStat | null, targetMetricFriendlyName ); logger.info(`${planFlowTag} Usando prompt AGRUPADO (Foco: ${targetMetricFriendlyName ?? 'Padrão'}).`); } else { prompt = generateContentPlanInstructions( user.name || "usuário", enrichedReport, promptHistoryForAI, tone, incomingText, targetMetricField as keyof DetailedContentStat | null, targetMetricFriendlyName ); logger.info(`${planFlowTag} Usando prompt PADRÃO (Foco: ${targetMetricFriendlyName ?? 'Padrão'}).`); }
    const aiCoreResponse = await callAIWithResilience(prompt);
    const planContextToSave = parsePlanItemsFromResponse(aiCoreResponse);
    let nextState: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now(), recentPlanIdeas: null, recentPlanTimestamp: undefined, lastOfferedScriptIdea: null }; // Clear previous script offer on new plan
    if (planContextToSave) { logger.info(`${planFlowTag} Contexto do plano com ${planContextToSave.length} itens extraído.`); nextState.recentPlanIdeas = planContextToSave; nextState.recentPlanTimestamp = Date.now(); } else { logger.warn(`${planFlowTag} Não foi possível extrair contexto do plano da resposta da IA (formato pode ser inesperado). O estado não será atualizado com 'recentPlanIdeas'.`); }
    const { finalResponse, greetingAdded } = await addGreetingAndGraph(aiCoreResponse, userIdStr, greeting, nextState);
    if (greetingAdded) { nextState.lastGreetingSent = Date.now(); }
    return { aiCoreResponse, nextDialogueState: nextState, finalResponseString: finalResponse };
}


/** Handler para a intenção ranking_request */
async function _handleRankingRequest(params: HandlerParams): Promise<HandlerResult> {
     const { user, incomingText, promptHistoryForAI, initialDialogueState, tone, userIdStr, greeting, enrichedReport } = params;
     const rankingFlowTag = "[_handleRankingRequest v1.1]";
     logger.debug(`${rankingFlowTag} Iniciando...`);
     if (!enrichedReport) { throw new Error("Relatório enriquecido não fornecido para _handleRankingRequest"); }
     const prompt = generateRankingInstructions(user.name || "usuário", enrichedReport, promptHistoryForAI, tone, incomingText);
     const aiCoreResponse = await callAIWithResilience(prompt);
     // Preserve script offer context, clear plan context
     let nextState: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now(), recentPlanIdeas: null, recentPlanTimestamp: undefined, lastOfferedScriptIdea: initialDialogueState.lastOfferedScriptIdea };
     const { finalResponse, greetingAdded } = await addGreetingAndGraph(aiCoreResponse, userIdStr, greeting, nextState);
     if (greetingAdded) { nextState.lastGreetingSent = Date.now(); }
     return { aiCoreResponse, nextDialogueState: nextState, finalResponseString: finalResponse };
}

/** Handler para intenções gerais (general, report, content_ideas, etc.) */
async function _handleGeneralRequest(params: HandlerParams, intent: string): Promise<HandlerResult> {
    const { user, incomingText, promptHistoryForAI, initialDialogueState, tone, userIdStr, greeting, enrichedReport } = params;
    const generalFlowTag = `[_handleGeneralRequest v1.7 - Intent: ${intent}]`;
    logger.debug(`${generalFlowTag} Iniciando...`);
    if (!enrichedReport) { throw new Error("Relatório enriquecido não fornecido para _handleGeneralRequest"); }
    const prompt = generateAIInstructions(user.name || "usuário", enrichedReport, promptHistoryForAI, tone, incomingText);
    const aiCoreResponse = await callAIWithResilience(prompt);
    const originalAICoreResponseForSaving = aiCoreResponse; // Save original response before adding extras
    let offeredScriptContextToSave: IDialogueState['lastOfferedScriptIdea'] = null;
    try {
        const proactiveContext = extractProactiveSuggestionContext(aiCoreResponse);
        if (proactiveContext) {
            logger.info(`${generalFlowTag} Contexto de oferta proativa (placeholder) extraído: "${proactiveContext.aiGeneratedIdeaDescription}"`);
            let originalSourceData: OriginalSourceContext = null;
            // Find the best performing detailed stat to use as potential source
            const sortedDetailedStats = [...(enrichedReport.detailedContentStats || [])]
                .filter(stat => stat && stat.count >= 1) // Ensure there's at least one post
                .sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
            const topStat = sortedDetailedStats[0];
            const bestPostCandidate = topStat?.bestPostInGroup;

            if (isValidBestPostWithDescription(bestPostCandidate)) {
                originalSourceData = {
                    description: bestPostCandidate.description,
                    proposal: topStat?._id?.proposal,
                    context: topStat?._id?.context,
                };
                logger.info(`${generalFlowTag} Fonte original ('bestPostInGroup' do Top Stat) encontrada para oferta proativa: "${originalSourceData.description.substring(0,50)}..."`);
            } else {
                const bestPostExists = !!bestPostCandidate;
                logger.warn(`${generalFlowTag} Não foi possível encontrar fonte original rica ('bestPostInGroup' ${bestPostExists ? 'sem descrição válida' : 'ausente no Top Stat'}) para oferta proativa.`);
            }
            offeredScriptContextToSave = {
                aiGeneratedIdeaDescription: proactiveContext.aiGeneratedIdeaDescription,
                originalSource: originalSourceData,
                timestamp: Date.now()
            };
            logger.debug(`${generalFlowTag} Contexto de oferta a ser salvo:`, offeredScriptContextToSave);
        } else {
            logger.debug(`${generalFlowTag} Nenhum placeholder de oferta proativa encontrado na resposta da IA.`);
        }
    } catch (parseError) {
        logger.error(`${generalFlowTag} Erro ao extrair/enriquecer contexto proativo:`, parseError);
    }
    // Clear plan context, set script offer context
    let nextState: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now(), recentPlanIdeas: null, recentPlanTimestamp: undefined, lastOfferedScriptIdea: offeredScriptContextToSave };

    // Add Top/Bottom posts info
    let postsInfo = "";
    const topFormatted = formatPostListWithLinks(enrichedReport.top3Posts, "📈 Posts gerais que se destacaram:");
    const bottomFormatted = formatPostListWithLinks(enrichedReport.bottom3Posts, "📉 Posts gerais com menor desempenho:");
    if (topFormatted || bottomFormatted) {
        postsInfo = `\n\n---\n**Posts gerais referência:**${topFormatted}${topFormatted && bottomFormatted ? '\n' : ''}${bottomFormatted}`;
    }
    const responseWithExtras = aiCoreResponse + postsInfo; // Append info to the AI's core response

    const { finalResponse, greetingAdded } = await addGreetingAndGraph(responseWithExtras, userIdStr, greeting, nextState);
    if (greetingAdded) {
        nextState.lastGreetingSent = Date.now();
    }
    // Return the original AI response for history saving, but the enhanced one for the user
    return { aiCoreResponse: originalAICoreResponseForSaving, nextDialogueState: nextState, finalResponseString: finalResponse };
}


// --- Lógica Principal de Processamento REATORADA ---
/**
 * Main orchestrator for processing user requests.
 * v3.35: Corrected intent type comparison.
 */
async function processMainAIRequest(
    user: IUser,
    incomingText: string,
    normalizedQuery: string,
    conversationHistory: string, // Full history for context updates
    initialDialogueState: IDialogueState,
    greeting: string,
    userIdStr: string,
    cacheKey: string
): Promise<string> {
    const versionTag = "[processMainAIRequest v3.35 - Intent Type Fix]"; // Updated version tag
    logger.debug(`${versionTag} Orquestrando para ${userIdStr}. Estado Inicial:`, initialDialogueState);

    // Determine Intent First
    const intentResult = await intentService.determineIntent(normalizedQuery, user, incomingText, initialDialogueState, greeting, userIdStr);
    if (intentResult.type === 'special_handled') {
        logger.info(`${versionTag} Resposta de caso especial (${intentResult.response.substring(0,30)}...). Atualizando estado.`);
        let specialStateUpdate: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now(), recentPlanIdeas: null, recentPlanTimestamp: undefined, lastOfferedScriptIdea: null };
        logger.debug("[Special Case] Contexto do plano e oferta de roteiro limpos.");
        await updateDialogueState(userIdStr, specialStateUpdate).catch(e => logger.error('Falha ao salvar estado dialogo (caso especial)', e));
        return intentResult.response;
    }
    // Assign the actual intent value (e.g., 'script_request', 'content_plan')
    const intent: DeterminedIntent = intentResult.intent;
    logger.info(`${versionTag} Intenção principal determinada: ${intent}`);

    const tone = adjustTone(user.profileTone || "informal e prestativo");
    const promptHistoryForAI = getPromptHistory(conversationHistory);
    let handlerResult: HandlerResult;
    let enrichedReportData: IEnrichedReport | undefined = undefined;

    // --- CORRECTED DATA FETCHING ---
    // Fetch report data for all non-special intents.
    // The earlier check `if (intentResult.type === 'special_handled')` already prevents this block
    // from running for special cases. The incorrect check `if (intent !== 'special_handled')` is removed.
    const dataPrepStartTime = Date.now();
    try {
        logger.debug(`${versionTag} Buscando dados do relatório para intent: ${intent}`);
        const { enrichedReport } = await dataService.fetchAndPrepareReportData({ user, dailyMetricModel: DailyMetric, contentMetricModel: Metric });
        enrichedReportData = enrichedReport;
        logger.debug(`${versionTag} Preparação de dados via DataService OK (${Date.now() - dataPrepStartTime}ms).`);
    } catch (dataError) {
        logger.error(`${versionTag} Falha na preparação de dados para intent ${intent}`, dataError);
        // Rethrow or handle appropriately - for now, rethrowing
        throw dataError;
    }
    // --- END CORRECTED DATA FETCHING ---


    const handlerParams: HandlerParams = {
        user,
        incomingText,
        normalizedQuery,
        promptHistoryForAI,
        conversationHistory,
        initialDialogueState,
        tone,
        userIdStr,
        greeting,
        enrichedReport: enrichedReportData // Pass fetched data
    };

    // Call the appropriate handler based on intent
    switch (intent) {
        case 'script_request':
            handlerResult = await _handleScriptRequest(handlerParams);
            break;
        case 'content_plan':
            handlerResult = await _handleContentPlanRequest(handlerParams);
            break;
        case 'ranking_request':
            handlerResult = await _handleRankingRequest(handlerParams);
            break;
        default: // Includes 'general', 'report', 'content_ideas', etc.
            handlerResult = await _handleGeneralRequest(handlerParams, intent);
            break;
    }

    logger.debug(`${versionTag} Estado final preparado para salvar:`, handlerResult.nextDialogueState);

    // Update dialogue state (already includes lastInteraction timestamp)
    await updateDialogueState(userIdStr, handlerResult.nextDialogueState)
        .catch(stateError => {
            logger.error(`${versionTag} Falha ao atualizar dialogue state principal para ${userIdStr}:`, stateError);
            // Continue execution even if state saving fails, but log the error
        });

    // Schedule async updates (cache, history, usage, graph)
    logger.debug(`${versionTag} Agendando updates async (cache, history, usage, graph) para user ${userIdStr}...`);
    Promise.allSettled([
        setInCache(cacheKey, handlerResult.finalResponseString, REDIS_CACHE_TTL_SECONDS),
        updateConversationContext(userIdStr, incomingText, handlerResult.aiCoreResponse, conversationHistory), // Use aiCoreResponse for history
        incrementUsageCounter(userIdStr),
        persistDialogueGraph() // Placeholder
    ]).then(results => {
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const taskName = ['cache', 'history', 'usage', 'graph'][index];
                logger.error(`${versionTag} Falha na tarefa async ${taskName}:`, result.reason);
            }
        });
    });

    return handlerResult.finalResponseString; // Return the final response for the user
}


// --- Tratamento Global de Erros ---
function handleError(error: unknown, fromPhone: string, userId: string | 'N/A', startTime: number): string {
    const versionTag = "[handleError v3.15]"; const duration = Date.now() - startTime; let userMessage = `Ops! Tive um probleminha aqui e não consegui processar sua solicitação (${error instanceof Error ? error.constructor.name : 'Unknown'}). 🤯 Poderia tentar novamente em um instante? Se o problema persistir, fale com o suporte.`; let errorType = "UnknownError"; let logPayload: any = { error }; if (error instanceof AIError) { errorType = 'AIError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof UserNotFoundError) { errorType = 'UserNotFoundError'; logPayload = { message: error.message, name: error.name }; } else if (error instanceof MetricsNotFoundError) { errorType = 'MetricsNotFoundError'; logPayload = { message: error.message, name: error.name }; } else if (error instanceof ReportAggregationError) { errorType = 'ReportAggregationError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof DetailedStatsError) { errorType = 'DetailedStatsError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof DatabaseError) { errorType = 'DatabaseError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof CacheError) { errorType = 'CacheError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof BaseError) { errorType = error.constructor.name; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof Error) { errorType = error.constructor.name; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else { errorType = 'UnknownNonError'; logPayload = { error }; } logger.error( `${versionTag} Erro processando para ${userId} (${fromPhone.slice(0,-4)}****). Tipo: ${errorType}. Duração: ${duration}ms.`, logPayload ); return userMessage;
}

// --- Função Principal Exportada ---
export async function getConsultantResponse(fromPhone: string, incomingText: string): Promise<string> {
    const versionTag = "[getConsultantResponse v3.15]"; // Keep main entry version stable unless major change
    const startTime = Date.now();
    logger.info(`${versionTag} INÍCIO: Chamada de ${fromPhone.slice(0, -4)}****. Msg: "${incomingText.substring(0, 50)}..."`);
    const normalizedQuery = normalizeTextInput(incomingText.trim());
    const normalizedQueryForCache = normalizedQuery.replace(/\s+/g, '_').substring(0, 100);
    const cacheKey = `response:${fromPhone}:${normalizedQueryForCache}`;
    let user: IUser | null = null;
    let userIdStr: string | 'N/A' = 'N/A';
    let initialDialogueState: IDialogueState = {};

    try {
        // 1. Check Cache
        const cachedResponse = await getFromCache(cacheKey);
        if (cachedResponse) {
            logger.info(`${versionTag} [Cache] HIT para ${cacheKey}. Tempo Total: ${Date.now() - startTime}ms`);
            return cachedResponse;
        }
        logger.debug(`${versionTag} [Cache] MISS para ${cacheKey}`);

        // 2. Lookup User
        user = await dataService.lookupUser(fromPhone); // Throws UserNotFoundError if not found
        userIdStr = user._id.toString();

        // 3. Load Context (State & History)
        let fullConversationHistory: string;
        ({ dialogueState: initialDialogueState, conversationHistory: fullConversationHistory } = await loadContext(userIdStr));

        // 4. Handle Empty/Invalid Input
        if (!normalizedQuery) {
            logger.warn(`${versionTag} Mensagem vazia ou inválida de ${fromPhone}.`);
            const greeting = getRandomGreeting(user.name || 'usuário');
            const emptyResponse = `${greeting} Como posso ajudar? 😊`;
            await updateDialogueState(userIdStr, { ...initialDialogueState, lastInteraction: Date.now() });
            return emptyResponse;
        }

        // 5. Process Request using Main Orchestrator
        const greeting = getRandomGreeting(user.name || 'usuário'); // Get greeting here for processMainAIRequest
        const aiResponse = await processMainAIRequest(
            user,
            incomingText,
            normalizedQuery,
            fullConversationHistory,
            initialDialogueState,
            greeting, // Pass greeting for potential use
            userIdStr,
            cacheKey
        );

        // 6. Log Success
        const totalDuration = Date.now() - startTime;
        logger.info(`${versionTag} FIM OK. User: ${userIdStr}. Tam Resposta: ${aiResponse.length}. Tempo Total: ${totalDuration}ms`);
        return aiResponse;

    } catch (error: unknown) {
        // 7. Handle Errors
        const errorResponse = handleError(error, fromPhone, userIdStr, startTime);
        return errorResponse;
    }
}

// --- Funções Exportadas Adicionais ---
export async function generateStrategicWeeklySummary(userName: string, aggregatedReport: AggregatedReport): Promise<string> {
    const fnTag = "[generateStrategicWeeklySummary]"; logger.warn(`${fnTag} Função não totalmente implementada.`); const overallStatsString = JSON.stringify(aggregatedReport.overallStats); const prompt = `Gere um resumo estratégico semanal curto e direto (2-3 pontos principais) para ${userName} baseado nestes dados agregados de desempenho: ${overallStatsString}. Foque nos maiores Ganhos ou Perdas.`; try { return await callAIWithResilience(prompt); } catch(error) { logger.error(`${fnTag} Falha para ${userName}`, error); if (error instanceof AIError) return "Desculpe, não consegui falar com a IA para gerar o resumo semanal agora."; return "Desculpe, ocorreu um erro inesperado ao gerar o resumo semanal."; }
}


// =========================================================================
// FIM: consultantService.ts - v3.35 (Correção Comparação Intent)
// =========================================================================
