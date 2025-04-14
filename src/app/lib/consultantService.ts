// @/app/lib/consultantService.ts - v3.31 (Com Otimização findPlanItemByUserInput v1.2)

// --- Imports Essenciais e Módulos ---
import { Model, Types } from "mongoose";
import { subDays, format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import opossum from "opossum";
import { logger } from '@/app/lib/logger';
import { createClient } from "redis";

// Importa os novos módulos de serviço
import * as intentService from './intentService';
import { getRandomGreeting, normalizeText as normalizeTextInput, isSimpleConfirmation } from './intentService';
import * as dataService from './dataService';
// Importa funções específicas com alias e tipos explícitos
import {
    generateAIInstructions as importedGenerateAIInstructions,
    generateContentPlanInstructions as importedGenerateContentPlanInstructions,
    generateGroupedContentPlanInstructions as importedGenerateGroupedContentPlanInstructions,
    generateRankingInstructions as importedGenerateRankingInstructions,
    generateScriptInstructions as importedGenerateScriptInstructions
} from './promptService';
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
import { DetailedContentStat, AggregatedReport, StatId } from './reportHelpers';

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

// --- Definições para Extração de Métrica Alvo ---
const METRIC_FOCUS_MAP: { [keyword: string]: string | null } = { /* ... */ 'comentarios': 'commentDiffPercentage', 'comentario': 'commentDiffPercentage', 'alcance': 'reachDiffPercentage', 'alcancadas': 'reachDiffPercentage', 'salvamentos': 'saveDiffPercentage', 'salvos': 'saveDiffPercentage', 'compartilhamentos': 'shareDiffPercentage', 'shares': 'shareDiffPercentage', 'curtidas': 'likeDiffPercentage', 'likes': 'likeDiffPercentage', 'visualizacoes': 'avgVisualizacoes', 'views': 'avgVisualizacoes', };
const METRIC_FRIENDLY_NAMES: { [field: string]: string } = { /* ... */ 'commentDiffPercentage': 'Comentários', 'reachDiffPercentage': 'Alcance', 'saveDiffPercentage': 'Salvamentos', 'shareDiffPercentage': 'Compartilhamentos', 'likeDiffPercentage': 'Curtidas', 'avgVisualizacoes': 'Visualizações', 'taxaRetencao': 'Retenção', 'taxaEngajamento': 'Engajamento (Geral)' };
function extractTargetMetricFocus(normalizedQuery: string): { targetMetricField: string | null, friendlyName: string | null } { /* ... código mantido ... */ const fnTag = "[extractTargetMetricFocus]"; const patterns = [ /focado em (?:ter |gerar )?mais (\w+)/, /priorizando (\w+)/, /com mais (\w+)/, /aumentar (\w+)/, /melhorar (\w+)/, /gerar (\w+)/ ]; for (const pattern of patterns) { const match = normalizedQuery.match(pattern); const keyword = match?.[1]; if (keyword && METRIC_FOCUS_MAP[keyword]) { const targetField = METRIC_FOCUS_MAP[keyword]; if (targetField) { const friendlyName = METRIC_FRIENDLY_NAMES[targetField] || targetField; logger.debug(`${fnTag} Métrica alvo identificada: ${keyword} -> ${targetField} (Nome amigável: ${friendlyName})`); return { targetMetricField: targetField, friendlyName: friendlyName }; } } } logger.debug(`${fnTag} Nenhuma métrica alvo específica identificada na query. Usando padrão.`); const defaultSortField = 'shareDiffPercentage'; const defaultFriendlyName = METRIC_FRIENDLY_NAMES[defaultSortField] || defaultSortField; return { targetMetricField: defaultSortField, friendlyName: defaultFriendlyName }; }

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
// ... (código mantido) ...
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
let redisInitialized = false; let isConnecting = false;
redisClient.on('error', (err: Error) => { logger.error('[Redis] Erro:', err); redisInitialized = false; });
redisClient.on('connect', () => { logger.info('[Redis] Conectando...'); });
redisClient.on('ready', () => { logger.info('[Redis] Conectado.'); redisInitialized = true; isConnecting = false; });
redisClient.on('end', () => { logger.warn('[Redis] Conexão encerrada.'); redisInitialized = false; });
const initializeRedis = async (): Promise<void> => { if (!redisInitialized && !isConnecting) { isConnecting = true; logger.info('[Redis] Tentando conectar...'); try { await redisClient.connect(); } catch (err) { logger.error('[Redis] Falha inicial:', err); isConnecting = false; } } };
initializeRedis();
const getFromCache = async (key: string): Promise<string | null> => { logger.debug(`[getFromCache] Buscando ${key}`); try { if (!redisInitialized) {await initializeRedis();} return await redisClient.get(key); } catch (err) { logger.error(`[getFromCache] Falha ao buscar ${key}:`, err); return null; } };
const setInCache = async (key: string, value: string, ttlSeconds: number): Promise<string | null> => { logger.debug(`[setInCache] Salvando ${key}`); try { if (!redisInitialized) {await initializeRedis();} return await redisClient.set(key, value, { EX: ttlSeconds }); } catch (err) { logger.error(`[setInCache] Falha ao salvar ${key}:`, err); return null; } };

// --- Lógica de Diálogo/Histórico (Redis) ---
// ... (código mantido) ...
const getDialogueState = async (userId: string): Promise<IDialogueState> => { /* ... implementação v1.1 ... */ const key = `dialogue:${userId}`; const fnTag = "[getDialogueState v1.1]"; logger.debug(`${fnTag} Buscando estado para ${userId} (key: ${key})`); try { if (!redisInitialized) await initializeRedis(); const stateString = await redisClient.get(key); logger.debug(`${fnTag} Estado bruto lido do Redis para ${userId}: ${stateString ? stateString.substring(0, 200) + '...' : 'null'}`); if (stateString) { const state = JSON.parse(stateString) as IDialogueState; logger.debug(`${fnTag} Estado parseado para ${userId}:`, state); if(state.recentPlanIdeas && !Array.isArray(state.recentPlanIdeas)) { state.recentPlanIdeas = null; state.recentPlanTimestamp = undefined; } if(state.lastOfferedScriptIdea && typeof state.lastOfferedScriptIdea !== 'object') { state.lastOfferedScriptIdea = null; } if(state.lastOfferedScriptIdea && typeof state.lastOfferedScriptIdea.aiGeneratedIdeaDescription !== 'string') { logger.warn(`${fnTag} Campo lastOfferedScriptIdea.aiGeneratedIdeaDescription inválido, resetando oferta.`); state.lastOfferedScriptIdea = null; } return state; } return {}; } catch (error) { logger.error(`${fnTag} Falha ao buscar ou parsear estado para ${userId}:`, error); return {}; } };
const updateDialogueState = async (userId: string, newState: IDialogueState): Promise<string | null> => { /* ... implementação v1.1 ... */ const key = `dialogue:${userId}`; const fnTag = "[updateDialogueState v1.1]"; try { if (!redisInitialized) await initializeRedis(); const stateToSave = Object.entries(newState).reduce((acc, [k, v]) => { if (v !== undefined) { acc[k as keyof IDialogueState] = v; } return acc; }, {} as Partial<IDialogueState>); if (stateToSave.lastOfferedScriptIdea?.timestamp) { const offerAgeMinutes = (Date.now() - stateToSave.lastOfferedScriptIdea.timestamp) / (1000 * 60); if (offerAgeMinutes > MAX_OFFERED_SCRIPT_CONTEXT_AGE_MINUTES) { logger.debug(`${fnTag} Oferta de roteiro antiga (${offerAgeMinutes.toFixed(1)} min) sendo limpa.`); stateToSave.lastOfferedScriptIdea = null; } } if (stateToSave.recentPlanTimestamp) { const planAgeMinutes = (Date.now() - stateToSave.recentPlanTimestamp) / (1000 * 60); if (planAgeMinutes > MAX_PLAN_CONTEXT_AGE_MINUTES) { logger.debug(`${fnTag} Contexto de plano antigo (${planAgeMinutes.toFixed(1)} min) sendo limpo.`); stateToSave.recentPlanIdeas = null; stateToSave.recentPlanTimestamp = undefined; } } const stateString = JSON.stringify(stateToSave); logger.debug(`${fnTag} Estado a ser salvo para ${userId}: ${stateString.substring(0, 200)}...`); await redisClient.set(key, stateString, { EX: REDIS_STATE_TTL_SECONDS }); logger.info(`${fnTag} Estado atualizado para user ${userId}`, { keysUpdated: Object.keys(stateToSave) }); return 'OK'; } catch (err) { logger.error(`${fnTag} Falha ao salvar estado para ${userId}:`, err); return null; } };
const getConversationHistory = async (userId: string): Promise<string> => { /* ... implementação ... */ const key = `history:${userId}`; logger.debug(`[getConversationHistory] Buscando histórico para ${userId}`); try { if (!redisInitialized) await initializeRedis(); return await redisClient.get(key) ?? ""; } catch (error) { logger.error(`[getConversationHistory] Falha ao buscar histórico para ${userId}:`, error); return ""; } };
const updateConversationContext = async (userId: string, incomingText: string, aiCoreResponse: string, currentHistory?: string): Promise<void> => { /* ... implementação v1.1 ... */ const key = `history:${userId}`; const fnTag = '[updateConversationContext v1.1]'; logger.info(`${fnTag} Atualizando histórico para ${userId}`); try { if (!redisInitialized) await initializeRedis(); const historyToUpdate = currentHistory ?? await getConversationHistory(userId); const newEntry = `User: ${incomingText}\nAI: ${aiCoreResponse}`; const updatedHistory = (historyToUpdate ? historyToUpdate + '\n' : '') + newEntry; const historyLines = updatedHistory.split('\n'); const limitedHistory = historyLines.slice(-HISTORY_RAW_LINES_LIMIT * 4).join('\n'); await redisClient.set(key, limitedHistory, { EX: REDIS_HISTORY_TTL_SECONDS }); logger.debug(`${fnTag} Histórico atualizado para ${userId}. Novo tamanho: ${limitedHistory.length} chars.`); } catch (error) { logger.error(`${fnTag} Falha ao atualizar histórico para ${userId}:`, error); } };
const incrementUsageCounter = async (userId: string): Promise<number> => { const key = `usage:${userId}`; logger.debug(`[incrementUsageCounter] Incrementando para ${userId}`); try { if (!redisInitialized) await initializeRedis(); const newValue = await redisClient.incr(key); await redisClient.expire(key, REDIS_STATE_TTL_SECONDS); logger.debug(`[incrementUsageCounter] Novo valor para ${userId}: ${newValue}`); return newValue; } catch (error) { logger.error(`[incrementUsageCounter] Falha ao incrementar uso para ${userId}:`, error); return 0; } };

// --- Sumarização de Histórico ---
// ... (código mantido) ...
function getPromptHistory(fullHistory: string): string { /* ... */ const lines = fullHistory.split('\n'); const linesToTake = Math.min(lines.length, HISTORY_RAW_LINES_LIMIT * 2); return lines.slice(-linesToTake).join('\n'); }
function getLastAIResponse(fullHistory: string): string | null { /* ... */ if (!fullHistory) return null; const lines = fullHistory.trim().split('\n'); for (let i = lines.length - 1; i >= 0; i--) { const line = lines[i]; if (line !== undefined && line !== null && line.trim().startsWith('AI:')) { return line.substring(3).trim(); } } return null; }


// --- Lógica de IA (Opossum, Retry) ---
// ... (código mantido) ...
const openAICallAction = async (prompt: string): Promise<string> => { /* ... */ logger.debug("[openAICallAction] Executando callOpenAIForQuestion..."); return await callOpenAIForQuestion(prompt); };
const breakerOptions: opossum.Options = { timeout: 60000, errorThresholdPercentage: 50, resetTimeout: 30000 }; const openAIBreaker = new opossum(openAICallAction, breakerOptions); openAIBreaker.on('open', () => logger.warn(`[Opossum] Circuito ABERTO para AI Service.`)); openAIBreaker.on('close', () => logger.info(`[Opossum] Circuito FECHADO para AI Service.`)); openAIBreaker.on('halfOpen', () => logger.info(`[Opossum] Circuito MEIO-ABERTO para AI Service.`)); openAIBreaker.on('success', (result) => logger.debug(`[Opossum] Chamada AI Service SUCCESS.`)); openAIBreaker.on('failure', (error) => logger.warn(`[Opossum] Chamada AI Service FAILURE. Erro: ${error?.constructor?.name || typeof error} - ${error instanceof Error ? error.message : String(error)}`));
async function callAIWithResilience(prompt: string): Promise<string> { /* ... */ const fnTag = "[callAIWithResilience]"; logger.debug(`${fnTag} Tentando executar via Opossum...`); try { const result = await openAIBreaker.fire(prompt); if (typeof result === 'string' && result.trim() !== '') { logger.debug(`${fnTag} Opossum executou com SUCESSO e resultado é NÃO VAZIO.`); return result; } logger.error(`${fnTag} Opossum retornou SUCESSO mas resultado é INESPERADO ou VAZIO. Tipo: ${typeof result}`, { result }); throw new AIError("Resultado inesperado ou vazio recebido da camada de resiliência da IA.", undefined); } catch (error: unknown) { logger.warn(`${fnTag} Falha ao executar via Opossum. Processando erro...`); if (error instanceof AIError) { throw error; } if (error instanceof Error && error.name === 'BreakerOpenError') { throw new AIError("Serviço da IA temporariamente indisponível (Circuito Aberto). Tente novamente mais tarde.", error); } let errorMessage = "Erro desconhecido na camada de resiliência da IA."; let originalError: Error | undefined; if (error instanceof Error) { originalError = error; errorMessage = `Falha na camada de resiliência da IA: ${error.message}`; logger.error(`${fnTag} Erro capturado:`, { name: error.name, message: error.message }); } else { errorMessage = `Falha inesperada (não-Error) na camada de resiliência da IA: ${String(error)}`; logger.error(`${fnTag} Falha inesperada (não-Error) capturada:`, { error }); originalError = undefined; } throw new AIError(errorMessage, originalError); } }

// --- Funções Auxiliares para Contexto ---
// ... (parsePlanItemsFromResponse mantida como na versão anterior corrigida) ...
function parsePlanItemsFromResponse(responseText: string): IPlanItemContext[] | null { /* ... código da versão anterior ... */ const fnTag = "[parsePlanItemsFromResponse v3.X - Correção Aplicada (Exemplo + Tipo v2)]"; logger.debug(`${fnTag} Tentando extrair itens do plano...`); const items: IPlanItemContext[] = []; if (!responseText) { logger.warn(`${fnTag} Texto de resposta vazio.`); return null; } try { const groupedHeaderRegex = /🎯 \*\*Análise da Estratégia Principal: Foco em\s*["']([^"']+)["']\s*sobre\s*["']([^"']+)["']\*\*?/i; const groupedHeaderMatch = responseText.match(groupedHeaderRegex); if (groupedHeaderMatch && groupedHeaderMatch[1] && groupedHeaderMatch[2]) { const commonProposal = groupedHeaderMatch[1].trim(); const commonContext = groupedHeaderMatch[2].trim(); logger.info(`${fnTag} Detectado formato de plano AGRUPADO. Proposta: ${commonProposal}, Contexto: ${commonContext}`); const ideasSectionRegex = /(?:💡 \*\*Ideias de Conteúdo Sugeridas.*?\*\*|Sugestões para a Semana:)\s*\n([\s\S]+?)(?:---|\n#|$)/i; const ideasSectionMatch = responseText.match(ideasSectionRegex); if (ideasSectionMatch && ideasSectionMatch[1]) { const ideasBlock = ideasSectionMatch[1]; const ideaItemRegex = /^\s*[\*\-]\s*\**\[?([^:\]]+)\]?:\**\s*["“]?(.*?)["”]?\s*$/gm; let ideaMatch; while ((ideaMatch = ideaItemRegex.exec(ideasBlock)) !== null) { const identifier = ideaMatch[1]?.trim(); let description = ideaMatch[2]?.trim(); if (identifier && description) { logger.debug(`${fnTag} Item Agrupado Extraído: ID='${identifier}', Desc='${description.substring(0, 30)}...'`); items.push({ identifier, description, proposal: commonProposal, context: commonContext }); } else { logger.warn(`${fnTag} Falha ao extrair grupos do match da regex para item agrupado: Match[0]='${ideaMatch[0]}', Match[1]='${ideaMatch[1]}', Match[2]='${ideaMatch[2]}'`); } } if (items.length === 0) { logger.warn(`${fnTag} Bloco de ideias agrupadas encontrado, mas a regex não extraiu nenhum item. Verifique a regex e o formato da resposta da IA no bloco: \n---\n${ideasBlock}\n---`); } } else { logger.warn(`${fnTag} Formato agrupado detectado, mas seção/bloco de ideias não encontrada ou formato inesperado após o header.`); if (groupedHeaderMatch) { const startIndex = groupedHeaderMatch.index! + groupedHeaderMatch[0]!.length; const endIndex = startIndex + 500; logger.debug(`${fnTag} Conteúdo após header agrupado para análise: ${responseText.substring(startIndex, endIndex)}...`); } } } else { logger.debug(`${fnTag} Formato agrupado não detectado, tentando formato padrão (dia a dia).`); const headerRegex = /\*\*\s*\[?([^\]:]+?)\]?:\s*Foco em\s*\[?([^\]]+?)\]?\s*sobre\s*\[?([^\]]+?)\]?\s*\*\*/g; const ideaRegex = /(?:Ideia de Conteúdo:|Que tal:)(?:.*?)(?:\*\*"([^"]+)"|\*\*([^*]+)\*\*|"?([^"\n]+)"?)/si; let headerMatch; while ((headerMatch = headerRegex.exec(responseText)) !== null) { const identifier = headerMatch[1]?.trim(); const proposal = headerMatch[2]?.trim(); const context = headerMatch[3]?.trim(); const currentHeaderEnd = headerMatch.index + headerMatch[0].length; let searchAreaEnd = responseText.length; const nextHeaderFinderRegex = new RegExp(headerRegex.source, 'g'); nextHeaderFinderRegex.lastIndex = currentHeaderEnd; const nextMatch = nextHeaderFinderRegex.exec(responseText); if (nextMatch) { searchAreaEnd = nextMatch.index; } const searchArea = responseText.substring(currentHeaderEnd, searchAreaEnd); const ideaMatch = searchArea.match(ideaRegex); const description = (ideaMatch?.[1] || ideaMatch?.[2] || ideaMatch?.[3])?.trim(); if (identifier && description) { logger.debug(`${fnTag} Item Padrão: ID='${identifier}', Desc='${description.substring(0, 30)}...'`); items.push({ identifier, description, proposal, context }); } else { logger.warn(`${fnTag} Falha ao extrair item completo para header padrão: ${headerMatch[0]} (Descrição não encontrada na área [${currentHeaderEnd}..${searchAreaEnd}])`); logger.debug(`${fnTag} Conteúdo da área de busca para header padrão: '${searchArea.substring(0,100)}...'`); } } } logger.info(`${fnTag} Extraídos ${items.length} itens do plano no total.`); return items.length > 0 ? items : null; } catch (error) { logger.error(`${fnTag} Erro durante parsing do plano:`, error); return null; } }

// =========================================================================
// <<< INÍCIO DA FUNÇÃO MODIFICADA (findPlanItemByUserInput) >>>
// =========================================================================
const CONTEXT_NOISE_WORDS = new Set(normalizeTextInput(`o a os as um uma uns umas de do da dos das em no na nos nas por para com quero queria gostaria faz fazer faca pode ser me da manda cria crie o a roteiro script estrutura sobre pra pro p`).split(/\s+/).filter(w => w.length > 1));

/**
 * Encontra um item de plano correspondente ao input do usuário.
 * v1.1 -> v1.2 (Lógica de match aprimorada e ordenada)
 */
function findPlanItemByUserInput( userInput: string, planItems: IPlanItemContext[] ): IPlanItemContext | null {
    const fnTag = "[findPlanItemByUserInput v1.2]"; // Nova versão tag
    const normalizedInput = normalizeTextInput(userInput);

    if (!normalizedInput || !planItems || planItems.length === 0) {
        logger.debug(`${fnTag} Input ou itens do plano inválidos/vazios.`);
        return null;
    }

    // 1. Limpa o input do usuário
    const inputWords = normalizedInput.split(' ');
    // Remove palavras de ruído E pontuação comum das palavras restantes
    const cleanedInputWords = inputWords
        .map(word => word.replace(/[?.,!]/g, '')) // Remove pontuação
        .filter(word => !CONTEXT_NOISE_WORDS.has(word) && word.length > 0); // Remove noise words e vazios

    const cleanedInput = cleanedInputWords.join(' ').trim();

    logger.debug(`${fnTag} Buscando por input limpo "${cleanedInput}" (palavras: [${cleanedInputWords.join(', ')}]) em ${planItems.length} itens.`);
    if (!cleanedInput) {
        logger.debug(`${fnTag} Input vazio após limpeza.`);
        return null;
    }

    // Itera pelos itens do plano tentando diferentes estratégias de match
    for (let i = 0; i < planItems.length; i++) {
        const item = planItems[i];
        if (!item || !item.identifier) continue;

        // Normaliza o identificador do item (remove acentos, lowercase, remove colchetes)
        const normalizedIdentifier = normalizeTextInput(item.identifier.replace(/[\[\]]/g, ''));
        if (!normalizedIdentifier) continue; // Pula se identificador normalizado for vazio

        // --- Estratégia 1: Match Exato ---
        if (normalizedIdentifier === cleanedInput) {
            logger.info(`${fnTag} Match Exato: ID='${item.identifier}', Input Limpo='${cleanedInput}'`);
            return item;
        }

        // --- Estratégia 2: Match por Índice ou Ordinal ---
        const itemIndexStr = (i + 1).toString();
        for (const word of cleanedInputWords) { // Usa as palavras limpas
            const inputIsIndex = word === itemIndexStr;
            // Regex para ordinais (1, 1º, 1a, 2, 2º, 2a..., primeiro, segunda...)
            const ordinalMatch = word.match(/^(?:([1-7])(?:[ºªo]?)|(primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|quint[ao]|sext[ao]|setim[ao]))$/); // Regex aprimorada
            let inputIsOrdinal = false;
            if (ordinalMatch) {
                const numPart = ordinalMatch[1] ? parseInt(ordinalMatch[1], 10) : null; // Grupo numérico
                const textPart = ordinalMatch[2]; // Grupo textual

                if (numPart !== null && !isNaN(numPart)) {
                    inputIsOrdinal = (numPart === i + 1);
                } else if (textPart) { // Compara a parte textual
                    inputIsOrdinal =
                        (textPart.startsWith("primeir") && i === 0) ||
                        (textPart.startsWith("segund") && i === 1) ||
                        (textPart.startsWith("terceir") && i === 2) ||
                        (textPart.startsWith("quart") && i === 3) ||
                        (textPart.startsWith("quint") && i === 4) ||
                        (textPart.startsWith("sext") && i === 5) ||
                        (textPart.startsWith("setim") && i === 6); // Expandido até 7
                }
            }

            if (inputIsIndex || inputIsOrdinal) {
                logger.info(`${fnTag} Match por Índice/Ordinal ('${word}'): ID='${item.identifier}'`);
                return item;
            }
        }

        // --- Estratégia 3: Match por Prefixo do Identificador ---
        // Pega o prefixo do identificador JÁ NORMALIZADO
        const identifierPrefix = normalizedIdentifier.split(/[\s:-]/)[0]?.replace('.', '') ?? '';

        // Compara o input limpo COMPLETO com o prefixo normalizado
        if (identifierPrefix && cleanedInput === identifierPrefix) {
             logger.info(`${fnTag} Match por Prefixo Exato ('${cleanedInput}'): ID='${item.identifier}' (Prefixo Normalizado: '${identifierPrefix}')`);
             return item;
        }
        // Compara CADA palavra do input limpo com o prefixo (ex: input "a segunda", prefixo "segunda")
        for (const word of cleanedInputWords) {
             if (identifierPrefix && word === identifierPrefix) {
                 logger.info(`${fnTag} Match por Palavra=Prefixo ('${word}'): ID='${item.identifier}' (Prefixo Normalizado: '${identifierPrefix}')`);
                 return item;
             }
        }

        // --- Estratégia 4: Match por Inclusão de Palavras (Mais Restrito) ---
        // Só tenta se o input tiver pelo menos 1 palavra significativa
        if (cleanedInputWords.length >= 1) {
            const identifierWords = new Set(normalizedIdentifier.split(' ')); // Usa Set para busca rápida
            // Verifica se TODAS as palavras do input limpo estão contidas no identificador normalizado
            const allInputWordsIncluded = cleanedInputWords.every(inputWord =>
                identifierWords.has(inputWord) || normalizedIdentifier.includes(inputWord) // Verifica palavra exata ou substring
            );

            if (allInputWordsIncluded) {
                // Verificação adicional: Evitar match se o input for apenas uma letra contida e não for a palavra exata
                const isSingleCharMisMatch = cleanedInput.length === 1 && cleanedInputWords.length === 1 && !identifierWords.has(cleanedInput);
                if (!isSingleCharMisMatch) {
                    logger.info(`${fnTag} Match por Inclusão de Palavras: ID='${item.identifier}', Input Limpo='${cleanedInput}'`);
                    return item;
                } else {
                    logger.debug(`${fnTag} Match por Inclusão evitado para input de letra única não exata: '${cleanedInput}' em '${normalizedIdentifier}'`);
                }
            }
        }
    } // Fim do loop pelos itens

    logger.warn(`${fnTag} Nenhuma correspondência encontrada para input limpo "${cleanedInput}".`);
    return null; // Retorna null se nenhuma estratégia encontrar correspondência
}
// =========================================================================
// <<< FIM DA FUNÇÃO MODIFICADA (findPlanItemByUserInput) >>>
// =========================================================================

// ... (extractProactiveSuggestionContext mantida como na versão anterior corrigida) ...
function extractProactiveSuggestionContext(aiResponse: string): { aiGeneratedIdeaDescription: string } | null { /* ... código mantido ... */ const fnTag = "[extractProactiveSuggestionContext v3.0]"; if (!aiResponse) return null; try { const placeholderRegex = /\*\*Próximo Passo Roteiro:\*\*.*?\(["\*]([^")]+)["\*]\)/i; const match = aiResponse.match(placeholderRegex); if (match && match[1]) { const description = match[1].trim(); logger.info(`${fnTag} Contexto de sugestão proativa extraído do placeholder: AI Gen Desc='${description}'`); return { aiGeneratedIdeaDescription: description }; } logger.debug(`${fnTag} Placeholder de oferta proativa de roteiro não encontrado na resposta da IA.`); return null; } catch (error) { logger.error(`${fnTag} Erro durante parsing do placeholder de sugestão proativa:`, error); return null; } }

// --- Funções Auxiliares de Orquestração ---
// ... (código mantido) ...
async function loadContext(userIdStr: string): Promise<{ dialogueState: IDialogueState, conversationHistory: string }> { /* ... */ logger.debug(`[loadContext] Carregando contexto para ${userIdStr}`); const [dialogueState, conversationHistory] = await Promise.all([ getDialogueState(userIdStr), getConversationHistory(userIdStr) ]); logger.debug(`[loadContext] Contexto carregado para ${userIdStr}. Estado Keys: ${Object.keys(dialogueState).join(', ')}. Tam Histórico: ${conversationHistory.length}. Oferta Roteiro:`, dialogueState.lastOfferedScriptIdea); return { dialogueState, conversationHistory }; }
const adjustTone = (tone: string): string => tone;
const persistDialogueGraph = async (): Promise<void> => { logger.debug("[persistDialogueGraph] Placeholder chamado."); };
const getGraphSummary = async (): Promise<string> => { logger.debug("[getGraphSummary] Placeholder chamado."); return ""; };
async function addGreetingAndGraph( baseResponse: string, userIdStr: string, greeting: string, dialogueState: IDialogueState ): Promise<{ finalResponse: string; greetingAdded: boolean }> { /* ... */ logger.debug(`[addGreetingAndGraph] Recebeu baseResponse: "${baseResponse?.substring(0, 100)}..."`); let finalResponse = baseResponse; let greetingAdded = false; const now = Date.now(); if (greeting) { const lastGreetingTime = dialogueState.lastGreetingSent; const needsGreeting = !lastGreetingTime || (now - lastGreetingTime > GREETING_RECENCY_THRESHOLD_MINUTES * 60 * 1000); if (needsGreeting) { logger.debug(`[addGreetingAndGraph] Adicionando saudação para user ${userIdStr}`); finalResponse = `${greeting}\n\n${baseResponse}`; greetingAdded = true; } } return { finalResponse, greetingAdded }; }
function formatPostListWithLinks(posts: IMetricMinimal[] | undefined, title: string): string { /* ... */ if (!posts || posts.length === 0) return ""; let formatted = `\n${title}\n`; posts.forEach(post => { const description = post.description?.substring(0, 50) || 'Post sem descrição'; const link = post.postLink ? `([ver](${post.postLink}))` : ''; formatted += `- ${description}... ${link}\n`; }); return formatted; }

// --- Funções Handler Refatoradas ---

interface HandlerParams { /* ... */ user: IUser; incomingText: string; normalizedQuery: string; promptHistoryForAI: string; conversationHistory: string; initialDialogueState: IDialogueState; tone: string; userIdStr: string; greeting: string; enrichedReport?: IEnrichedReport; }
interface HandlerResult { /* ... */ aiCoreResponse: string; nextDialogueState: IDialogueState; finalResponseString: string; }

// =========================================================================
// <<< INÍCIO: Definições de Tipo e Type Guard para _handleGeneralRequest >>>
// =========================================================================
type BestPostType = { _id: Types.ObjectId; description?: string | null; postLink?: string; shares?: number; saves?: number; };
function isValidBestPostWithDescription(post: any): post is BestPostType & { description: string } { return !!post && typeof post.description === 'string' && post.description.trim().length > 0; }
// =========================================================================
// <<< FIM: Definições de Tipo e Type Guard >>>
// =========================================================================


/** Handler para a intenção script_request */
async function _handleScriptRequest(params: HandlerParams): Promise<HandlerResult> {
    // (Usa findPlanItemByUserInput v1.2)
    const { user, incomingText, normalizedQuery, promptHistoryForAI, conversationHistory, initialDialogueState, tone, userIdStr, greeting } = params;
    const scriptFlowTag = "[_handleScriptRequest v1.4 Mod]";
    logger.debug(`${scriptFlowTag} Iniciando...`);
    let sourceDescription: string | undefined;
    let sourceProposal: string | undefined;
    let sourceContext: string | undefined;
    let scriptSourceFound = false;
    let finalClarificationMessage: string | null = null;
    let nextState: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now() };

    logger.debug(`${scriptFlowTag} Estado inicial recebido:`, initialDialogueState);
    logger.debug(`${scriptFlowTag} Tentando extrair referência explícita...`);
    const referenceResult = await dataService.extractReferenceAndFindPost(incomingText, user._id);

    if (referenceResult.status === 'found' && referenceResult.post) {
        logger.info(`${scriptFlowTag} Referência explícita encontrada: Post ID ${referenceResult.post._id}`); if (!referenceResult.post.description) { logger.warn(`${scriptFlowTag} Post ${referenceResult.post._id} encontrado, mas sem descrição.`); finalClarificationMessage = 'Encontrei o post que você mencionou, mas ele parece não ter uma descrição para eu poder analisar e criar o roteiro. 🤔'; } else { sourceDescription = referenceResult.post.description; sourceProposal = referenceResult.post.proposal; sourceContext = referenceResult.post.context; scriptSourceFound = true; }
    } else if (referenceResult.status === 'error') {
        logger.error(`${scriptFlowTag} Erro de dataService ao buscar referência: ${referenceResult.message}`); nextState = { ...nextState, recentPlanIdeas: initialDialogueState.recentPlanIdeas, recentPlanTimestamp: initialDialogueState.recentPlanTimestamp, lastOfferedScriptIdea: initialDialogueState.lastOfferedScriptIdea }; await updateDialogueState(userIdStr, nextState); throw new DatabaseError(referenceResult.message || "Desculpe, tive um problema ao buscar a referência do seu post.");
    } else {
        logger.debug(`${scriptFlowTag} Status não 'found' (com post) nem 'error'. Status: ${referenceResult.status}`);
        if (referenceResult.status === 'clarify') { finalClarificationMessage = referenceResult.message; } else { logger.warn(`${scriptFlowTag} Status não esperado no else: ${referenceResult.status}`); }
        logger.debug(`${scriptFlowTag} Referência explícita não encontrada ou ambígua. Status: ${referenceResult.status}`);
    }

    if (!scriptSourceFound) {
        logger.debug(`${scriptFlowTag} Verificando contexto de plano recente no estado...`);
        const recentIdeas = initialDialogueState.recentPlanIdeas;
        const planTimestamp = initialDialogueState.recentPlanTimestamp;
        logger.debug(`${scriptFlowTag} Contexto do plano no estado:`, { hasIdeas: !!recentIdeas, count: recentIdeas?.length, timestamp: planTimestamp });

        if (recentIdeas && recentIdeas.length > 0 && planTimestamp) {
            const planAgeMinutes = (Date.now() - planTimestamp) / (1000 * 60);
            if (planAgeMinutes < MAX_PLAN_CONTEXT_AGE_MINUTES) {
                // <<< USA A FUNÇÃO OTIMIZADA >>>
                const matchedItem = findPlanItemByUserInput(incomingText, recentIdeas);
                if (matchedItem) {
                    logger.info(`${scriptFlowTag} Item correspondente encontrado no contexto do plano: Identifier='${matchedItem.identifier}'`);
                    sourceDescription = matchedItem.description;
                    sourceProposal = matchedItem.proposal;
                    sourceContext = matchedItem.context;
                    scriptSourceFound = true;
                    nextState.recentPlanIdeas = null;
                    nextState.recentPlanTimestamp = undefined;
                }
            } else {
                logger.debug(`${scriptFlowTag} Contexto do plano antigo (>${MAX_PLAN_CONTEXT_AGE_MINUTES} min).`);
                nextState.recentPlanIdeas = null;
                nextState.recentPlanTimestamp = undefined;
            }
        } else {
            logger.debug(`${scriptFlowTag} Nenhum contexto de plano recente no estado.`);
        }
    }

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
                    if (offeredContext.originalSource?.description) { sourceDescription = offeredContext.originalSource.description; sourceProposal = offeredContext.originalSource.proposal; sourceContext = offeredContext.originalSource.context; logger.debug(`${scriptFlowTag} Usando fonte original: "${sourceDescription.substring(0,50)}..."`); } else { sourceDescription = offeredContext.aiGeneratedIdeaDescription; sourceProposal = undefined; sourceContext = undefined; logger.debug(`${scriptFlowTag} Usando descrição gerada pela IA: "${sourceDescription.substring(0,50)}..."`); }
                    scriptSourceFound = true;
                    nextState.lastOfferedScriptIdea = null;
                 } else {
                     logger.debug(`${scriptFlowTag} Contexto de oferta recente, mas input não é confirmação simples.`);
                     nextState.lastOfferedScriptIdea = initialDialogueState.lastOfferedScriptIdea;
                 }
            } else {
                logger.debug(`${scriptFlowTag} Contexto de oferta proativa encontrado, mas muito antigo.`);
                 nextState.lastOfferedScriptIdea = null;
            }
        } else {
            logger.debug(`${scriptFlowTag} Nenhuma oferta proativa válida encontrada no estado.`);
            nextState.lastOfferedScriptIdea = null;
        }
    }

    logger.debug(`${scriptFlowTag} Resultado da busca pela fonte: scriptSourceFound=${scriptSourceFound}, sourceDescription=${!!sourceDescription}`);
    if (scriptSourceFound && sourceDescription) {
        logger.info(`${scriptFlowTag} Fonte encontrada. Gerando prompt de roteiro...`);
        const prompt = generateScriptInstructions( user.name || "usuário", sourceDescription, sourceProposal, sourceContext, promptHistoryForAI, tone, incomingText );
        const aiCoreResponse = await callAIWithResilience(prompt);
        const { finalResponse, greetingAdded } = await addGreetingAndGraph(aiCoreResponse, userIdStr, greeting, nextState);
        if (greetingAdded) { nextState.lastGreetingSent = Date.now(); }
        logger.debug(`${scriptFlowTag} Roteiro gerado pela IA OK.`);
        return { aiCoreResponse, nextDialogueState: nextState, finalResponseString: finalResponse };
    } else {
        logger.info(`${scriptFlowTag} Fonte não encontrada. Retornando clarificação.`);
        const response = finalClarificationMessage ?? "Não consegui identificar exatamente sobre qual ideia você quer o roteiro. Pode me dar uma referência mais clara?";
        nextState.recentPlanIdeas = nextState.recentPlanIdeas === undefined ? initialDialogueState.recentPlanIdeas : nextState.recentPlanIdeas;
        nextState.recentPlanTimestamp = nextState.recentPlanTimestamp === undefined ? initialDialogueState.recentPlanTimestamp : nextState.recentPlanTimestamp;
        nextState.lastOfferedScriptIdea = nextState.lastOfferedScriptIdea === undefined ? initialDialogueState.lastOfferedScriptIdea : nextState.lastOfferedScriptIdea;
        const { finalResponse: finalClarificationWithGreeting, greetingAdded } = await addGreetingAndGraph(response, userIdStr, greeting, nextState);
        if (greetingAdded) { nextState.lastGreetingSent = Date.now(); }
        return { aiCoreResponse: response, nextDialogueState: nextState, finalResponseString: finalClarificationWithGreeting };
    }
}


/** Handler para a intenção content_plan */
async function _handleContentPlanRequest(params: HandlerParams): Promise<HandlerResult> {
    // (Mantido como na versão anterior - v1.3)
    const { user, incomingText, normalizedQuery, promptHistoryForAI, initialDialogueState, tone, userIdStr, greeting, enrichedReport } = params;
    const planFlowTag = "[_handleContentPlanRequest v1.3 - Dynamic Metric]";
    logger.debug(`${planFlowTag} Iniciando...`);
    if (!enrichedReport) { throw new Error("Relatório enriquecido (enrichedReport) não foi fornecido para _handleContentPlanRequest. Verifique o fluxo de dados."); }
    const { targetMetricField, friendlyName: targetMetricFriendlyName } = extractTargetMetricFocus(normalizedQuery);
    let prompt: string;
    let commonCombinationDataForPlan: { proposal: string; context: string; stat: DetailedContentStat } | null = null;
    const reliableStats = (enrichedReport.detailedContentStats || []) .filter(stat => !!(stat && stat._id && stat.count >= 2));
    if (reliableStats.length === 1) { const bestStat = reliableStats[0]!; commonCombinationDataForPlan = { proposal: bestStat._id.proposal || 'N/A', context: bestStat._id.context || 'N/A', stat: bestStat as DetailedContentStat }; } else if (reliableStats.length > 1) { const bestStat = reliableStats[0]!; const bestPCKey = `${bestStat._id.proposal || 'N/A'}|${bestStat._id.context || 'N/A'}`; const top3Keys = reliableStats.slice(0, 3).map(stat => `${stat._id.proposal || 'N/A'}|${stat._id.context || 'N/A'}`); if (top3Keys.filter(key => key === bestPCKey).length >= 2) { commonCombinationDataForPlan = { proposal: bestStat._id.proposal || 'N/A', context: bestStat._id.context || 'N/A', stat: bestStat as DetailedContentStat }; } }
    if (commonCombinationDataForPlan) { prompt = generateGroupedContentPlanInstructions( user.name || "usuário", commonCombinationDataForPlan, enrichedReport, promptHistoryForAI, tone, incomingText, targetMetricField as keyof DetailedContentStat | null, targetMetricFriendlyName ); logger.info(`${planFlowTag} Usando prompt AGRUPADO (Foco: ${targetMetricFriendlyName ?? 'Padrão'}).`); } else { prompt = generateContentPlanInstructions( user.name || "usuário", enrichedReport, promptHistoryForAI, tone, incomingText, targetMetricField as keyof DetailedContentStat | null, targetMetricFriendlyName ); logger.info(`${planFlowTag} Usando prompt PADRÃO (Foco: ${targetMetricFriendlyName ?? 'Padrão'}).`); }
    const aiCoreResponse = await callAIWithResilience(prompt);
    const planContextToSave = parsePlanItemsFromResponse(aiCoreResponse);
    let nextState: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now(), recentPlanIdeas: null, recentPlanTimestamp: undefined, lastOfferedScriptIdea: null };
    if (planContextToSave) { logger.info(`${planFlowTag} Contexto do plano com ${planContextToSave.length} itens extraído.`); nextState.recentPlanIdeas = planContextToSave; nextState.recentPlanTimestamp = Date.now(); } else { logger.warn(`${planFlowTag} Não foi possível extrair contexto do plano da resposta da IA (formato pode ser inesperado). O estado não será atualizado com 'recentPlanIdeas'.`); }
    const { finalResponse, greetingAdded } = await addGreetingAndGraph(aiCoreResponse, userIdStr, greeting, nextState);
    if (greetingAdded) { nextState.lastGreetingSent = Date.now(); }
    return { aiCoreResponse, nextDialogueState: nextState, finalResponseString: finalResponse };
}


/** Handler para a intenção ranking_request */
async function _handleRankingRequest(params: HandlerParams): Promise<HandlerResult> {
    // (Mantido como na v1.1)
     const { user, incomingText, promptHistoryForAI, initialDialogueState, tone, userIdStr, greeting, enrichedReport } = params;
     const rankingFlowTag = "[_handleRankingRequest v1.1]";
     logger.debug(`${rankingFlowTag} Iniciando...`);
     if (!enrichedReport) { throw new Error("Relatório enriquecido não fornecido para _handleRankingRequest"); }
     const prompt = generateRankingInstructions(user.name || "usuário", enrichedReport, promptHistoryForAI, tone, incomingText);
     const aiCoreResponse = await callAIWithResilience(prompt);
     let nextState: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now(), recentPlanIdeas: null, recentPlanTimestamp: undefined, lastOfferedScriptIdea: initialDialogueState.lastOfferedScriptIdea }; /* Mantém a oferta de script */
     const { finalResponse, greetingAdded } = await addGreetingAndGraph(aiCoreResponse, userIdStr, greeting, nextState);
     if (greetingAdded) { nextState.lastGreetingSent = Date.now(); }
     return { aiCoreResponse, nextDialogueState: nextState, finalResponseString: finalResponse };
}

