// src/app/api/whatsapp/incoming/route.ts - v2.3 (Lógica de Interrupção e Ack Estático)
// - ADICIONADO: Lógica para verificar se uma mensagem anterior está em processamento.
// - ADICIONADO: Envio de "Ack Estático" para o usuário se uma nova mensagem chegar durante o processamento de outra.
// - ADICIONADO: Definição de `interruptSignalForMessageId` no IDialogueState.
// - ADICIONADO: Placeholder para `isSimpleConfirmationOrAcknowledgement` (a ser movido/refinado no intentService).
// - Mantém funcionalidades da v2.2 (Remoção do Ack Estático original desta rota).

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/app/lib/helpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { UserNotFoundError } from '@/app/lib/errors';
import { logger } from '@/app/lib/logger';
import { Client as QStashClient } from "@upstash/qstash";
import * as dataService from '@/app/lib/dataService';
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from '@/app/lib/intentService';
import { IUser } from '@/app/models/User';
import User from '@/app/models/User';
import * as stateService from '@/app/lib/stateService'; // Deve ser v1.9.3 ou superior

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
    logger.error('[whatsapp/incoming GET v2.3] Error: WHATSAPP_VERIFY_TOKEN não está definido no .env');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (
    searchParams.get('hub.mode') === 'subscribe' &&
    searchParams.get('hub.verify_token') === verifyToken
  ) {
    logger.debug('[whatsapp/incoming GET v2.3] Verification succeeded.');
    return new Response(searchParams.get('hub.challenge') || '', { status: 200 });
  }

  logger.error('[whatsapp/incoming GET v2.3] Verification failed:', {
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
        logger.error('[whatsapp/incoming getSenderAndMessage v2.3] Erro ao parsear payload:', error);
    }
    return null;
}

