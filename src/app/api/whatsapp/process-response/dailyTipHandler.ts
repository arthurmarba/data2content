// src/app/api/whatsapp/process-response/dailyTipHandler.ts
// Versão: v2.0.1
// - CORREÇÃO: Corrige erro 'Cannot find name' ao remover chamada obsoleta de 'generateAlertSubjectFromText' no bloco de Fallback.
// - REATORAÇÃO COMPLETA: Lógica de montagem de mensagens de alerta e fallback foi redesenhada.
// - CENTRALIZAÇÃO: A geração do texto do alerta agora é 100% delegada para o aiOrchestrator com um prompt especializado.
// - REMOÇÃO: Removidas as funções 'generateAlertSubjectFromText' e 'getFirstSentence' que se tornaram obsoletas.
// - MELHORIA: A mensagem não começa mais com saudações genéricas ("Olá..."), indo direto ao ponto do alerta.
// - CONSISTÊNCIA: O bloco de Fallback agora usa a mesma lógica de geração de mensagem via IA que o bloco de Alerta.

import { NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { sendTemplateMessage, ITemplateComponent, sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import type { IDialogueState, ILastResponseContext, IFallbackInsightHistoryEntry } from '@/app/lib/stateService'; 
import * as dataService from '@/app/lib/dataService';
import type { IEnrichedReport, IAccountInsight, CommunityInspirationFilters } from '@/app/lib/dataService';
import { calculateInspirationSimilarity, UserEngagementProfile } from '@/app/lib/dataService/communityService';
import type { ICommunityInspiration } from '@/app/models/CommunityInspiration';
import type { IMetric } from '@/app/models/Metric';
import { IUser, IAlertHistoryEntry, AlertDetails } from '@/app/models/User';
import {
    VALID_FORMATS,
    VALID_PROPOSALS,
    VALID_CONTEXTS,
    VALID_TONES,
    VALID_REFERENCES,
    VALID_PERFORMANCE_HIGHLIGHTS,
    type FormatType,
    type ProposalType,
    type ContextType,
    type ToneType,
    type ReferenceType,
    type PerformanceHighlightType,
} from '@/app/lib/constants/communityInspirations.constants';

import { ProcessRequestBody, DetectedEvent, EnrichedAIContext } from './types';

import ruleEngineInstance from '@/app/lib/ruleEngine';
import {
    DEFAULT_RADAR_STREAM_READ_TIMEOUT_MS,
    INSTIGATING_QUESTION_MODEL,
    INSTIGATING_QUESTION_TEMP,
    INSTIGATING_QUESTION_MAX_TOKENS,
    CONTEXT_EXTRACTION_MODEL,
    CONTEXT_EXTRACTION_TEMP,
    CONTEXT_EXTRACTION_MAX_TOKENS,
    DEFAULT_METRICS_FETCH_DAYS,
    FallbackInsightType
} from '@/app/lib/constants';
import { callOpenAIForQuestion } from '@/app/lib/aiService';
import { subDays, startOfDay } from 'date-fns';

import * as fallbackInsightService from '@/app/lib/fallbackInsightService';
import { isActiveLike } from '@/app/lib/isActiveLike';

// Funções "Type Guard" que verificam se um valor pertence ao tipo específico em tempo de execução.
function isFormatType(value: any): value is FormatType {
    return VALID_FORMATS.includes(value as FormatType);
}

function isProposalType(value: any): value is ProposalType {
    return VALID_PROPOSALS.includes(value as ProposalType);
}

function isContextType(value: any): value is ContextType {
    return VALID_CONTEXTS.includes(value as ContextType);
}

function isToneType(value: any): value is ToneType {
    return VALID_TONES.includes(value as ToneType);
}

// CORREÇÃO: Novo type guard para 'reference'.
function isReferenceType(value: any): value is ReferenceType {
    return VALID_REFERENCES.includes(value as ReferenceType);
}

function isPerformanceHighlightType(value: any): value is PerformanceHighlightType {
    return VALID_PERFORMANCE_HIGHLIGHTS.includes(value as PerformanceHighlightType);
}


// ===================================================================================
// FIM: Definições de Tipos e Validadores
// ===================================================================================


const HANDLER_TAG_BASE = '[DailyTipHandler v2.0.1]'; // Tag da versão atualizada

const PROACTIVE_ALERT_TEMPLATE_NAME = process.env.PROACTIVE_ALERT_TEMPLATE_NAME;
const GENERIC_ERROR_TEMPLATE_NAME = process.env.GENERIC_ERROR_TEMPLATE_NAME;


async function extractContextFromRadarResponse(
    aiResponseText: string,
    userId: string
): Promise<ILastResponseContext | null> {
    const TAG = `${HANDLER_TAG_BASE}[extractContextFromRadarResponse] User ${userId}:`;
    const trimmedResponseText = aiResponseText.trim();
    const wasOriginalResponseAQuestion = trimmedResponseText.endsWith('?');

    if (!trimmedResponseText || trimmedResponseText.length < 10) {
        logger.debug(`${TAG} Resposta da IA muito curta para extração de tópico/entidades, mas registrando se era pergunta.`);
        const shortContext: ILastResponseContext = { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
        logger.debug(`${TAG} Contexto retornado para resposta curta - Timestamp: ${shortContext.timestamp}, WasQuestion: ${shortContext.wasQuestion}`);
        return shortContext;
    }

    const prompt = `
Dada a seguinte resposta de um assistente de IA chamado Mobi, identifique concisamente:
1. O tópico principal da resposta de Mobi (em até 10 palavras).
2. As principais entidades ou termos chave mencionados por Mobi (liste até 3-4 termos).

Resposta de Mobi:
---
${trimmedResponseText.substring(0, 1500)} ${trimmedResponseText.length > 1500 ? "\n[...resposta truncada...]" : ""}
---

Responda SOMENTE em formato JSON com as chaves "topic" (string) e "entities" (array de strings).
Se não for possível determinar um tópico claro ou entidades, retorne um JSON com "topic": null e "entities": [].
JSON:
`;

    try {
        logger.debug(`${TAG} Solicitando extração de contexto para a resposta do Radar Mobi...`);
        const modelForExtraction = (typeof CONTEXT_EXTRACTION_MODEL !== 'undefined' ? CONTEXT_EXTRACTION_MODEL : process.env.CONTEXT_EXTRACTION_MODEL) || 'gpt-3.5-turbo';
        const tempForExtraction = (typeof CONTEXT_EXTRACTION_TEMP !== 'undefined' ? CONTEXT_EXTRACTION_TEMP : Number(process.env.CONTEXT_EXTRACTION_TEMP)) ?? 0.2;
        const maxTokensForExtraction = (typeof CONTEXT_EXTRACTION_MAX_TOKENS !== 'undefined' ? CONTEXT_EXTRACTION_MAX_TOKENS : Number(process.env.CONTEXT_EXTRACTION_MAX_TOKENS)) || 150;

        const extractionResultText = await callOpenAIForQuestion(prompt, {
            model: modelForExtraction,
            temperature: tempForExtraction,
            max_tokens: maxTokensForExtraction,
        });

        if (!extractionResultText) {
            logger.warn(`${TAG} Extração de contexto retornou texto vazio.`);
            const emptyTextContext: ILastResponseContext = { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
            logger.debug(`${TAG} Contexto retornado (texto de extração vazio) - Timestamp: ${emptyTextContext.timestamp}, WasQuestion: ${emptyTextContext.wasQuestion}`);
            return emptyTextContext;
        }

        const jsonMatch = extractionResultText.match(/\{[\s\S]*\}/);
        if (!jsonMatch || !jsonMatch[0]) {
            logger.warn(`${TAG} Nenhum JSON encontrado na resposta da extração de contexto. Resposta: ${extractionResultText}`);
            const noJsonContext: ILastResponseContext = { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
            logger.debug(`${TAG} Contexto retornado (sem JSON na extração) - Timestamp: ${noJsonContext.timestamp}, WasQuestion: ${noJsonContext.wasQuestion}`);
            return noJsonContext;
        }

        const parsedJson = JSON.parse(jsonMatch[0]);

        const context: ILastResponseContext = {
            topic: (parsedJson && typeof parsedJson.topic === 'string') ? parsedJson.topic.trim() : undefined,
            entities: (parsedJson && Array.isArray(parsedJson.entities)) ? parsedJson.entities.map((e: any) => String(e).trim()).filter((e: string) => e) : [],
            timestamp: Date.now(),
            wasQuestion: wasOriginalResponseAQuestion,
        };

        if (!context.topic && (!context.entities || context.entities.length === 0) && !context.wasQuestion) {
            logger.debug(`${TAG} Extração de contexto não produziu tópico, entidades ou indicativo de pergunta. Retornando null após tentativa de parse.`);
            if (!context.wasQuestion) return null;
        }

        logger.info(`${TAG} Contexto extraído da resposta do Radar (FINAL) - Topic: "${context.topic ? context.topic.substring(0,50) + '...' : 'N/A'}", Entities: [${context.entities?.join(', ')}], Timestamp: ${context.timestamp}, WasQuestion: ${context.wasQuestion}`);
        return context;

    } catch (error) {
        logger.error(`${TAG} Erro ao extrair contexto da resposta do Radar:`, error);
        const errorContext: ILastResponseContext = { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
        logger.debug(`${TAG} Contexto retornado (erro na extração) - Timestamp: ${errorContext.timestamp}, WasQuestion: ${errorContext.wasQuestion}`);
        return errorContext;
    }
}

async function generateInstigatingQuestionForDefaultMessage(
    baseMessage: string,
    dialogueState: IDialogueState,
    userId: string,
    userName: string
): Promise<string | null> {
    const TAG = `${HANDLER_TAG_BASE}[generateInstigatingQuestionForDefaultMessage] User ${userId}:`;

    if (baseMessage.trim().endsWith('?')) {
        logger.debug(`${TAG} Mensagem base já termina com uma pergunta. Pulando.`);
        return null;
    }

    const conversationSummary = dialogueState.conversationSummary || 'Ainda não conversamos muito.';
    const lastRadarAlertType = dialogueState.lastRadarAlertType || 'Nenhum alerta recente.';

    const prompt = `
Você é Mobi, um consultor de IA especialista em Instagram, e está enviando uma mensagem proativa diária para ${userName}.
Sua mensagem base para ${userName} foi:
"${baseMessage}"

Para tornar essa mensagem mais engajadora e incentivar ${userName} a interagir, formule UMA pergunta curta (1-2 frases), aberta e instigante (em português brasileiro) que o convide a:
1. Explorar alguma funcionalidade geral do Mobi que ele talvez não conheça.
2. Refletir sobre seus objetivos de conteúdo atuais.
3. Pedir uma análise de dados que não seja um "alerta", mas que possa ser útil (ex: "Como foi o alcance dos seus últimos Reels?", "Quer ver um resumo do seu crescimento de seguidores este mês?").
4. Considerar um tipo de conteúdo ou estratégia que ele pode não ter explorado recentemente.

A pergunta NÃO deve ser uma simples confirmação. Deve genuinamente levar o usuário a pensar e a querer usar o Mobi para investigar mais.
Evite perguntas que pareçam genéricas demais ou que já tenham sido feitas recentemente.
Se, após um esforço genuíno, não conseguir pensar em uma pergunta instigante e útil que se encaixe bem após a mensagem base, responda APENAS com a palavra "NO_QUESTION".

Contexto adicional:
- Resumo da conversa até agora: "${conversationSummary.substring(0, 500)}"
- Tipo do último alerta do radar (se houver): "${lastRadarAlertType}"
- Histórico recente de insights de fallback (tipos enviados nos últimos dias, se houver): ${JSON.stringify(dialogueState.fallbackInsightsHistory?.slice(-5).map((h: IFallbackInsightHistoryEntry) => h.type) || [])}

Pergunta instigante (ou "NO_QUESTION"):
`;

    try {
        logger.debug(`${TAG} Solicitando geração de pergunta instigante para mensagem padrão...`);
        const model = (typeof INSTIGATING_QUESTION_MODEL !== 'undefined' ? INSTIGATING_QUESTION_MODEL : process.env.INSTIGATING_QUESTION_MODEL) || 'gpt-3.5-turbo';
        const temperature = (typeof INSTIGATING_QUESTION_TEMP !== 'undefined' ? INSTIGATING_QUESTION_TEMP : Number(process.env.INSTIGATING_QUESTION_TEMP)) ?? 0.75;
        const max_tokens = (typeof INSTIGATING_QUESTION_MAX_TOKENS !== 'undefined' ? INSTIGATING_QUESTION_MAX_TOKENS : Number(process.env.INSTIGATING_QUESTION_MAX_TOKENS)) || 90;

        const questionText = await callOpenAIForQuestion(prompt, {
            model,
            temperature,
            max_tokens,
        });

        if (!questionText || questionText.trim().toUpperCase() === 'NO_QUESTION' || questionText.trim().length < 10) {
            logger.debug(`${TAG} Nenhuma pergunta instigante gerada para msg padrão ou "NO_QUESTION" recebido. Resposta: "${questionText}"`);
            return null;
        }

        logger.info(`${TAG} Pergunta instigante para msg padrão gerada: "${questionText.trim()}"`);
        return questionText.trim();

    } catch (error) {
        logger.error(`${TAG} Erro ao gerar pergunta instigante para msg padrão:`, error);
        return null;
    }
}

/**
 * If the provided message has no URL, append an Instagram link derived from the
 * alert details when available.
 */
export function appendInstagramLinkIfMissing(
    message: string,
    details: { [key: string]: any }
): string {
    if (/https?:\/\//.test(message)) {
        return message;
    }

    const postLink: string | undefined =
        (details && typeof details.postLink === 'string' && details.postLink.trim()) ||
        (details && typeof details.platformPostId === 'string' && `https://www.instagram.com/p/${details.platformPostId}`) ||
        (details && typeof details.originalPlatformPostId === 'string' && `https://www.instagram.com/p/${details.originalPlatformPostId}`) ||
        undefined;

    if (!postLink) {
        return message;
    }

    return `${message}\n\n${postLink}`;
}

export async function buildInspirationFilters(
    userId: string,
    details?: { [key: string]: any },
    forFallback: boolean = false
): Promise<CommunityInspirationFilters> {
    const filters: CommunityInspirationFilters = {};

    // Always try to analyse the user's top posts
    let topPosts: IMetric[] = [];
    try {
        topPosts = await dataService.getTopPostsByMetric(userId, 'saved', 5);
    } catch (e) {
        logger.warn(`[DailyTipHandler] Falha ao obter top posts: ${e}`);
    }

    const hasEnoughPosts = topPosts.length >= 3;

    if (hasEnoughPosts) {
        const bestPost = topPosts[0];
        const bestTone = Array.isArray((bestPost as any).tone) ? (bestPost as any).tone[0] : (bestPost as any).tone;
        if (bestTone && isToneType(bestTone)) {
            filters.tone = bestTone;
        }
        const bestReference = Array.isArray((bestPost as any).references) ? (bestPost as any).references[0] : (bestPost as any).references?.[0];
        if (bestReference && isReferenceType(bestReference)) {
            filters.reference = bestReference;
        }

        const freq: Record<'proposal' | 'context' | 'reference' | 'tone', Record<string, number>> = {
            proposal: {},
            context: {},
            reference: {},
            tone: {},
        };

        for (const p of topPosts) {
            const pr = Array.isArray(p.proposal) ? p.proposal[0] : (p as any).proposal;
            const ct = Array.isArray(p.context) ? p.context[0] : (p as any).context;
            const rf = Array.isArray((p as any).references) ? (p as any).references[0] : (p as any).references?.[0];
            const tn = Array.isArray((p as any).tone) ? (p as any).tone[0] : (p as any).tone;

            if (isProposalType(pr)) freq.proposal[pr] = (freq.proposal[pr] || 0) + 1;
            if (isContextType(ct)) freq.context[ct] = (freq.context[ct] || 0) + 1;
            if (isReferenceType(rf)) freq.reference[rf] = (freq.reference[rf] || 0) + 1;
            if (isToneType(tn)) freq.tone[tn] = (freq.tone[tn] || 0) + 1;
        }

        const mostCommon = (m: Record<string, number>): string | undefined =>
            Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0];

        const bestProposal = mostCommon(freq.proposal);
        const bestContext = mostCommon(freq.context);

        if (bestProposal && isProposalType(bestProposal)) filters.proposal = bestProposal;
        if (bestContext && isContextType(bestContext)) filters.context = bestContext;

        if (!filters.reference) {
            const refCommon = mostCommon(freq.reference);
            if (refCommon && isReferenceType(refCommon)) filters.reference = refCommon;
        }

        if (!filters.tone) {
            const toneCommon = mostCommon(freq.tone);
            if (toneCommon && isToneType(toneCommon)) filters.tone = toneCommon;
        }

        logger.debug(`[DailyTipHandler] Filtros extraídos do melhor post: tone=${filters.tone}, reference=${filters.reference}`);
    }

    if (details) {
        if (!filters.format && isFormatType(details.format)) {
            filters.format = details.format;
        }
        if (!filters.format && isFormatType(details.formatName)) {
            filters.format = details.formatName;
        }
        if (!filters.proposal && isProposalType(details.proposal)) {
            filters.proposal = details.proposal;
        }
        if (!filters.proposal && isProposalType(details.lastPostProposal)) {
            filters.proposal = details.lastPostProposal;
        }
        if (!filters.context && isContextType(details.context)) {
            filters.context = details.context;
        }
        if (!filters.context && isContextType(details.lastPostContext)) {
            filters.context = details.lastPostContext;
        }
        if (!filters.tone && isToneType(details.tone)) {
            filters.tone = details.tone;
        }
        if (!filters.reference && isReferenceType(details.reference)) {
            filters.reference = details.reference;
        }
        if (typeof details.isPositiveAlert === 'boolean') {
            if (details.isPositiveAlert) {
                filters.performanceHighlights_Qualitative_INCLUDES_ANY = ['excelente_retencao_em_reels', 'viralizou_nos_compartilhamentos'];
            } else {
                filters.performanceHighlights_Qualitative_INCLUDES_ANY = ['desempenho_padrao', 'baixo_volume_de_dados'];
            }
        }
    }

    if (forFallback && !hasEnoughPosts && (!filters.format || !filters.proposal || !filters.context)) {
        try {
            const selected = Array.isArray(topPosts) ? topPosts.slice(0, 3) : [];

            const formatFreq: Record<string, number> = {};
            const proposalFreq: Record<string, number> = {};
            const contextFreq: Record<string, number> = {};

            for (const p of selected) {
                const f = Array.isArray(p.format) ? p.format[0] : (p.format as any);
                const pr = Array.isArray(p.proposal) ? p.proposal[0] : (p.proposal as any);
                const c = Array.isArray(p.context) ? p.context[0] : (p.context as any);

                if (isFormatType(f)) {
                    formatFreq[f] = (formatFreq[f] || 0) + 1;
                }
                if (isProposalType(pr)) {
                    proposalFreq[pr] = (proposalFreq[pr] || 0) + 1;
                }
                if (isContextType(c)) {
                    contextFreq[c] = (contextFreq[c] || 0) + 1;
                }
            }

            const mostCommon = (freq: Record<string, number>): string | undefined => {
                return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
            };

            const commonFormat = mostCommon(formatFreq);
            const commonProposal = mostCommon(proposalFreq);
            const commonContext = mostCommon(contextFreq);

            if (!filters.format && commonFormat && isFormatType(commonFormat)) {
                filters.format = commonFormat;
            }
            if (!filters.proposal && commonProposal && isProposalType(commonProposal)) {
                filters.proposal = commonProposal;
            }
            if (!filters.context && commonContext && isContextType(commonContext)) {
                filters.context = commonContext;
            }
        } catch (e) {
            logger.warn(`[DailyTipHandler] Falha ao inferir formato por desempenho: ${e}`);
        }

        // Complementa com preferências do usuário, se disponíveis
        try {
            const user = await dataService.lookupUserById(userId);
            const prefs = user.userPreferences;
            if (prefs) {
                if (!filters.format && Array.isArray(prefs.preferredFormats) && prefs.preferredFormats.length > 0) {
                    const preferredFormat = prefs.preferredFormats[0];
                    if (isFormatType(preferredFormat)) {
                        filters.format = preferredFormat;
                    }
                }
                if (!filters.tone && isToneType(prefs.preferredAiTone)) {
                    filters.tone = prefs.preferredAiTone;
                }
            }
        } catch (e) {
            logger.warn(`[DailyTipHandler] Falha ao consultar preferências do usuário para inspiração: ${e}`);
        }
    }

    return filters;
}


export function computeInspirationSimilarity(
    bestPost: IMetric | null,
    insp: ICommunityInspiration
): number {
    // Simple heuristic: negative distance for rate differences + bonuses for matching categories
    let score = 0;
    const snap = insp.internalMetricsSnapshot || {};

    if (bestPost?.stats && bestPost.stats.reach && bestPost.stats.reach > 0) {
        const bestSaveRate = (bestPost.stats.saved ?? 0) / bestPost.stats.reach;
        const bestShareRate = (bestPost.stats.shares ?? 0) / bestPost.stats.reach;

        if (typeof snap.saveRate === 'number') {
            score -= Math.abs(snap.saveRate - bestSaveRate);
        }
        if (typeof snap.shareRate === 'number') {
            score -= Math.abs(snap.shareRate - bestShareRate);
        }
    }

    const bestFormat = Array.isArray(bestPost?.format) ? bestPost?.format[0] : bestPost?.format;
    const bestProposal = Array.isArray(bestPost?.proposal) ? bestPost?.proposal[0] : bestPost?.proposal;
    const bestContext = Array.isArray(bestPost?.context) ? bestPost?.context[0] : bestPost?.context;

    if (bestFormat && insp.format === bestFormat) score += 0.5;
    if (bestProposal && insp.proposal === bestProposal) score += 0.3;
    if (bestContext && insp.context === bestContext) score += 0.2;

    return score;
}

export async function buildSimilarityFn(
    userId: string
): Promise<(insp: ICommunityInspiration) => number> {
    let avgSaveRate: number | null = null;
    let avgShareRate: number | null = null;
    let count = 0;

    try {
        const topPosts = await dataService.getTopPostsByMetric(userId, 'saved', 5);
        for (const post of topPosts) {
            if (post.stats && post.stats.reach && post.stats.reach > 0) {
                const reach = post.stats.reach;
                avgSaveRate = (avgSaveRate ?? 0) + ((post.stats.saved ?? 0) / reach);
                avgShareRate = (avgShareRate ?? 0) + ((post.stats.shares ?? 0) / reach);
                count++;
            }
        }
        if (count > 0) {
            avgSaveRate = avgSaveRate! / count;
            avgShareRate = avgShareRate! / count;
            logger.debug(`[${HANDLER_TAG_BASE}] Ordenação por similaridade ativa (saveRate=${avgSaveRate.toFixed(4)}, shareRate=${avgShareRate.toFixed(4)})`);
            return (insp: ICommunityInspiration) => {
                let score = 0;
                const snap = insp.internalMetricsSnapshot || {};
                if (avgSaveRate !== null && typeof snap.saveRate === 'number') {
                    score -= Math.abs(snap.saveRate - avgSaveRate);
                }
                if (avgShareRate !== null && typeof snap.shareRate === 'number') {
                    score -= Math.abs(snap.shareRate - avgShareRate);
                }
                return score;
            };
        }
    } catch (e) {
        logger.debug(`[DailyTipHandler] Não foi possível obter posts para similaridade: ${e}`);
    }

    logger.debug(`[DailyTipHandler] Ordenação por similaridade não ativa.`);
    return () => 0;
}

/**
 * Busca uma inspiração da comunidade mais alinhada ao perfil de engajamento do usuário.
 * O perfil é construído a partir dos 10 posts com mais salvamentos e considera
 * proposta, contexto, referência e tom predominantes.
 */
export async function fetchInspirationSnippet(
    userId: string,
    filters: CommunityInspirationFilters,
    userOrExcludeIds?: IUser | string[]
): Promise<{ text: string; inspirationId?: string }> {
    try {
        let excludeIds: string[] = [];
        if (Array.isArray(userOrExcludeIds)) {
            excludeIds = userOrExcludeIds;
        } else if (userOrExcludeIds) {
            const historyEntries = userOrExcludeIds.communityInspirationHistory || [];
            excludeIds = historyEntries.flatMap(h => h.inspirationIds.map(id => id.toString()));
        }

        const topPosts = await dataService.getTopPostsByMetric(userId, 'saved', 10);
        const freq: Record<'proposal' | 'context' | 'reference' | 'tone', Record<string, number>> = {
            proposal: {},
            context: {},
            reference: {},
            tone: {},
        };
        for (const p of topPosts) {
            const pr = Array.isArray(p.proposal) ? p.proposal[0] : (p as any).proposal?.[0] || (p as any).proposal;
            const ct = Array.isArray(p.context) ? p.context[0] : (p as any).context?.[0] || (p as any).context;
            const rf = Array.isArray((p as any).references) ? (p as any).references[0] : (p as any).references?.[0];
            const tn = Array.isArray((p as any).tone) ? (p as any).tone[0] : (p as any).tone?.[0];
            
            // =======================================================================
            // CORREÇÃO APLICADA AQUI
            // Usando os type guards para garantir a segurança e resolver o erro de tipo.
            // =======================================================================
            if (isProposalType(pr)) freq.proposal[pr] = (freq.proposal[pr] || 0) + 1;
            if (isContextType(ct)) freq.context[ct] = (freq.context[ct] || 0) + 1;
            if (isReferenceType(rf)) freq.reference[rf] = (freq.reference[rf] || 0) + 1;
            if (isToneType(tn)) freq.tone[tn] = (freq.tone[tn] || 0) + 1;
        }
        const mostCommon = (m: Record<string, number>): string | undefined =>
            Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0];

        const userProfile: UserEngagementProfile = {
            proposal: mostCommon(freq.proposal) as ProposalType | undefined,
            context: mostCommon(freq.context) as ContextType | undefined,
            reference: mostCommon(freq.reference) as ReferenceType | undefined,
            tone: mostCommon(freq.tone) as ToneType | undefined,
        };

        logger.debug(`[DailyTipHandler] Perfil de engajamento extraído (proposal/context/reference/tone): ${JSON.stringify(userProfile)}`);

        const similarityFn = (insp: ICommunityInspiration) =>
            calculateInspirationSimilarity(userProfile, insp);

        const inspirations = await dataService.getInspirations(
            filters,
            3,
            excludeIds,
            similarityFn,
            userId
        );

        const insp = inspirations && inspirations.length > 0 ? inspirations[0] : undefined;
        if (insp) {
            const score = calculateInspirationSimilarity(userProfile, insp);
            logger.info(`[DailyTipHandler] Inspiração escolhida ${insp._id.toString()} com score ${score.toFixed(2)}`);
            await dataService.recordDailyInspirationShown(userId, [insp._id.toString()]);
            return {
                text: `\n\nInspiração da comunidade: ${insp.contentSummary} (${insp.originalInstagramPostUrl})`,
                inspirationId: insp._id.toString(),
            };
        }
    } catch (e) {
        logger.warn(`[DailyTipHandler] Falha ao buscar inspiração: ${e}`);
    }
    return { text: '' };
}

export async function handleDailyTip(payload: ProcessRequestBody): Promise<NextResponse> {
    console.log("!!!!!!!!!! EXECUTANDO handleDailyTip (v2.0.1) !!!!!!!!!! USER ID:", payload.userId, new Date().toISOString());
    
    const { userId } = payload;
    const handlerTAG = `${HANDLER_TAG_BASE} User ${userId}:`;
    logger.info(`${handlerTAG} Iniciando processamento do Radar Mobi com Templates...`);

    let userForRadar: IUser | null = null;
    let userPhoneForRadar: string | null | undefined;
    
    if (!PROACTIVE_ALERT_TEMPLATE_NAME || !GENERIC_ERROR_TEMPLATE_NAME) {
        logger.error(`${handlerTAG} Nomes de template (PROACTIVE_ALERT_TEMPLATE_NAME, GENERIC_ERROR_TEMPLATE_NAME) não configurados nas variáveis de ambiente. Interrompendo.`);
        return NextResponse.json({ error: "Server configuration missing template names." }, { status: 500 });
    }

    try {
        userForRadar = await dataService.lookupUserById(userId);

        if (!userForRadar) {
            logger.warn(`${handlerTAG} Usuário com ID ${userId} não encontrado.`);
            return NextResponse.json({ success: true, message: "User not found." }, { status: 200 });
        }

        const trialExpiresRaw = userForRadar.whatsappTrialExpiresAt;
        const trialExpiresDate =
            trialExpiresRaw instanceof Date
                ? trialExpiresRaw
                : trialExpiresRaw
                ? new Date(trialExpiresRaw)
                : null;
        const trialExpiresAt =
            trialExpiresDate && !Number.isNaN(trialExpiresDate.getTime()) ? trialExpiresDate : null;
        const trialExpiresIso = trialExpiresAt ? trialExpiresAt.toISOString() : 'null';
        const trialWindowActive =
            Boolean(userForRadar.whatsappTrialActive) &&
            Boolean(trialExpiresAt && trialExpiresAt.getTime() > Date.now());

        if (userForRadar.whatsappTrialActive && !trialWindowActive) {
            logger.info(
                `${handlerTAG} Trial de WhatsApp expirado (expiresAt=${trialExpiresIso}). Pulando envio proativo.`
            );
            return NextResponse.json({ trial: true, skipped: true, expired: true }, { status: 200 });
        }

        if (trialWindowActive) {
            logger.info(`${handlerTAG} Trial ativo detectado até ${trialExpiresIso}. Prosseguindo envio proativo.`);
        }

        // 🚫 Plano inativo não recebe mensagens proativas
        if (!isActiveLike(userForRadar.planStatus)) {
            logger.warn(`${handlerTAG} Plano do usuário é ${userForRadar.planStatus}. Pulando envio proativo do Radar.`);
            return NextResponse.json({ plan_inactive: true, skipped: true }, { status: 200 });
        }

        userPhoneForRadar = userForRadar.whatsappPhone;
        if (!userPhoneForRadar || !userForRadar.whatsappVerified) {
            logger.warn(`${handlerTAG} Usuário ${userId} sem WhatsApp válido/verificado.`);
            return NextResponse.json({ success: true, message: "User has no verified WhatsApp number." }, { status: 200 });
        }
        
        const dialogueStateForRadar = await stateService.getDialogueState(userId);
        const userNameForRadar = userForRadar.name || 'você';
        const userFirstNameForRadar = userNameForRadar.split(' ')[0]!;
        const today = new Date();
        
        logger.info(`${handlerTAG} Executando o motor de regras...`);
        const detectedEvent = await ruleEngineInstance.runAllRules(userId, dialogueStateForRadar);

        // --- Bloco de Fallback (Nenhum evento detectado) ---
        if (!detectedEvent) {
            logger.info(`${handlerTAG} Nenhum evento detectado. Gerando insight de fallback...`);
            
            // <<< INÍCIO DA CORREÇÃO >>>
            // A lógica para obter o insight de fallback continua a mesma.
            let enrichedReportForFallback: IEnrichedReport | null = null;
            let latestAccountInsightsForFallback: IAccountInsight | null = null;

            try {
                const analysisDays = DEFAULT_METRICS_FETCH_DAYS || 30;
                const analysisSinceDate = subDays(new Date(), analysisDays);
                const reportResult = await dataService.fetchAndPrepareReportData({ user: userForRadar, analysisSinceDate });
                if (reportResult && reportResult.enrichedReport) {
                    enrichedReportForFallback = reportResult.enrichedReport;
                }
                latestAccountInsightsForFallback = await dataService.getLatestAccountInsights(userId);
            } catch (dataError) {
                logger.error(`${handlerTAG} Erro ao buscar dados para insight de fallback:`, dataError);
            }
            
            const fallbackResult = await fallbackInsightService.getFallbackInsight(
                userForRadar,
                enrichedReportForFallback,
                latestAccountInsightsForFallback,
                dialogueStateForRadar 
            );
            
            let fallbackInsightText: string | null = null;
            let fallbackInsightType: FallbackInsightType | null = null;

            if (fallbackResult && fallbackResult.text && fallbackResult.type) {
                fallbackInsightText = fallbackResult.text;
                fallbackInsightType = fallbackResult.type;
            }

            // Se não houver insight de fallback, usamos um texto genérico.
            const messageForAI = fallbackInsightText || 'Hoje não detectei nenhum alerta específico, mas dei uma olhada geral nos seus dados para encontrar oportunidades.';

            // Montamos o contexto para a IA, assim como no bloco de alerta.
            const enrichedContextForAI: EnrichedAIContext = {
                user: userForRadar,
                historyMessages: [], 
                dialogueState: dialogueStateForRadar,
                userName: userFirstNameForRadar,
                currentAlertDetails: {} 
            };

            // Chamamos o aiOrchestrator com o prompt especializado de alerta.
            const { stream } = await askLLMWithEnrichedContext(
                enrichedContextForAI,
                messageForAI,
                'generate_proactive_alert'
            );
            
            // Lemos a resposta completa da IA.
            let finalDefaultMessageToSend = "";
            const reader = stream.getReader();
            // (A lógica de leitura do stream é a mesma do bloco de alerta, vamos adicioná-la aqui)
            let streamReadTimeout: NodeJS.Timeout | null = setTimeout(() => {
                logger.warn(`${handlerTAG} Timeout (${DEFAULT_RADAR_STREAM_READ_TIMEOUT_MS}ms) lendo stream da IA no fallback.`);
                if (reader && streamReadTimeout) {
                     reader.cancel().catch(e => logger.error(`${handlerTAG} Erro ao cancelar reader no timeout (fallback):`, e));
                }
                streamReadTimeout = null;
            }, DEFAULT_RADAR_STREAM_READ_TIMEOUT_MS);

            try {
                while (true) {
                    const result = await reader.read();
                    if (streamReadTimeout === null && !result.done) {
                        logger.warn(`${handlerTAG} Leitura do stream após timeout (fallback). Interrompendo.`);
                        if (!reader.closed) { reader.cancel().catch(e => logger.error(`${handlerTAG} Erro ao cancelar reader pós-timeout (fallback):`, e)); }
                        break;
                    }
                    if (result.done) break;
                    const chunk: unknown = result.value;
                    if (typeof chunk === 'string') {
                        finalDefaultMessageToSend += chunk;
                    } else if (chunk instanceof Uint8Array) {
                        finalDefaultMessageToSend += new TextDecoder().decode(chunk);
                    }
                }
            } catch (readError) {
                if (!(readError instanceof Error && readError.name === 'AbortError' && streamReadTimeout === null)) {
                     logger.error(`${handlerTAG} Erro ao ler stream da IA (fallback):`, readError);
                } else {
                    logger.info(`${handlerTAG} Leitura do stream cancelada por timeout (fallback).`);
                }
            } finally {
                if (streamReadTimeout) {
                    clearTimeout(streamReadTimeout);
                    streamReadTimeout = null;
                }
            }

            if (!finalDefaultMessageToSend.trim()) {
                finalDefaultMessageToSend = 'Dei uma olhada nos seus dados hoje e está tudo certo! Quer explorar algum ponto específico?';
            }

            // Adicionamos a inspiração, como antes.
            const inspirationFilters = await buildInspirationFilters(userId, undefined, true);
            const inspiration = await fetchInspirationSnippet(userId, inspirationFilters, userForRadar!);
            finalDefaultMessageToSend += inspiration.text;

            // O resto da lógica para enviar e salvar no histórico permanece.
            let whatsappMessageIdFallback: string | undefined;
            let sendStatusFallback: 'sent' | 'failed' = 'failed';
            let sendErrorFallback: string | undefined;

            try {
                const templateComponents: ITemplateComponent[] = [{
                    type: 'body',
                    parameters: [{
                        type: 'text',
                        text: finalDefaultMessageToSend.replace(/\n/g, ' ')
                    }]
                }];

                whatsappMessageIdFallback = await sendTemplateMessage(userPhoneForRadar, PROACTIVE_ALERT_TEMPLATE_NAME, templateComponents);
                sendStatusFallback = 'sent';
                logger.info(`${handlerTAG} Mensagem de fallback (template) enviada. WhatsAppMsgID: ${whatsappMessageIdFallback}`);
            } catch (sendError: any) {
                logger.error(`${handlerTAG} FALHA AO ENVIAR mensagem de fallback (template). Erro:`, sendError);
                sendErrorFallback = (sendError.message || String(sendError)).substring(0, 200);
            }
            
            let updatedFallbackHistory = dialogueStateForRadar.fallbackInsightsHistory || [];
            if (fallbackInsightType) { 
                updatedFallbackHistory.push({ type: fallbackInsightType, timestamp: Date.now() });
                const HISTORY_RETENTION_DAYS = 30; 
                const cutoffTimestamp = Date.now() - (HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
                updatedFallbackHistory = updatedFallbackHistory.filter((entry: IFallbackInsightHistoryEntry) => entry.timestamp >= cutoffTimestamp);
            }

            const lastResponseContext = await extractContextFromRadarResponse(finalDefaultMessageToSend, userId);
            const stateToUpdate: Partial<IDialogueState> = {
                lastInteraction: Date.now(),
                lastRadarAlertType: 'no_event_found_today_with_insight',
                lastResponseContext: lastResponseContext,
                fallbackInsightsHistory: updatedFallbackHistory
            };
            await stateService.updateDialogueState(userId, stateToUpdate);

            try {
                const noEventDetails: AlertDetails & { whatsappMessageId?: string; sendStatus?: string; sendError?: string; inspirationId?: string } = {
                    reason: 'Nenhum evento de regra detectado, insight de fallback fornecido.',
                    fallbackInsightProvided: fallbackInsightText || 'Fallback genérico de engajamento.',
                    fallbackInsightType: fallbackInsightType || 'none',
                    whatsappMessageId: whatsappMessageIdFallback,
                    sendStatus: sendStatusFallback,
                    sendError: sendErrorFallback,
                    inspirationId: inspiration.inspirationId
                };

                await dataService.addAlertToHistory(userId, {
                    type: 'no_event_found_today_with_insight',
                    date: today,
                    messageForAI: messageForAI, // Usamos a mensagem que foi para a IA
                    finalUserMessage: finalDefaultMessageToSend,
                    details: noEventDetails,
                    userInteraction: { type: 'not_applicable', interactedAt: today }
                });
                logger.info(`${handlerTAG} Alerta 'no_event_found_today_with_insight' (status: ${sendStatusFallback}) registrado no histórico.`);
            } catch (historyError) {
                logger.error(`${handlerTAG} Falha ao registrar 'no_event_found_today_with_insight' no histórico:`, historyError);
            }
            return NextResponse.json({ success: true, message: "No rule event, fallback insight message sent via template." }, { status: 200 });
        }

        // --- Bloco de Alerta (Evento detectado) ---
        logger.info(`${handlerTAG} Alerta tipo '${detectedEvent.type}' detectado. Gerando mensagem...`);
        
        const alertInputForAI = detectedEvent.messageForAI;
        const currentDialogueStateForAI = await stateService.getDialogueState(userId);
        
        const enrichedContextForAI: EnrichedAIContext = {
            user: userForRadar,
            historyMessages: [], 
            dialogueState: currentDialogueStateForAI,
            userName: userFirstNameForRadar,
            currentAlertDetails: detectedEvent.detailsForLog 
        };

        const { stream } = await askLLMWithEnrichedContext(
            enrichedContextForAI,
            alertInputForAI,
            'generate_proactive_alert'
        );

        let finalAIResponse = "";
        const reader = stream.getReader();
        let streamReadTimeout: NodeJS.Timeout | null = setTimeout(() => {
            logger.warn(`${handlerTAG} Timeout (${DEFAULT_RADAR_STREAM_READ_TIMEOUT_MS}ms) lendo stream da IA.`);
            if (reader && streamReadTimeout) {
                 reader.cancel().catch(e => logger.error(`${handlerTAG} Erro ao cancelar reader no timeout:`, e));
            }
            streamReadTimeout = null;
        }, DEFAULT_RADAR_STREAM_READ_TIMEOUT_MS);

        try {
            while (true) {
                const result = await reader.read();
                if (streamReadTimeout === null && !result.done) {
                    logger.warn(`${handlerTAG} Leitura do stream após timeout. Interrompendo.`);
                    if (!reader.closed) {
                        reader.cancel().catch(e => logger.error(`${handlerTAG} Erro ao cancelar reader pós-timeout:`, e));
                    }
                    break;
                }
                if (result.done) break;
                const chunk: unknown = result.value;
                if (typeof chunk === 'string') {
                    finalAIResponse += chunk;
                } else if (chunk instanceof Uint8Array) {
                    finalAIResponse += new TextDecoder().decode(chunk);
                } else if (chunk !== undefined) {
                    logger.warn(`${handlerTAG} Stream da IA retornou chunk de tipo inesperado: ${typeof chunk}`);
                }
            }
        } catch (readError) {
            if (!(readError instanceof Error && readError.name === 'AbortError' && streamReadTimeout === null)) {
                 logger.error(`${handlerTAG} Erro ao ler stream da IA:`, readError);
            } else {
                logger.info(`${handlerTAG} Leitura do stream cancelada por timeout.`);
            }
        } finally {
            if (streamReadTimeout) {
                clearTimeout(streamReadTimeout);
                streamReadTimeout = null;
            }
        }

        if (!finalAIResponse.trim()) {
            finalAIResponse = 'Que tal explorarmos isso juntos?';
        }

        // <<< INÍCIO DA ATUALIZAÇÃO >>>
        // A IA agora gera a mensagem completa. 'finalAIResponse' é a nossa mensagem base.
        let fullAlertMessageToUser = finalAIResponse.trim();

        // Como fallback, se a IA não gerar uma pergunta, adicionamos uma.
        if (!fullAlertMessageToUser.endsWith('?')) {
            const instigatingQuestionForAlert = await generateInstigatingQuestionForDefaultMessage(
                fullAlertMessageToUser,
                currentDialogueStateForAI, 
                userId,
                userFirstNameForRadar
            );
            if (instigatingQuestionForAlert) {
                fullAlertMessageToUser += `\n\n${instigatingQuestionForAlert}`;
            }
        }
        // <<< FIM DA ATUALIZAÇÃO >>>

        const details = detectedEvent.detailsForLog;
        const inspirationFilters = await buildInspirationFilters(userId, details);
        const inspiration = await fetchInspirationSnippet(userId, inspirationFilters, userForRadar!);
        fullAlertMessageToUser += inspiration.text;

        fullAlertMessageToUser = appendInstagramLinkIfMissing(fullAlertMessageToUser, detectedEvent.detailsForLog);

        let alertEntryDetails: AlertDetails & { whatsappMessageId?: string; sendStatus?: string; sendError?: string; inspirationId?: string } = { ...detectedEvent.detailsForLog, inspirationId: inspiration.inspirationId };

        try {
            const templateComponents: ITemplateComponent[] = [{
                type: 'body',
                parameters: [{
                    type: 'text',
                    text: fullAlertMessageToUser.replace(/\n/g, ' ')
                }]
            }];

            const wamid = await sendTemplateMessage(userPhoneForRadar, PROACTIVE_ALERT_TEMPLATE_NAME, templateComponents);
            logger.info(`${handlerTAG} Alerta do Radar (template) enviado. WhatsAppMsgID: ${wamid}`);
            alertEntryDetails.whatsappMessageId = wamid;
            alertEntryDetails.sendStatus = 'sent';
        } catch (sendError: any) {
            logger.error(`${handlerTAG} FALHA AO ENVIAR alerta do Radar (template). Erro:`, sendError);
            alertEntryDetails.sendStatus = 'failed';
            alertEntryDetails.sendError = (sendError.message || String(sendError)).substring(0, 200);
        }

        try {
            const newAlertEntry: IAlertHistoryEntry = {
                type: detectedEvent.type,
                date: today,
                messageForAI: alertInputForAI,
                finalUserMessage: fullAlertMessageToUser,
                details: alertEntryDetails, 
                userInteraction: { type: 'pending_interaction', interactedAt: today }
            };
            await dataService.addAlertToHistory(userId, newAlertEntry);
        } catch (historySaveError) {
            logger.error(`${handlerTAG} Falha ao salvar alerta tipo '${detectedEvent.type}' no histórico:`, historySaveError);
        }

        const lastResponseContextForAlert = await extractContextFromRadarResponse(fullAlertMessageToUser, userId);
        await stateService.updateDialogueState(userId, {
            lastInteraction: Date.now(),
            lastResponseContext: lastResponseContextForAlert,
            lastRadarAlertType: detectedEvent.type, 
            fallbackInsightsHistory: currentDialogueStateForAI.fallbackInsightsHistory 
        });

        return NextResponse.json({ success: true, message: `Radar alert '${detectedEvent.type}' processed via template.` }, { status: 200 });

    } catch (error) {
        logger.error(`${handlerTAG} Erro GERAL ao processar Radar Mobi para User ${userId}:`, error);

        if (userPhoneForRadar) {
            try {
                const templateComponents: ITemplateComponent[] = [];
                const wamid = await sendTemplateMessage(userPhoneForRadar, GENERIC_ERROR_TEMPLATE_NAME, templateComponents);
                logger.info(`${handlerTAG} Mensagem de erro (template estático) enviada. WhatsAppMsgID: ${wamid}`);
            } catch (e: any) {
                logger.error(`${handlerTAG} Falha CRÍTICA ao enviar mensagem de erro (template) para UserID: ${userId}:`, e);
            }
        }
        if (userId) { 
            const currentDialogueStateOnError = await stateService.getDialogueState(userId).catch(() => null); 
            await stateService.updateDialogueState(userId, {
                lastRadarAlertType: 'error_processing_radar',
                lastInteraction: Date.now(),
                lastResponseContext: null,
                fallbackInsightsHistory: currentDialogueStateOnError?.fallbackInsightsHistory || [] 
            }).catch(stateErr => logger.error(`${handlerTAG} Falha ao atualizar estado após erro geral do Radar Mobi:`, stateErr));
        }

        return NextResponse.json({ error: `Failed to process Radar Mobi: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
    }
}