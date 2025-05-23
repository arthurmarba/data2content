// src/app/api/whatsapp/process-response/dailyTipHandler.ts
// Versão: v1.3.4 (Corrige acesso a s._id.format em extractFallbackInsight)
// Baseado na v1.3.3
import { NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import type { IDialogueState, ILastResponseContext } from '@/app/lib/stateService'; 
import * as dataService from '@/app/lib/dataService'; 
import type { IEnrichedReport, IAccountInsight } from '@/app/lib/dataService'; 
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
    DEFAULT_METRICS_FETCH_DAYS 
} from '@/app/lib/constants';
import { callOpenAIForQuestion } from '@/app/lib/aiService'; 
import { subDays } from 'date-fns'; 

const HANDLER_TAG_BASE = '[DailyTipHandler v1.3.4]'; // Tag de versão atualizada

async function extractContextFromRadarResponse( 
    aiResponseText: string,
    userId: string
): Promise<ILastResponseContext | null> {
    const TAG = `${HANDLER_TAG_BASE}[extractContextFromRadarResponse] User ${userId}:`;
    const trimmedResponseText = aiResponseText.trim(); 
    const wasOriginalResponseAQuestion = trimmedResponseText.endsWith('?');

    if (!trimmedResponseText || trimmedResponseText.length < 10) {
        logger.debug(`${TAG} Resposta da IA muito curta para extração de tópico/entidades, mas registrando se era pergunta.`);
        return { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
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
            return { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
        }

        const jsonMatch = extractionResultText.match(/\{[\s\S]*\}/);
        if (!jsonMatch || !jsonMatch[0]) {
            logger.warn(`${TAG} Nenhum JSON encontrado na resposta da extração de contexto. Resposta: ${extractionResultText}`);
            return { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
        }
        
        const parsedJson = JSON.parse(jsonMatch[0]);

        const context: ILastResponseContext = {
            topic: (parsedJson && typeof parsedJson.topic === 'string') ? parsedJson.topic.trim() : undefined,
            entities: (parsedJson && Array.isArray(parsedJson.entities)) ? parsedJson.entities.map((e: any) => String(e).trim()).filter((e: string) => e) : [],
            timestamp: Date.now(),
            wasQuestion: wasOriginalResponseAQuestion, 
        };

        if (!context.topic && (!context.entities || context.entities.length === 0) && !context.wasQuestion) {
            logger.debug(`${TAG} Extração de contexto não produziu tópico, entidades ou indicativo de pergunta.`);
            return null; 
        }
        
        logger.info(`${TAG} Contexto extraído da resposta do Radar: Topic: "${context.topic}", Entities: [${context.entities?.join(', ')}], WasQuestion: ${context.wasQuestion}`);
        return context;
        
    } catch (error) {
        logger.error(`${TAG} Erro ao extrair contexto da resposta do Radar:`, error);
        return { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
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
 * Tenta extrair um insight simples dos dados do usuário para usar como mensagem padrão.
 * @param user O objeto do usuário.
 * @param enrichedReport O relatório enriquecido do usuário.
 * @param latestAccountInsights Os insights mais recentes da conta do usuário.
 * @returns Uma string com o insight ou null.
 */
async function extractFallbackInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null,
    latestAccountInsights: IAccountInsight | null
): Promise<string | null> {
    const TAG = `${HANDLER_TAG_BASE}[extractFallbackInsight] User ${user._id}:`;
    
    if (!enrichedReport && !latestAccountInsights) {
        logger.info(`${TAG} Sem dados de relatório ou insights da conta para extrair fallback.`);
        return null;
    }

    const daysLookback = DEFAULT_METRICS_FETCH_DAYS || 30;

    // 1. Destaque de crescimento, se positivo
    if (enrichedReport?.historicalComparisons?.followerChangeShortTerm && enrichedReport.historicalComparisons.followerChangeShortTerm > 5) {
        return `Notei que você ganhou ${enrichedReport.historicalComparisons.followerChangeShortTerm} seguidores recentemente. Bom ritmo! 👍`;
    }

    // 2. Melhor dia de postagem com base no engajamento médio
    if (enrichedReport?.performanceByDayPCO) {
        let bestDay = '';
        let maxAvgEngagement = 0;
        let totalPostsOnBestDay = 0;
        for (const [day, data] of Object.entries(enrichedReport.performanceByDayPCO)) {
            if (data.avgEngagement && data.avgEngagement > maxAvgEngagement && data.totalPosts > 1) { 
                maxAvgEngagement = data.avgEngagement;
                bestDay = day;
                totalPostsOnBestDay = data.totalPosts;
            }
        }
        if (bestDay) {
            const dayNames: Record<string, string> = { '0': 'Domingo', '1': 'Segunda-feira', '2': 'Terça-feira', '3': 'Quarta-feira', '4': 'Quinta-feira', '5': 'Sexta-feira', '6': 'Sábado' };
            return `Analisei seus posts dos últimos ${daysLookback} dias e parece que ${dayNames[bestDay] || bestDay} (com ${totalPostsOnBestDay} posts) tem sido um dia com bom engajamento médio para você.`;
        }
    }
    
    // 3. Insight sobre o post de melhor desempenho
    if (enrichedReport?.top3Posts && enrichedReport.top3Posts.length > 0) {
        const topPost = enrichedReport.top3Posts[0];
        if (topPost?.description && topPost.stats) {
            let metricHighlight = '';
            const overallStats = enrichedReport.overallStats;

            if (overallStats && typeof overallStats.totalPosts === 'number' && overallStats.totalPosts > 0) {
                const avgLikes = overallStats.avgLikes || 0; 
                const avgComments = overallStats.avgComments || 0;
                const avgShares = overallStats.avgShares || 0; 

                if (topPost.stats.likes && topPost.stats.likes > avgLikes * 1.2) {
                    metricHighlight = `com ${topPost.stats.likes} curtidas (acima da sua média de ${avgLikes.toFixed(1)})`;
                } else if (topPost.stats.comments && topPost.stats.comments > avgComments * 1.2) {
                    metricHighlight = `com ${topPost.stats.comments} comentários (acima da sua média de ${avgComments.toFixed(1)})`;
                } else if (topPost.stats.shares && topPost.stats.shares > avgShares * 1.2) {
                    metricHighlight = `com ${topPost.stats.shares} compartilhamentos (acima da sua média de ${avgShares.toFixed(1)})`;
                }
            } else if (topPost.stats.likes) { 
                metricHighlight = `com ${topPost.stats.likes} curtidas`;
            }
            
            return `Seu post sobre "${topPost.description.substring(0, 30)}..." ${metricHighlight ? metricHighlight + ' ' : ''}teve um ótimo desempenho recentemente!`;
        }
    }

    // 4. Métricas Gerais de Performance
    if (enrichedReport?.overallStats) {
        const stats = enrichedReport.overallStats;
        if (stats.avgLikes && stats.avgLikes > 0) {
            return `Seus posts tiveram uma média de ${stats.avgLikes.toFixed(0)} curtidas nos últimos ${daysLookback} dias.`;
        }
        if (stats.avgReach && stats.avgReach > 0) {
            return `Em média, seus posts alcançaram ${stats.avgReach.toFixed(0)} pessoas recentemente.`;
        }
    }

    // 5. Formato/Proposta/Contexto Mais Utilizado
    const findMostUsedCategory = (statsArray: Array<{name: string; totalPosts: number}> | undefined) => {
        if (!statsArray || statsArray.length === 0) return null;
        return statsArray.reduce((maxItem: {name: string; totalPosts: number}, currentItem: {name: string; totalPosts: number}) => {
            return currentItem.totalPosts > maxItem.totalPosts ? currentItem : maxItem;
        }, statsArray[0]!);
    };

    // CORRIGIDO: Acessar s._id.format em vez de s.format
    const mostUsedFormat = findMostUsedCategory(enrichedReport?.detailedContentStats?.map(s => ({name: s._id.format, totalPosts: s.totalPosts })));
    if (mostUsedFormat && mostUsedFormat.totalPosts > 2) { 
        return `Notei que você tem usado bastante o formato "${mostUsedFormat.name}".`;
    }
    
    // 6. Contagem Atual de Seguidores
    if (latestAccountInsights?.followersCount && latestAccountInsights.followersCount > 0) {
        if (!(enrichedReport?.historicalComparisons?.followerChangeShortTerm && enrichedReport.historicalComparisons.followerChangeShortTerm > 0)) { 
            return `Você está com ${latestAccountInsights.followersCount} seguidores atualmente.`;
        }
    }
    
    // 7. Total de Posts Recentes
    if (enrichedReport?.overallStats?.totalPosts && enrichedReport.overallStats.totalPosts > 0) {
        return `Você publicou ${enrichedReport.overallStats.totalPosts} posts nos últimos ${daysLookback} dias.`;
    }
            
    logger.info(`${TAG} Nenhum insight específico de fallback extraído dos dados do relatório.`);
    return null; 
}


export async function handleDailyTip(payload: ProcessRequestBody): Promise<NextResponse> {
    const { userId } = payload;
    const handlerTAG = `${HANDLER_TAG_BASE} User ${userId}:`;
    logger.info(`${handlerTAG} Iniciando processamento do Radar Tuca com Motor de Regras...`);

    let userForRadar: IUser | null = null;
    let userPhoneForRadar: string | null | undefined;
    let dialogueStateForRadar: stateService.IDialogueState;

    try {
        userForRadar = await dataService.lookupUserById(userId);

        if (!userForRadar) {
            logger.warn(`${handlerTAG} Usuário com ID ${userId} não encontrado. Interrompendo Radar Tuca.`);
            return NextResponse.json({ success: true, message: "User not found for Radar Tuca." }, { status: 200 });
        }
        
        dialogueStateForRadar = await stateService.getDialogueState(userId);

        userPhoneForRadar = userForRadar.whatsappPhone;
        if (!userPhoneForRadar || !userForRadar.whatsappVerified) {
            logger.warn(`${handlerTAG} Usuário ${userId} sem WhatsApp válido/verificado. Interrompendo Radar Tuca.`);
            return NextResponse.json({ success: true, message: "User has no verified WhatsApp number for Radar Tuca." }, { status: 200 });
        }

        const userNameForRadar = userForRadar.name || 'você';
        const userFirstNameForRadar = userNameForRadar.split(' ')[0]!;
        const today = new Date();
        let detectedEvent: DetectedEvent | null = null;

        logger.info(`${handlerTAG} Executando o motor de regras...`);
        
        try {
            detectedEvent = await ruleEngineInstance.runAllRules(userId, dialogueStateForRadar);
        } catch (engineError) {
            logger.error(`${handlerTAG} Erro ao executar o motor de regras:`, engineError);
            throw engineError; 
        }

        if (!detectedEvent) {
            logger.info(`${handlerTAG} Nenhum evento notável detectado pelo motor de regras. Tentando extrair insight de fallback...`);
            
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

            const fallbackInsight = await extractFallbackInsight(userForRadar, enrichedReportForFallback, latestAccountInsightsForFallback);

            if (fallbackInsight) {
                baseDefaultMessage += ` ${fallbackInsight}`;
            } else {
                baseDefaultMessage += ` Dei uma olhada geral nos seus dados hoje. Para um insight mais personalizado, que tal me perguntar sobre o desempenho dos seus Reels nos últimos 30 dias ou qual foi seu post com mais salvamentos este mês?`;
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
            } else if (!fallbackInsight) { 
                finalDefaultMessageToSend += `\n\nEstou por aqui para ajudar com suas análises e ideias! 😉`;
            }
            
            await sendWhatsAppMessage(userPhoneForRadar, finalDefaultMessageToSend);
            logger.info(`${handlerTAG} Mensagem padrão (com insight e/ou pergunta instigante) enviada.`);

            const lastResponseContext = await extractContextFromRadarResponse(finalDefaultMessageToSend, userId);
            await stateService.updateDialogueState(userId, { 
                lastInteraction: Date.now(), 
                lastRadarAlertType: 'no_event_found_today_with_insight',
                lastResponseContext: lastResponseContext 
            });
            
            try {
                const noEventDetails: AlertDetails = { 
                    reason: 'Nenhum evento de regra detectado, insight de fallback fornecido.',
                    fallbackInsightProvided: fallbackInsight || 'Fallback genérico de engajamento com sugestão de pergunta específica.',
                }; 

                await dataService.addAlertToHistory(userId, {
                    type: 'no_event_found_today_with_insight',
                    date: today,
                    messageForAI: baseDefaultMessage, 
                    finalUserMessage: finalDefaultMessageToSend, 
                    details: noEventDetails, 
                    userInteraction: { type: 'not_applicable', interactedAt: today }
                });
                logger.info(`${handlerTAG} Alerta 'no_event_found_today_with_insight' registrado no histórico.`);
            } catch (historyError) {
                logger.error(`${handlerTAG} Falha ao registrar 'no_event_found_today_with_insight' no histórico:`, historyError);
            }
            return NextResponse.json({ success: true, message: "No rule event, fallback insight message sent." }, { status: 200 });
        }

        logger.info(`${handlerTAG} Alerta tipo '${detectedEvent.type}' detectado pelo motor de regras. Detalhes: ${JSON.stringify(detectedEvent.detailsForLog)}`);
        
        await stateService.updateDialogueState(userId, { lastRadarAlertType: detectedEvent.type });
        
        const alertInputForAI = detectedEvent.messageForAI;
        logger.debug(`${handlerTAG} Input para IA (messageForAI): "${alertInputForAI}"`);

        const currentDialogueStateForAI = await stateService.getDialogueState(userId);
        const enrichedContextForAI: EnrichedAIContext = {
            user: userForRadar, 
            historyMessages: [], 
            dialogueState: currentDialogueStateForAI, 
            userName: userFirstNameForRadar
        };

        logger.info(`${handlerTAG} Solicitando à LLM para gerar mensagem final do alerta.`);
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
            logger.warn(`${handlerTAG} IA não retornou conteúdo para o alerta. Usando fallback.`);
            finalAIResponse = `Olá ${userFirstNameForRadar}! Radar Tuca aqui com uma observação sobre ${detectedEvent.type}: ${alertInputForAI} Que tal explorarmos isso juntos?`;
        }

        const instigatingQuestionForAlert = await generateInstigatingQuestionForDefaultMessage( 
            finalAIResponse, 
            currentDialogueStateForAI, 
            userId,
            userFirstNameForRadar
        );

        let fullAlertMessageToUser = finalAIResponse;
        if (instigatingQuestionForAlert) {
            fullAlertMessageToUser += `\n\n${instigatingQuestionForAlert}`;
        }
        
        try {
            const newAlertEntry: IAlertHistoryEntry = {
                type: detectedEvent.type,
                date: today,
                messageForAI: alertInputForAI,
                finalUserMessage: fullAlertMessageToUser, 
                details: detectedEvent.detailsForLog, 
                userInteraction: { type: 'pending_interaction', interactedAt: today }
            };
            await dataService.addAlertToHistory(userId, newAlertEntry);
            logger.info(`${handlerTAG} Alerta tipo '${detectedEvent.type}' com mensagem final (e pergunta instigante, se houver) registrado no histórico.`);
        } catch (historySaveError) {
            logger.error(`${handlerTAG} Falha ao salvar alerta tipo '${detectedEvent.type}' com mensagem final no histórico:`, historySaveError);
        }

        await sendWhatsAppMessage(userPhoneForRadar, fullAlertMessageToUser);
        logger.info(`${handlerTAG} Alerta do Radar Tuca enviado para ${userPhoneForRadar}: "${fullAlertMessageToUser.substring(0, 100)}..."`);

        const lastResponseContextForAlert = await extractContextFromRadarResponse(fullAlertMessageToUser, userId);
        await stateService.updateDialogueState(userId, { 
            lastInteraction: Date.now(),
            lastResponseContext: lastResponseContextForAlert 
        });

        return NextResponse.json({ success: true, message: `Radar Tuca alert '${detectedEvent.type}' processed by rule engine.` }, { status: 200 });

    } catch (error) {
        logger.error(`${handlerTAG} Erro GERAL ao processar Radar Tuca para User ${userId}:`, error);
        
        if (userPhoneForRadar && userForRadar) { 
            try {
                await sendWhatsAppMessage(userPhoneForRadar, "Desculpe, não consegui gerar seu alerta diário do Radar Tuca hoje devido a um erro interno. Mas estou aqui se precisar de outras análises! 👍");
            } catch (e: any) { 
                logger.error(`${handlerTAG} Falha ao enviar mensagem de erro do Radar Tuca para User ${userId}:`, e);
            }
        }
        if (userId) { 
            await stateService.updateDialogueState(userId, { 
                lastRadarAlertType: 'error_processing_radar', 
                lastInteraction: Date.now(), 
                lastResponseContext: null 
            });
        }
        
        return NextResponse.json({ error: `Failed to process Radar Tuca: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
    }
}
