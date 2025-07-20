// src/app/api/whatsapp/process-response/dailyTipHandler.ts
// Versão: v1.6.0
// - Adiciona seleção automática de inspirações da comunidade com base nos detalhes do alerta ou
//   no último formato usado em caso de fallback.
// - Mantém verificações de segurança para os campos recebidos.

import { NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { sendTemplateMessage, ITemplateComponent, sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import type { IDialogueState, ILastResponseContext, IFallbackInsightHistoryEntry } from '@/app/lib/stateService'; 
import * as dataService from '@/app/lib/dataService';
import type { IEnrichedReport, IAccountInsight, CommunityInspirationFilters } from '@/app/lib/dataService';
import { IUser, IAlertHistoryEntry, AlertDetails } from '@/app/models/User'; 

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

const HANDLER_TAG_BASE = '[DailyTipHandler v1.5.6]'; // Tag da versão atualizada

const PROACTIVE_ALERT_TEMPLATE_NAME = process.env.PROACTIVE_ALERT_TEMPLATE_NAME;
const GENERIC_ERROR_TEMPLATE_NAME = process.env.GENERIC_ERROR_TEMPLATE_NAME;

function getFirstSentence(text: string): string {
    const match = text.trim().match(/^.*?[.!?](\s|$)/);
    return match ? match[0].trim() : text.trim();
}


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
Dada a seguinte resposta de um assistente de IA chamado Tuca, identifique concisamente:
1. O tópico principal da resposta de Tuca (em até 10 palavras).
2. As principais entidades ou termos chave mencionados por Tuca (liste até 3-4 termos).

Resposta de Tuca:
---
${trimmedResponseText.substring(0, 1500)} ${trimmedResponseText.length > 1500 ? "\n[...resposta truncada...]" : ""}
---

Responda SOMENTE em formato JSON com as chaves "topic" (string) e "entities" (array de strings).
Se não for possível determinar um tópico claro ou entidades, retorne um JSON com "topic": null e "entities": [].
JSON:
`;

    try {
        logger.debug(`${TAG} Solicitando extração de contexto para a resposta do Radar Tuca...`);
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
Você é Tuca, um consultor de IA especialista em Instagram, e está enviando uma mensagem proativa diária para ${userName}.
Sua mensagem base para ${userName} foi:
"${baseMessage}"

Para tornar essa mensagem mais engajadora e incentivar ${userName} a interagir, formule UMA pergunta curta (1-2 frases), aberta e instigante (em português brasileiro) que o convide a:
1. Explorar alguma funcionalidade geral do Tuca que ele talvez não conheça.
2. Refletir sobre seus objetivos de conteúdo atuais.
3. Pedir uma análise de dados que não seja um "alerta", mas que possa ser útil (ex: "Como foi o alcance dos seus últimos Reels?", "Quer ver um resumo do seu crescimento de seguidores este mês?").
4. Considerar um tipo de conteúdo ou estratégia que ele pode não ter explorado recentemente.

A pergunta NÃO deve ser uma simples confirmação. Deve genuinamente levar o usuário a pensar e a querer usar o Tuca para investigar mais.
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

async function buildInspirationFilters(
    userId: string,
    details?: { [key: string]: any },
    forFallback: boolean = false
): Promise<CommunityInspirationFilters> {
    const filters: CommunityInspirationFilters = {};

    if (details) {
        if (typeof details.format === 'string') filters.format = details.format;
        if (typeof details.formatName === 'string' && !filters.format) {
            filters.format = details.formatName;
        }
        if (typeof details.proposal === 'string') filters.proposal = details.proposal;
        if (!filters.proposal && typeof details.lastPostProposal === 'string') {
            filters.proposal = details.lastPostProposal as any;
        }
        if (typeof details.context === 'string') filters.context = details.context;
        if (!filters.context && typeof details.lastPostContext === 'string') {
            filters.context = details.lastPostContext as any;
        }
        if (typeof details.tone === 'string') filters.tone = details.tone;
        if (typeof details.reference === 'string') filters.reference = details.reference;
        if (typeof details.isPositiveAlert === 'boolean') {
            if (details.isPositiveAlert) {
                filters.performanceHighlights_Qualitative_INCLUDES_ANY = ['excelente_retencao_em_reels', 'viralizou_nos_compartilhamentos'];
            } else {
                filters.performanceHighlights_Qualitative_INCLUDES_ANY = ['desempenho_padrao', 'baixo_volume_de_dados'];
            }
        }
    }

    if (forFallback && (!filters.format || !filters.proposal || !filters.context)) {
        try {
            const posts = await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, 30);
            if (posts && posts.length > 0) {
                posts.sort((a, b) => {
                    const dA = new Date(a.postDate as any).getTime();
                    const dB = new Date(b.postDate as any).getTime();
                    return dB - dA;
                });
                const lastPost = posts[0];
                if (!filters.format && typeof lastPost?.format === 'string') {
                    filters.format = lastPost.format as any;
                }
                if (!filters.proposal && typeof lastPost?.proposal === 'string') {
                    filters.proposal = lastPost.proposal as any;
                }
                if (!filters.context && typeof lastPost?.context === 'string') {
                    filters.context = lastPost.context as any;
                }
            }
        } catch (e) {
            logger.warn(`[DailyTipHandler] Falha ao inferir formato para inspiração: ${e}`);
        }

        // Complementa com preferências do usuário, se disponíveis
        try {
            const user = await dataService.lookupUserById(userId);
            const prefs = user.userPreferences;
            if (prefs) {
                if (!filters.format && Array.isArray(prefs.preferredFormats) && prefs.preferredFormats.length > 0) {
                    filters.format = prefs.preferredFormats[0] as any;
                }
                if (!filters.tone && typeof prefs.preferredAiTone === 'string') {
                    filters.tone = prefs.preferredAiTone as any;
                }
            }
        } catch (e) {
            logger.warn(`[DailyTipHandler] Falha ao consultar preferências do usuário para inspiração: ${e}`);
        }
    }

    return filters;
}

async function fetchInspirationSnippet(
    userId: string,
    filters: CommunityInspirationFilters,
    userOrExcludeIds?: IUser | string[]
): Promise<{ text: string; inspirationId?: string }> {
    try {
        let excludeIds: string[] = [];
        if (Array.isArray(userOrExcludeIds)) {
            excludeIds = userOrExcludeIds;
        } else if (userOrExcludeIds) {
            const lastShown = userOrExcludeIds.lastCommunityInspirationShown_Daily;
            if (
                lastShown?.date &&
                lastShown.inspirationIds &&
                lastShown.inspirationIds.length > 0
            ) {
                const today = startOfDay(new Date());
                const lastShownDate = startOfDay(new Date(lastShown.date));
                if (today.getTime() === lastShownDate.getTime()) {
                    excludeIds = lastShown.inspirationIds.map(id => id.toString());
                }
            }
        }

        const inspirations = await dataService.getInspirations(filters, 1, excludeIds);
        const insp = inspirations?.[0];
        if (insp) {
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
    console.log("!!!!!!!!!! EXECUTANDO handleDailyTip (v1.5.6) !!!!!!!!!! USER ID:", payload.userId, new Date().toISOString());
    
    const { userId } = payload;
    const handlerTAG = `${HANDLER_TAG_BASE} User ${userId}:`;
    logger.info(`${handlerTAG} Iniciando processamento do Radar Tuca com Templates...`);

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
            
            let baseDefaultMessage = `Olá ${userFirstNameForRadar}, Tuca na área! 👋`;
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
                baseDefaultMessage += ` ${fallbackInsightText}`;
            } else {
                baseDefaultMessage += ` Dei uma olhada geral nos seus dados hoje...`;
            }
            const instigatingQuestion = await generateInstigatingQuestionForDefaultMessage(
                baseDefaultMessage,
                dialogueStateForRadar,
                userId,
                userFirstNameForRadar
            );
            let finalDefaultMessageToSend = baseDefaultMessage;
            if (instigatingQuestion) {
                finalDefaultMessageToSend += `\n\n${instigatingQuestion}`;
            }

            const inspirationFilters = await buildInspirationFilters(userId, undefined, true);
            const inspiration = await fetchInspirationSnippet(userId, inspirationFilters, userForRadar!);
            finalDefaultMessageToSend += inspiration.text;

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
                    messageForAI: baseDefaultMessage, 
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
            finalAIResponse = `Olá ${userFirstNameForRadar}! Radar Tuca aqui com uma observação sobre ${detectedEvent.type}: ${alertInputForAI} Que tal explorarmos isso juntos?`;
        }

        const instigatingQuestionForAlert = await generateInstigatingQuestionForDefaultMessage(
            finalAIResponse,
            currentDialogueStateForAI, 
            userId,
            userFirstNameForRadar
        );

        const shortAIResponse = getFirstSentence(finalAIResponse);
        let fullAlertMessageToUser = `${alertInputForAI}\n\n${shortAIResponse}`;
        if (instigatingQuestionForAlert) {
            fullAlertMessageToUser += `\n\n${instigatingQuestionForAlert}`;
        }

        // CORREÇÃO: Adicionada verificação de tipo para os detalhes do evento
        // antes de tentar acessar propriedades que podem não existir.
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
        logger.error(`${handlerTAG} Erro GERAL ao processar Radar Tuca para User ${userId}:`, error);

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
            }).catch(stateErr => logger.error(`${handlerTAG} Falha ao atualizar estado após erro geral do Radar Tuca:`, stateErr));
        }

        return NextResponse.json({ error: `Failed to process Radar Tuca: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
    }
}
