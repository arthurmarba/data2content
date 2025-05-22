// src/app/api/whatsapp/incoming/route.ts - v2.3.2 (Adiciona Logging de Performance para getDialogueState)
// - ADICIONADO: Logging de tempo para a chamada a stateService.getDialogueState.
// - Mantém funcionalidades da v2.3.1.

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/app/lib/helpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { UserNotFoundError } from '@/app/lib/errors';
import { logger } from '@/app/lib/logger';
import { Client as QStashClient } from "@upstash/qstash";
import * as dataService from '@/app/lib/dataService';
import {
    normalizeText,
    determineIntent,
    getRandomGreeting,
    IntentResult,
    DeterminedIntent,
    isSimpleConfirmationOrAcknowledgement
} from '@/app/lib/intentService';
import { IUser } from '@/app/models/User';
import User from '@/app/models/User';
import * as stateService from '@/app/lib/stateService';

// Validações de ambiente
if (!process.env.QSTASH_TOKEN) {
    logger.error("[whatsapp/incoming] Variável de ambiente QSTASH_TOKEN não definida!");
}
if (!process.env.APP_BASE_URL && !process.env.NEXT_PUBLIC_APP_URL) {
    logger.warn("[whatsapp/incoming] Variável de ambiente APP_BASE_URL ou NEXT_PUBLIC_APP_URL não definida! Usando fallback.");
}

const qstashClient = process.env.QSTASH_TOKEN ? new QStashClient({ token: process.env.QSTASH_TOKEN }) : null;

/**
 * GET /api/whatsapp/incoming
 * Webhook verification for WhatsApp/Facebook.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    logger.error('[whatsapp/incoming GET v2.3.2] Error: WHATSAPP_VERIFY_TOKEN não está definido no .env');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (
    searchParams.get('hub.mode') === 'subscribe' &&
    searchParams.get('hub.verify_token') === verifyToken
  ) {
    logger.debug('[whatsapp/incoming GET v2.3.2] Verification succeeded.');
    return new Response(searchParams.get('hub.challenge') || '', { status: 200 });
  }

  logger.error('[whatsapp/incoming GET v2.3.2] Verification failed:', {
    mode: searchParams.get('hub.mode'),
    token_received: searchParams.get('hub.verify_token') ? '******' : 'NONE',
    expected_defined: !!verifyToken,
  });
  return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 });
}

/**
 * Extracts the sender phone and message text from the webhook payload.
 */
function getSenderAndMessage(body: any): { from: string; text: string } | null {
    try {
        if (!body || !Array.isArray(body.entry) || body.entry.length === 0) return null;
        for (const entry of body.entry) {
            if (!Array.isArray(entry.changes) || entry.changes.length === 0) continue;
            for (const change of entry.changes) {
                if (change.field === 'messages' && change.value?.messages?.length > 0) {
                    const message = change.value.messages[0];
                    if (message.type === 'text' && message.from && message.text?.body) {
                        return { from: message.from, text: message.text.body };
                    }
                }
            }
        }
    } catch (error) {
        logger.error('[whatsapp/incoming getSenderAndMessage v2.3.2] Erro ao parsear payload:', error);
    }
    return null;
}

