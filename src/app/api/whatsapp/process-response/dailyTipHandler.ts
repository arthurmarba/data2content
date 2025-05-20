// src/app/api/whatsapp/process-response/dailyTipHandler.ts
import { NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import * as dataService from '@/app/lib/dataService';
import { IUser, IAlertHistoryEntry, AlertDetails } from '@/app/models/User';
import { ProcessRequestBody, DetectedEvent, EnrichedAIContext } from './types';
// Removidas as importações dos detectores individuais de alertDetectionService
// import {
//     detectPeakPerformanceShares,
//     detectUnexpectedDropReelsWatchTime,
//     detectForgottenPromisingFormat,
//     detectUntappedPotentialTopic,
//     detectEngagementPeakNotCapitalized,
// } from './alertDetectionService'; 
import ruleEngineInstance from '@/app/lib/ruleEngine'; // <-- ATUALIZADO: Importa a instância do motor de regras
import { DEFAULT_RADAR_STREAM_READ_TIMEOUT_MS } from '@/app/lib/constants';

const HANDLER_TAG_BASE = '[DailyTipHandler]';

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
        // const userAlertHistory = userForRadar.alertHistory || []; // userAlertHistory é agora buscado dentro do ruleEngineService
        let detectedEvent: DetectedEvent | null = null;

        logger.info(`${handlerTAG} Executando o motor de regras...`);
        
        // --- ATUALIZADO: Lógica de detecção agora usa o Motor de Regras ---
        try {
            detectedEvent = await ruleEngineInstance.runAllRules(userId, dialogueStateForRadar);
        } catch (engineError) {
            logger.error(`${handlerTAG} Erro ao executar o motor de regras:`, engineError);
            // Decidir se deve enviar uma mensagem de erro ao usuário ou apenas logar.
            // Por enquanto, o fluxo de erro geral abaixo tratará disso.
            throw engineError; // Relança para ser pego pelo catch geral
        }
        // --- FIM DA ATUALIZAÇÃO ---


        if (!detectedEvent) {
            logger.info(`${handlerTAG} Nenhum evento notável detectado pelo motor de regras. Enviando mensagem padrão.`);
            const defaultMessage = `Olá ${userFirstNameForRadar}, Tuca na área! Hoje não identifiquei nenhum alerta novo ou insight específico para seu perfil, mas continue de olho nas suas métricas e criando conteúdo incrível! ✨ Amanhã farei uma nova varredura!`;
            
            await sendWhatsAppMessage(userPhoneForRadar, defaultMessage);
            await stateService.updateDialogueState(userId, { lastInteraction: Date.now(), lastRadarAlertType: 'no_event_found_today' });
            
            try {
                const noEventDetails: AlertDetails = { 
                    reason: 'Nenhum evento detectado pelo motor de regras ou todos os tipos aplicáveis já foram enviados recentemente/desabilitados.' 
                }; 

                await dataService.addAlertToHistory(userId, {
                    type: 'no_event_found_today',
                    date: today,
                    messageForAI: defaultMessage, 
                    finalUserMessage: defaultMessage, 
                    details: noEventDetails, 
                    userInteraction: { type: 'not_applicable', interactedAt: today }
                });
                logger.info(`${handlerTAG} Alerta 'no_event_found_today' registrado no histórico.`);
            } catch (historyError) {
                logger.error(`${handlerTAG} Falha ao registrar 'no_event_found_today' no histórico:`, historyError);
            }
            return NextResponse.json({ success: true, message: "No notable event found by rule engine." }, { status: 200 });
        }

        logger.info(`${handlerTAG} Alerta tipo '${detectedEvent.type}' detectado pelo motor de regras. Detalhes: ${JSON.stringify(detectedEvent.detailsForLog)}`);
        
        await stateService.updateDialogueState(userId, { lastRadarAlertType: detectedEvent.type });
        
        const alertInputForAI = detectedEvent.messageForAI;
        logger.debug(`${handlerTAG} Input para IA (messageForAI): "${alertInputForAI}"`);

        const enrichedContextForAI: EnrichedAIContext = {
            user: userForRadar, 
            historyMessages: [], 
            dialogueState: await stateService.getDialogueState(userId), // Pega o estado mais recente
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
            logger.warn(`${handlerTAG} IA não retornou conteúdo. Usando fallback.`);
            finalAIResponse = `Olá ${userFirstNameForRadar}! Radar Tuca aqui com uma observação: ${alertInputForAI} Que tal explorarmos isso juntos?`;
        }
        
        try {
            const newAlertEntry: IAlertHistoryEntry = {
                type: detectedEvent.type,
                date: today,
                messageForAI: alertInputForAI,
                finalUserMessage: finalAIResponse,
                details: detectedEvent.detailsForLog, // Assumindo que detailsForLog já é AlertDetails
                userInteraction: { type: 'pending_interaction', interactedAt: today }
            };
            await dataService.addAlertToHistory(userId, newAlertEntry);
            logger.info(`${handlerTAG} Alerta tipo '${detectedEvent.type}' com mensagem final registrado no histórico.`);
        } catch (historySaveError) {
            logger.error(`${handlerTAG} Falha ao salvar alerta tipo '${detectedEvent.type}' com mensagem final no histórico:`, historySaveError);
        }

        await sendWhatsAppMessage(userPhoneForRadar, finalAIResponse);
        logger.info(`${handlerTAG} Alerta do Radar Tuca enviado para ${userPhoneForRadar}: "${finalAIResponse.substring(0, 100)}..."`);

        await stateService.updateDialogueState(userId, { lastInteraction: Date.now() });

        return NextResponse.json({ success: true, message: `Radar Tuca alert '${detectedEvent.type}' processed by rule engine.` }, { status: 200 });

    } catch (error) {
        logger.error(`${handlerTAG} Erro GERAL ao processar Radar Tuca para User ${userId}:`, error);
        
        if (userPhoneForRadar && userForRadar) { 
            try {
                await sendWhatsAppMessage(userPhoneForRadar, "Desculpe, não consegui gerar seu alerta diário do Radar Tuca hoje devido a um erro interno. Mas estou aqui se precisar de outras análises! 👍");
            } catch (e) {
                logger.error(`${handlerTAG} Falha ao enviar mensagem de erro do Radar Tuca para User ${userId}:`, e);
            }
        }
        // Não precisa mais buscar userAlertHistory aqui, pois é tratado no motor de regras
        if (userId) { 
            await stateService.updateDialogueState(userId, { lastRadarAlertType: 'error_processing_radar', lastInteraction: Date.now() });
        }
        
        return NextResponse.json({ error: `Failed to process Radar Tuca: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
    }
}