/** Handler para intenções gerais (general, report, content_ideas, etc.) */
async function _handleGeneralRequest(params: HandlerParams, intent: string): Promise<HandlerResult> {
    // (Mantido como na v1.7 com Type Guard)
    const { user, incomingText, promptHistoryForAI, initialDialogueState, tone, userIdStr, greeting, enrichedReport } = params;
    const generalFlowTag = `[_handleGeneralRequest v1.7 - Type Guard Fix - Intent: ${intent}]`;
    logger.debug(`${generalFlowTag} Iniciando...`);
    if (!enrichedReport) { throw new Error("Relatório enriquecido não fornecido para _handleGeneralRequest"); }
    const prompt = generateAIInstructions(user.name || "usuário", enrichedReport, promptHistoryForAI, tone, incomingText);
    const aiCoreResponse = await callAIWithResilience(prompt);
    const originalAICoreResponseForSaving = aiCoreResponse;
    let offeredScriptContextToSave: IDialogueState['lastOfferedScriptIdea'] = null;
    try {
        const proactiveContext = extractProactiveSuggestionContext(aiCoreResponse);
        if (proactiveContext) {
            logger.info(`${generalFlowTag} Contexto de oferta proativa (placeholder) extraído: "${proactiveContext.aiGeneratedIdeaDescription}"`);
            let originalSourceData: OriginalSourceContext = null;
            const topStat = enrichedReport.detailedContentStats?.[0];
            const bestPostCandidate = topStat?.bestPostInGroup;
            if (isValidBestPostWithDescription(bestPostCandidate)) {
                originalSourceData = { description: bestPostCandidate.description, proposal: topStat?._id?.proposal, context: topStat?._id?.context, };
                logger.info(`${generalFlowTag} Fonte original ('bestPostInGroup') encontrada para oferta proativa: "${originalSourceData.description.substring(0,50)}..."`);
            } else {
                const bestPostExists = !!bestPostCandidate;
                logger.warn(`${generalFlowTag} Não foi possível encontrar fonte original rica ('bestPostInGroup' ${bestPostExists ? 'sem descrição válida' : 'ausente'}) para oferta proativa.`);
            }
            offeredScriptContextToSave = { aiGeneratedIdeaDescription: proactiveContext.aiGeneratedIdeaDescription, originalSource: originalSourceData, timestamp: Date.now() };
            logger.debug(`${generalFlowTag} Contexto de oferta a ser salvo:`, offeredScriptContextToSave);
        } else { logger.debug(`${generalFlowTag} Nenhum placeholder de oferta proativa encontrado na resposta da IA.`); }
    } catch (parseError) { logger.error(`${generalFlowTag} Erro ao extrair/enriquecer contexto proativo:`, parseError); }
    let nextState: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now(), recentPlanIdeas: null, recentPlanTimestamp: undefined, lastOfferedScriptIdea: offeredScriptContextToSave };
    let postsInfo = "";
    const topFormatted = formatPostListWithLinks(enrichedReport.top3Posts, "📈 Posts gerais que se destacaram:");
    const bottomFormatted = formatPostListWithLinks(enrichedReport.bottom3Posts, "📉 Posts gerais com menor desempenho:");
    if (topFormatted || bottomFormatted) { postsInfo = `\n\n---\n**Posts gerais referência:**${topFormatted}${topFormatted && bottomFormatted ? '\n' : ''}${bottomFormatted}`; }
    const responseWithExtras = aiCoreResponse + postsInfo;
    const { finalResponse, greetingAdded } = await addGreetingAndGraph(responseWithExtras, userIdStr, greeting, nextState);
    if (greetingAdded) { nextState.lastGreetingSent = Date.now(); }
    return { aiCoreResponse: originalAICoreResponseForSaving, nextDialogueState: nextState, finalResponseString: finalResponse };
}