function extractExcerpt(text: string, maxLength: number = 30): string {
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * POST /api/whatsapp/incoming
 * Receives message, handles verification codes OR publishes task to QStash, returns immediate 200 OK.
 */
export async function POST(request: NextRequest) {
  const postTag = '[whatsapp/incoming POST v2.3.2 InterruptionLogic]';
  let body: any;

  try {
    body = await request.json();
  } catch (error) {
    logger.error(`${postTag} Erro ao parsear JSON:`, error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const senderAndMsg = getSenderAndMessage(body);
  const isStatusUpdate =
    !senderAndMsg &&
    Array.isArray(body?.entry) &&
    body.entry.some((e: any) =>
      Array.isArray(e.changes) &&
      e.changes.some((c: any) => c.field === 'messages' && Array.isArray(c.value?.statuses))
    );

  if (!senderAndMsg && !isStatusUpdate) {
    logger.warn(`${postTag} Payload não contém mensagem de texto válida ou status conhecido.`);
    return NextResponse.json({ received_but_not_processed: true }, { status: 200 });
  }

  if (isStatusUpdate) {
    logger.debug(`${postTag} Atualização de status recebida, confirmando e ignorando.`);
    return NextResponse.json({ received_status_update: true }, { status: 200 });
  }

  if (!senderAndMsg) {
      logger.error(`${postTag} Erro crítico: senderAndMsg é null após validações.`);
      return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }

  const fromPhone = normalizePhoneNumber(senderAndMsg.from);
  const rawText_MsgNova = senderAndMsg.text.trim();
  const normText_MsgNova = normalizeText(rawText_MsgNova);
  logger.info(`${postTag} Mensagem Nova (MsgNova) recebida de: ${fromPhone}, Texto: "${rawText_MsgNova.slice(0, 50)}..."`);

  const codeMatch = rawText_MsgNova.match(/\b([A-Z0-9]{6})\b/);
  if (codeMatch && codeMatch[1]) {
    const verificationCode = codeMatch[1];
    const verifyTag = '[whatsapp/incoming][Verification v2.3.2]';
    logger.info(`${verifyTag} Código de verificação detectado: ${verificationCode} de ${fromPhone}`);
    try {
        await connectToDatabase();
        logger.debug(`${verifyTag} Buscando usuário com código: ${verificationCode}`);
        const userWithCode = await User.findOne({ whatsappVerificationCode: verificationCode });
        if (userWithCode) {
            logger.info(`${verifyTag} Usuário ${userWithCode._id} encontrado para o código ${verificationCode}.`);
            let reply = '';
            if (userWithCode.planStatus === 'active') {
                logger.debug(`${verifyTag} Plano ativo. Vinculando número ${fromPhone} ao usuário ${userWithCode._id}`);
                userWithCode.whatsappPhone = fromPhone;
                userWithCode.whatsappVerificationCode = null;
                userWithCode.whatsappVerified = true;
                await userWithCode.save();
                const userFirstNameForReply = userWithCode.name ? userWithCode.name.split(' ')[0] : '';
                reply = `Olá ${userFirstNameForReply}! Seu número de WhatsApp (${fromPhone}) foi vinculado com sucesso à sua conta.`;
                logger.info(`${verifyTag} Número ${fromPhone} vinculado com sucesso ao usuário ${userWithCode._id}.`);
            } else {
                const userFirstNameForReply = userWithCode.name ? userWithCode.name.split(' ')[0] : '';
                reply = `Olá ${userFirstNameForReply}. Encontramos seu código, mas seu plano (${userWithCode.planStatus}) não está ativo. Ative seu plano para vincular o WhatsApp.`;
                logger.warn(`${verifyTag} Usuário ${userWithCode._id} tentou vincular com plano ${userWithCode.planStatus}.`);
            }
            await sendWhatsAppMessage(fromPhone, reply);
            logger.debug(`${verifyTag} Resposta de verificação enviada para ${fromPhone}.`);
        } else {
            logger.warn(`${verifyTag} Nenhum usuário encontrado para o código de verificação: ${verificationCode}`);
            await sendWhatsAppMessage(fromPhone, 'Código inválido ou expirado. Verifique o código no seu perfil ou gere um novo.');
        }
        return NextResponse.json({ verification_attempted: true, user_found: !!userWithCode }, { status: 200 });
    } catch (error) {
        logger.error(`${verifyTag} Erro ao processar código de verificação ${verificationCode}:`, error);
        try { await sendWhatsAppMessage(fromPhone, "Ocorreu um erro ao tentar verificar seu código. Tente novamente mais tarde."); } catch (e) {}
        return NextResponse.json({ error: 'Failed to process verification code' }, { status: 500 });
    }
  }

  logger.debug(`${postTag} Mensagem não é código de verificação. Prosseguindo para fluxo normal/QStash.`);

  let user: IUser;
  let uid: string;
  let userFirstName: string;

  try {
      await connectToDatabase();
      user = await dataService.lookupUser(fromPhone);
      uid = user._id.toString();
      const fullName = user.name || 'criador';
      userFirstName = fullName.split(' ')[0]!;
      logger.info(`${postTag} Usuário ${uid} (Nome: ${userFirstName}) encontrado para ${fromPhone}.`);

  } catch (e) {
      logger.error(`${postTag} Erro em lookupUser para ${fromPhone}:`, e);
      if (e instanceof UserNotFoundError) {
          try {
              await sendWhatsAppMessage(fromPhone, 'Olá! Não encontrei uma conta associada a este número de WhatsApp. Se você já se registou (ex: com Google), por favor, acesse a plataforma e use a opção "Vincular WhatsApp" no seu perfil.');
          } catch (sendError) {
              logger.error(`${postTag} Falha ao enviar mensagem de usuário não encontrado/vinculado:`, sendError);
          }
          return NextResponse.json({ user_not_found_message_sent: true }, { status: 200 });
      }
      return NextResponse.json({ error: 'Failed to lookup user' }, { status: 500 });
  }

  let currentDialogueState: stateService.IDialogueState = {};
  try {
      const getDialogueStateStartTime = Date.now(); // Medir tempo
      currentDialogueState = await stateService.getDialogueState(uid);
      const getDialogueStateDuration = Date.now() - getDialogueStateStartTime;
      logger.debug(`${postTag} stateService.getDialogueState para User ${uid} levou ${getDialogueStateDuration}ms.`);
  } catch (stateError) {
      logger.error(`${postTag} Erro ao buscar estado do Redis para ${uid} (não fatal, usará estado padrão):`, stateError);
      currentDialogueState = stateService.getDefaultDialogueState();
  }

  if (currentDialogueState.currentProcessingMessageId) {
      logger.info(`${postTag} User ${uid}: MsgNova ("${rawText_MsgNova.slice(0,30)}...") chegou durante processamento de MsgAntiga (${currentDialogueState.currentProcessingMessageId}, excerto: "${currentDialogueState.currentProcessingQueryExcerpt || 'N/A'}").`);
      
      const isConfirmation = isSimpleConfirmationOrAcknowledgement(normText_MsgNova);

      if (isConfirmation) {
          logger.info(`${postTag} User ${uid}: MsgNova é uma confirmação simples. Não interrompendo MsgAntiga.`);
          const ackMsgAdapted = `Entendido, ${userFirstName}! Continuo trabalhando no seu pedido anterior sobre "${currentDialogueState.currentProcessingQueryExcerpt || 'o assunto anterior'}". 👍`;
          try {
              await sendWhatsAppMessage(fromPhone, ackMsgAdapted);
              logger.debug(`${postTag} Ack Estático Adaptado enviado para ${fromPhone}.`);
          } catch (sendError) {
              logger.error(`${postTag} Falha ao enviar Ack Estático Adaptado:`, sendError);
          }
      } else {
          logger.info(`${postTag} User ${uid}: MsgNova NÃO é confirmação. Sinalizando interrupção para MsgAntiga: ${currentDialogueState.currentProcessingMessageId}.`);
          const queryExcerpt_MsgNova = extractExcerpt(rawText_MsgNova);
          const ackMsgStandard = `Recebi sua nova mensagem sobre "${queryExcerpt_MsgNova}", ${userFirstName}! Só um instante enquanto concluo o raciocínio anterior sobre "${currentDialogueState.currentProcessingQueryExcerpt || 'o assunto anterior'}".`;
          
          try {
              await sendWhatsAppMessage(fromPhone, ackMsgStandard);
              logger.debug(`${postTag} Ack Estático Padrão enviado para ${fromPhone}.`);
          } catch (sendError) {
              logger.error(`${postTag} Falha ao enviar Ack Estático Padrão:`, sendError);
          }
          const stateUpdateForInterrupt: Partial<stateService.IDialogueState> = {
              interruptSignalForMessageId: currentDialogueState.currentProcessingMessageId
          };
          // Medir tempo para updateDialogueState
          const updateStateStartTime = Date.now();
          await stateService.updateDialogueState(uid, stateUpdateForInterrupt);
          logger.debug(`${postTag} stateService.updateDialogueState (interrupt) para User ${uid} levou ${Date.now() - updateStateStartTime}ms.`);
          logger.info(`${postTag} User ${uid}: interruptSignalForMessageId definido para ${currentDialogueState.currentProcessingMessageId}.`);
          
          // Recarregar o estado para que a próxima lógica (determineIntent) o veja
          const getDialogueStateAfterInterruptStartTime = Date.now();
          currentDialogueState = await stateService.getDialogueState(uid);
          logger.debug(`${postTag} stateService.getDialogueState (após interrupt) para User ${uid} levou ${Date.now() - getDialogueStateAfterInterruptStartTime}ms.`);
      }
  }

  const greeting = getRandomGreeting(userFirstName);
  let intentResult: IntentResult;
  let determinedIntent: DeterminedIntent | null = null;

  try {
      const determineIntentStartTime = Date.now(); // Medir tempo
      intentResult = await determineIntent(normText_MsgNova, user, rawText_MsgNova, currentDialogueState, greeting, uid);
      logger.debug(`${postTag} determineIntent para User ${uid} levou ${Date.now() - determineIntentStartTime}ms.`);

      if (intentResult.type === 'special_handled') {
          logger.info(`${postTag} Intenção da MsgNova tratada como caso especial para ${uid}: ${intentResult.response.slice(0, 50)}...`);
          await sendWhatsAppMessage(fromPhone, intentResult.response);
          
          const stateUpdateAfterSpecial: Partial<stateService.IDialogueState> = { lastInteraction: Date.now() };
          if (currentDialogueState.lastAIQuestionType) {
            stateUpdateAfterSpecial.lastAIQuestionType = undefined;
            stateUpdateAfterSpecial.pendingActionContext = undefined;
          }
          await stateService.updateDialogueState(uid, stateUpdateAfterSpecial);
          return NextResponse.json({ special_handled: true }, { status: 200 });
      } else {
          determinedIntent = intentResult.intent;
          if (currentDialogueState.lastAIQuestionType &&
              determinedIntent !== 'user_confirms_pending_action' &&
              determinedIntent !== 'user_denies_pending_action') {
              logger.info(`${postTag} User ${uid} enviou MsgNova ("${determinedIntent}") enquanto havia ação pendente (${currentDialogueState.lastAIQuestionType}). Limpando estado pendente.`);
              await stateService.clearPendingActionState(uid);
          }
          logger.info(`${postTag} Intenção determinada para MsgNova de ${uid} (com contexto): ${determinedIntent}`);
      }
  } catch (intentError) {
      logger.error(`${postTag} Erro ao determinar intenção para MsgNova de ${uid}:`, intentError);
      determinedIntent = 'general';
      if (currentDialogueState.lastAIQuestionType) {
        logger.warn(`${postTag} Erro na determinação de intenção, mas havia ação pendente. Limpando estado pendente para ${uid}.`);
        await stateService.clearPendingActionState(uid);
      }
  }

  if (!qstashClient) {
      logger.error(`${postTag} Cliente QStash não inicializado. Não é possível enfileirar tarefa para User ${uid}.`);
      return NextResponse.json({ error: 'QStash client not configured' }, { status: 500 });
  }
  const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appBaseUrl) {
      logger.error(`${postTag} URL base da aplicação não configurada. Não é possível enfileirar tarefa para User ${uid}.`);
      return NextResponse.json({ error: 'App base URL not configured' }, { status: 500 });
  }
  const workerUrl = `${appBaseUrl}/api/whatsapp/process-response`;
  const qstashPayload = {
      fromPhone: fromPhone,
      incomingText: rawText_MsgNova,
      userId: uid,
      determinedIntent: determinedIntent,
  };

  try {
      logger.info(`${postTag} Publicando tarefa no QStash para ${workerUrl} com payload para User ${uid} (MsgNova). Payload: ${JSON.stringify(qstashPayload)}`);
      const publishResponse = await qstashClient.publishJSON({
          url: workerUrl,
          body: qstashPayload,
      });
      logger.info(`${postTag} Tarefa para MsgNova publicada no QStash com sucesso. QStash Message ID: ${publishResponse.messageId}`);
  } catch (qstashError) {
      logger.error(`${postTag} Falha ao publicar tarefa no QStash para User ${uid} (MsgNova):`, qstashError);
      return NextResponse.json({ error: 'Failed to queue task' }, { status: 500 });
  }

  logger.debug(`${postTag} Retornando 200 OK para Meta após enfileirar MsgNova.`);
  return NextResponse.json({ received_message: true, task_queued: true }, { status: 200 });
}