// Placeholder - Esta função deve ser movida e refinada em @/app/lib/intentService.ts (Fase 4)
function isSimpleConfirmationOrAcknowledgement(normalizedText: string): boolean {
    const TAG = '[whatsapp/incoming isSimpleConfirmationPlaceholder v2.3]';
    const confirmationKeywords = new Set([
        'ok', 'okay', 'sim', 's', 'entendi', 'entendido', 'certo', 'combinado',
        'aguardando', 'esperando', 'valeu', 'obrigado', 'obrigada', 'grato', 'grata',
        'de nada', 'disponha', '👍', '👌', 'blz', 'beleza', 'show', 'perfeito', 'justo', 'pode crer',
        'recebido', 'anotado'
    ]);
    const words = normalizedText.split(/\s+/);
    if (words.length > 5) { // Um pouco mais flexível que o planejado originalmente (4)
        logger.debug(`${TAG} Texto "${normalizedText}" tem mais de 5 palavras, não é confirmação simples.`);
        return false;
    }
    // Verifica se a maioria das palavras (ou todas as palavras significativas) são de confirmação
    const significantWords = words.filter(w => w.length > 1); // Ignora palavras muito curtas
    if (significantWords.length === 0 && words.length > 0) { // Ex: apenas "ok"
        return confirmationKeywords.has(words[0]!);
    }
    const isConfirm = significantWords.every(word => confirmationKeywords.has(word));
    logger.debug(`${TAG} Texto "${normalizedText}" é confirmação simples? ${isConfirm}`);
    return isConfirm;
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
 * ADICIONADO v2.3: Lógica para lidar com mensagens intercaladas, enviando Ack Estático e sinalizando interrupção.
 */
export async function POST(request: NextRequest) {
  const postTag = '[whatsapp/incoming POST v2.3 InterruptionLogic]';
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
  const rawText_MsgNova = senderAndMsg.text.trim(); // Mensagem Nova
  const normText_MsgNova = normalizeText(rawText_MsgNova);
  logger.info(`${postTag} Mensagem Nova (MsgNova) recebida de: ${fromPhone}, Texto: "${rawText_MsgNova.slice(0, 50)}..."`);

  const codeMatch = rawText_MsgNova.match(/\b([A-Z0-9]{6})\b/);
  if (codeMatch && codeMatch[1]) {
    // ... (lógica de verificação de código existente, sem alterações necessárias aqui para a interrupção)
    const verificationCode = codeMatch[1];
    const verifyTag = '[whatsapp/incoming][Verification v2.3]';
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
  let userFirstName: string; // Usaremos o primeiro nome consistentemente

  try {
      await connectToDatabase();
      user = await dataService.lookupUser(fromPhone);
      uid = user._id.toString();
      const fullName = user.name || 'criador';
      userFirstName = fullName.split(' ')[0]!; // Extrai o primeiro nome
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

  // Carregar estado do diálogo para lógica de interrupção e intentService
  let currentDialogueState: stateService.IDialogueState = {};
  try {
      currentDialogueState = await stateService.getDialogueState(uid);
  } catch (stateError) {
      logger.error(`${postTag} Erro ao buscar estado do Redis para ${uid} (não fatal, usará estado padrão):`, stateError);
      currentDialogueState = stateService.getDefaultDialogueState(); // Garante que temos um objeto
  }

  // ***** INÍCIO DA LÓGICA DE INTERRUPÇÃO (Passo 2.3) *****
  if (currentDialogueState.currentProcessingMessageId) {
      logger.info(`${postTag} User ${uid}: MsgNova ("${rawText_MsgNova.slice(0,30)}...") chegou durante processamento de MsgAntiga (${currentDialogueState.currentProcessingMessageId}, excerto: "${currentDialogueState.currentProcessingQueryExcerpt || 'N/A'}").`);
      
      const isConfirmation = isSimpleConfirmationOrAcknowledgement(normText_MsgNova);

      if (isConfirmation) {
          logger.info(`${postTag} User ${uid}: MsgNova é uma confirmação simples. Não interrompendo MsgAntiga.`);
          // Opcional: Enviar Ack Estático Adaptado
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

          // Definir o sinal de interrupção
          const stateUpdateForInterrupt: Partial<stateService.IDialogueState> = {
              interruptSignalForMessageId: currentDialogueState.currentProcessingMessageId
          };
          await stateService.updateDialogueState(uid, stateUpdateForInterrupt);
          logger.info(`${postTag} User ${uid}: interruptSignalForMessageId definido para ${currentDialogueState.currentProcessingMessageId}.`);
          // Recarregar o estado para que a próxima lógica (determineIntent) o veja, se necessário,
          // embora para esta lógica de interrupção, a principal ação já foi feita.
          currentDialogueState = await stateService.getDialogueState(uid);
      }
  }
  // ***** FIM DA LÓGICA DE INTERRUPÇÃO *****

  // Determinar intenção da MsgNova
  const greeting = getRandomGreeting(userFirstName); // greeting agora usa firstName
  let intentResult: IntentResult;
  let determinedIntent: DeterminedIntent | null = null;

  try {
      intentResult = await determineIntent(normText_MsgNova, user, rawText_MsgNova, currentDialogueState, greeting, uid);
      if (intentResult.type === 'special_handled') {
          logger.info(`${postTag} Intenção da MsgNova tratada como caso especial para ${uid}: ${intentResult.response.slice(0, 50)}...`);
          await sendWhatsAppMessage(fromPhone, intentResult.response);
          
          const stateUpdateAfterSpecial: Partial<stateService.IDialogueState> = { lastInteraction: Date.now() };
          // Se a special_handled limpou uma ação pendente, o determineIntent já deve ter feito isso
          // ou o clearPendingActionState pode ser chamado aqui se necessário.
          // Por ora, só atualizamos lastInteraction.
          if (currentDialogueState.lastAIQuestionType) { // Se havia pergunta pendente e foi respondida por special_handled
            stateUpdateAfterSpecial.lastAIQuestionType = undefined;
            stateUpdateAfterSpecial.pendingActionContext = undefined;
          }
          await stateService.updateDialogueState(uid, stateUpdateAfterSpecial);
          return NextResponse.json({ special_handled: true }, { status: 200 });
      } else {
          determinedIntent = intentResult.intent;
          // Se a nova mensagem não é uma confirmação/negação de uma ação pendente, mas havia uma ação pendente,
          // e a nova mensagem não é para interromper, então a ação pendente é limpa.
          if (currentDialogueState.lastAIQuestionType &&
              determinedIntent !== 'user_confirms_pending_action' &&
              determinedIntent !== 'user_denies_pending_action') {
              logger.info(`${postTag} User ${uid} enviou MsgNova ("${determinedIntent}") enquanto havia ação pendente (${currentDialogueState.lastAIQuestionType}). Limpando estado pendente.`);
              await stateService.clearPendingActionState(uid);
              currentDialogueState = await stateService.getDialogueState(uid); // Recarrega estado após limpar
          }
          logger.info(`${postTag} Intenção determinada para MsgNova de ${uid}: ${determinedIntent}`);
      }
  } catch (intentError) {
      logger.error(`${postTag} Erro ao determinar intenção para MsgNova de ${uid}:`, intentError);
      determinedIntent = 'general'; // Fallback
      if (currentDialogueState.lastAIQuestionType) {
        logger.warn(`${postTag} Erro na determinação de intenção, mas havia ação pendente. Limpando estado pendente para ${uid}.`);
        await stateService.clearPendingActionState(uid);
        currentDialogueState = await stateService.getDialogueState(uid); // Recarrega
      }
  }

  // Publicar Tarefa no QStash para MsgNova
  if (!qstashClient) {
      logger.error(`${postTag} Cliente QStash não inicializado. Não é possível enfileirar tarefa para User ${uid}.`);
      // Considerar enviar uma mensagem de erro para o usuário aqui?
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
      determinedIntent: determinedIntent, // Intenção da MsgNova
      // messageId_MsgNova: // Se você gerar um UUID aqui, pode passá-lo. Senão, o worker usará o ID da tarefa QStash.
  };

  try {
      logger.info(`${postTag} Publicando tarefa no QStash para ${workerUrl} com payload para User ${uid} (MsgNova). Payload: ${JSON.stringify(qstashPayload)}`);
      const publishResponse = await qstashClient.publishJSON({
          url: workerUrl,
          body: qstashPayload,
          // Opcional: passar um ID de mensagem customizado se gerado antes
          // headers: { 'Upstash-Message-Id': messageId_MsgNova_custom }
      });
      logger.info(`${postTag} Tarefa para MsgNova publicada no QStash com sucesso. QStash Message ID: ${publishResponse.messageId}`);
  } catch (qstashError) {
      logger.error(`${postTag} Falha ao publicar tarefa no QStash para User ${uid} (MsgNova):`, qstashError);
      // Considerar enviar uma mensagem de erro para o usuário aqui?
      return NextResponse.json({ error: 'Failed to queue task' }, { status: 500 });
  }

  logger.debug(`${postTag} Retornando 200 OK para Meta após enfileirar MsgNova.`);
  return NextResponse.json({ received_message: true, task_queued: true }, { status: 200 });
}