// --- Lógica Principal de Processamento REATORADA ---
async function processMainAIRequest(
    user: IUser,
    incomingText: string,
    normalizedQuery: string,
    conversationHistory: string, // Histórico completo da conversa
    initialDialogueState: IDialogueState,
    greeting: string,
    userIdStr: string,
    cacheKey: string
): Promise<string> {
    // (Implementação mantida v3.17)
    const versionTag = "[processMainAIRequest v3.17 - Context Clear Fix]"; logger.debug(`${versionTag} Orquestrando para ${userIdStr}. Estado Inicial:`, initialDialogueState); const intentResult = await intentService.determineIntent(normalizedQuery, user, incomingText, initialDialogueState, greeting, userIdStr); if (intentResult.type === 'special_handled') { logger.info(`${versionTag} Resposta de caso especial (${intentResult.response.substring(0,30)}...). Atualizando estado.`); let specialStateUpdate: IDialogueState = { ...initialDialogueState, lastInteraction: Date.now(), recentPlanIdeas: null, recentPlanTimestamp: undefined, lastOfferedScriptIdea: null }; logger.debug("[Special Case] Contexto do plano e oferta de roteiro limpos."); await updateDialogueState(userIdStr, specialStateUpdate).catch(e => logger.error('Falha ao salvar estado dialogo (caso especial)', e)); return intentResult.response; } const intent = intentResult.intent; logger.info(`${versionTag} Intenção principal determinada: ${intent}`); const tone = adjustTone(user.profileTone || "informal e prestativo"); const promptHistoryForAI = getPromptHistory(conversationHistory); let handlerResult: HandlerResult; let enrichedReportData: IEnrichedReport | undefined = undefined; if (intent !== 'script_request') { const dataPrepStartTime = Date.now(); try { const { enrichedReport } = await dataService.fetchAndPrepareReportData({ user, dailyMetricModel: DailyMetric, contentMetricModel: Metric }); enrichedReportData = enrichedReport; logger.debug(`${versionTag} Preparação de dados via DataService OK (${Date.now() - dataPrepStartTime}ms).`); } catch (dataError) { logger.error(`${versionTag} Falha na preparação de dados para intent ${intent}`, dataError); throw dataError; } } const handlerParams: HandlerParams = { user, incomingText, normalizedQuery, promptHistoryForAI, conversationHistory, initialDialogueState, tone, userIdStr, greeting, enrichedReport: enrichedReportData }; switch (intent) { case 'script_request': handlerResult = await _handleScriptRequest(handlerParams); break; case 'content_plan': handlerResult = await _handleContentPlanRequest(handlerParams); break; case 'ranking_request': handlerResult = await _handleRankingRequest(handlerParams); break; default: handlerResult = await _handleGeneralRequest(handlerParams, intent); break; } logger.debug(`${versionTag} Estado final preparado para salvar:`, handlerResult.nextDialogueState); await updateDialogueState(userIdStr, handlerResult.nextDialogueState) .catch(stateError => { logger.error(`${versionTag} Falha ao atualizar dialogue state principal para ${userIdStr}:`, stateError); }); logger.debug(`${versionTag} Agendando updates async (cache, history, usage, graph) para user ${userIdStr}...`); Promise.allSettled([ setInCache(cacheKey, handlerResult.finalResponseString, REDIS_CACHE_TTL_SECONDS), updateConversationContext(userIdStr, incomingText, handlerResult.aiCoreResponse, conversationHistory), incrementUsageCounter(userIdStr), persistDialogueGraph() ]).then(results => { results.forEach((result, index) => { if (result.status === 'rejected') { const taskName = ['cache', 'history', 'usage', 'graph'][index]; logger.error(`${versionTag} Falha na tarefa async ${taskName}:`, result.reason); } }); }); return handlerResult.finalResponseString;
}


// --- Tratamento Global de Erros ---
function handleError(error: unknown, fromPhone: string, userId: string | 'N/A', startTime: number): string {
    // ... (código mantido) ...
    const versionTag = "[handleError v3.15]"; const duration = Date.now() - startTime; let userMessage = `Ops! Tive um probleminha aqui e não consegui processar sua solicitação (${error instanceof Error ? error.constructor.name : 'Unknown'}). 🤯 Poderia tentar novamente em um instante? Se o problema persistir, fale com o suporte.`; let errorType = "UnknownError"; let logPayload: any = { error }; if (error instanceof AIError) { errorType = 'AIError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof UserNotFoundError) { errorType = 'UserNotFoundError'; logPayload = { message: error.message, name: error.name }; } else if (error instanceof MetricsNotFoundError) { errorType = 'MetricsNotFoundError'; logPayload = { message: error.message, name: error.name }; } else if (error instanceof ReportAggregationError) { errorType = 'ReportAggregationError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof DetailedStatsError) { errorType = 'DetailedStatsError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof DatabaseError) { errorType = 'DatabaseError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof CacheError) { errorType = 'CacheError'; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof BaseError) { errorType = error.constructor.name; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else if (error instanceof Error) { errorType = error.constructor.name; logPayload = { message: error.message, name: error.name, stack: error.stack }; } else { errorType = 'UnknownNonError'; logPayload = { error }; } logger.error( `${versionTag} Erro processando para ${userId} (${fromPhone.slice(0,-4)}****). Tipo: ${errorType}. Duração: ${duration}ms.`, logPayload ); return userMessage;
}

// --- Função Principal Exportada ---
export async function getConsultantResponse(fromPhone: string, incomingText: string): Promise<string> {
    // ... (código mantido) ...
    const versionTag = "[getConsultantResponse v3.15]"; const startTime = Date.now(); logger.info(`${versionTag} INÍCIO: Chamada de ${fromPhone.slice(0, -4)}****. Msg: "${incomingText.substring(0, 50)}..."`); const normalizedQuery = normalizeTextInput(incomingText.trim()); const normalizedQueryForCache = normalizedQuery.replace(/\s+/g, '_').substring(0, 100); const cacheKey = `response:${fromPhone}:${normalizedQueryForCache}`; let user: IUser | null = null; let userIdStr: string | 'N/A' = 'N/A'; let initialDialogueState: IDialogueState = {}; try { const cachedResponse = await getFromCache(cacheKey); if (cachedResponse) { logger.info(`${versionTag} [Cache] HIT para ${cacheKey}. Tempo Total: ${Date.now() - startTime}ms`); return cachedResponse; } logger.debug(`${versionTag} [Cache] MISS para ${cacheKey}`); user = await dataService.lookupUser(fromPhone); userIdStr = user._id.toString(); let fullConversationHistory: string; ({ dialogueState: initialDialogueState, conversationHistory: fullConversationHistory } = await loadContext(userIdStr)); const userNameForGreeting = user.name || 'usuário'; const greeting = getRandomGreeting(userNameForGreeting); if (!normalizedQuery) { logger.warn(`${versionTag} Mensagem vazia ou inválida de ${fromPhone}.`); const emptyResponse = `${greeting} Como posso ajudar? 😊`; await updateDialogueState(userIdStr, { ...initialDialogueState, lastInteraction: Date.now() }); return emptyResponse; } const aiResponse = await processMainAIRequest( user, incomingText, normalizedQuery, fullConversationHistory, initialDialogueState, greeting, userIdStr, cacheKey ); const totalDuration = Date.now() - startTime; logger.info(`${versionTag} FIM OK. User: ${userIdStr}. Tam Resposta: ${aiResponse.length}. Tempo Total: ${totalDuration}ms`); return aiResponse; } catch (error: unknown) { const errorResponse = handleError(error, fromPhone, userIdStr, startTime); return errorResponse; }
}

// --- Funções Exportadas Adicionais ---
export async function generateStrategicWeeklySummary(userName: string, aggregatedReport: AggregatedReport): Promise<string> {
    // ... (código mantido) ...
    const fnTag = "[generateStrategicWeeklySummary]"; logger.warn(`${fnTag} Função não totalmente implementada.`); const overallStatsString = JSON.stringify(aggregatedReport.overallStats); const prompt = `Gere um resumo estratégico semanal curto e direto (2-3 pontos principais) para ${userName} baseado nestes dados agregados de desempenho: ${overallStatsString}. Foque nos maiores Ganhos ou Perdas.`; try { return await callAIWithResilience(prompt); } catch(error) { logger.error(`${fnTag} Falha para ${userName}`, error); if (error instanceof AIError) return "Desculpe, não consegui falar com a IA para gerar o resumo semanal agora."; return "Desculpe, ocorreu um erro inesperado ao gerar o resumo semanal."; }
}


// =========================================================================
// FIM: consultantService.ts - v3.31 (Com Passo 1 da Priorização Dinâmica e Correções de Tipo)
// =========================================================================
