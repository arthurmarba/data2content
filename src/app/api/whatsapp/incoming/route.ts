// src/app/api/whatsapp/incoming/route.ts - v2.2 (Remove Ack Estático da Rota Incoming)
// - Removida a mensagem de processamento estática que era enviada por esta rota.
// - A responsabilidade pelo envio da mensagem de reconhecimento (agora dinâmica)
//   passa a ser exclusivamente do consultantService.ts (v4.7.6+) no worker QStash.
// - Mantém a lógica de verificação de código e tratamento de erros da v2.1.

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
    logger.error('[whatsapp/incoming] GET Error: WHATSAPP_VERIFY_TOKEN não está definido no .env');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (
    searchParams.get('hub.mode') === 'subscribe' &&
    searchParams.get('hub.verify_token') === verifyToken
  ) {
    logger.debug('[whatsapp/incoming] GET Verification succeeded.');
    return new Response(searchParams.get('hub.challenge') || '', { status: 200 });
  }

  logger.error('[whatsapp/incoming] GET Verification failed:', {
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
        logger.error('[whatsapp/incoming] Erro ao parsear payload em getSenderAndMessage:', error);
    }
    return null;
}


/**
 * POST /api/whatsapp/incoming
 * Receives message, handles verification codes OR publishes task to QStash, returns immediate 200 OK.
 * A mensagem de reconhecimento inicial (acknowledgement) foi removida desta rota na v2.2.
 * Ela agora é gerenciada pelo consultantService.ts no worker QStash para permitir um "quebra-gelo dinâmico".
 */
export async function POST(request: NextRequest) {
  const postTag = '[whatsapp/incoming POST v2.2 QStash]'; // Tag atualizada para v2.2
  let body: any;

  // 1. Parse Body & Basic Validation
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
  const rawText = senderAndMsg.text.trim();
  const normText = normalizeText(rawText);
  logger.info(`${postTag} Mensagem recebida de: ${fromPhone}, Texto: "${rawText.slice(0, 50)}..."`);

  const codeMatch = rawText.match(/\b([A-Z0-9]{6})\b/);
  logger.debug(`${postTag} Verificando se texto "${rawText}" contém um código de 6 caracteres (A-Z, 0-9)... Match: ${codeMatch ? codeMatch[1] : 'Nenhum'}`);

  if (codeMatch && codeMatch[1]) {
    const verificationCode = codeMatch[1];
    const verifyTag = '[whatsapp/incoming][Verification]';
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
                reply = `Olá ${userWithCode.name || ''}! Seu número de WhatsApp (${fromPhone}) foi vinculado com sucesso à sua conta.`;
                logger.info(`${verifyTag} Número ${fromPhone} vinculado com sucesso ao usuário ${userWithCode._id}.`);
            } else {
                reply = `Olá ${userWithCode.name || ''}. Encontramos seu código, mas seu plano (${userWithCode.planStatus}) não está ativo. Ative seu plano para vincular o WhatsApp.`;
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

  logger.debug(`${postTag} Mensagem não é código de verificação ou não foi encontrado padrão. Prosseguindo para fluxo QStash.`);

  let user: IUser;
  try {
      await connectToDatabase();
      user = await dataService.lookupUser(fromPhone);
      logger.info(`${postTag} Usuário ${user._id} encontrado para ${fromPhone}.`);

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
  const uid = user._id.toString();
  const userName = user.name || 'criador';
  const greeting = getRandomGreeting(userName);
 
  let dialogueState: stateService.IDialogueState = {};
  try {
      dialogueState = await stateService.getDialogueState(uid);
  } catch (stateError) {
      logger.error(`${postTag} Erro ao buscar estado do Redis para ${uid} (não fatal):`, stateError);
  }

  let intentResult: IntentResult;
  let determinedIntent: DeterminedIntent | null = null;
  try {
      intentResult = await determineIntent(normText, user, rawText, dialogueState, greeting, uid);
      if (intentResult.type === 'special_handled') {
          logger.info(`${postTag} Intenção tratada como caso especial para ${uid}: ${intentResult.response.slice(0, 50)}...`);
          await sendWhatsAppMessage(fromPhone, intentResult.response);
          await stateService.clearPendingActionState(uid);
          await stateService.updateDialogueState(uid, { lastInteraction: Date.now() });
          return NextResponse.json({ special_handled: true }, { status: 200 });
      } else {
          determinedIntent = intentResult.intent;
          if (dialogueState.lastAIQuestionType && determinedIntent !== 'user_confirms_pending_action' && determinedIntent !== 'user_denies_pending_action') {
              logger.info(`${postTag} Usuário mudou de assunto enquanto havia ação pendente (${dialogueState.lastAIQuestionType}). Limpando estado pendente.`);
              await stateService.clearPendingActionState(uid);
          }
          logger.info(`${postTag} Intenção determinada para ${uid}: ${determinedIntent}`);
      }
  } catch (intentError) {
      logger.error(`${postTag} Erro ao determinar intenção para ${uid}:`, intentError);
      determinedIntent = 'general';
      if (dialogueState.lastAIQuestionType) { 
        await stateService.clearPendingActionState(uid);
      }
  }

  // ***** INÍCIO DA REMOÇÃO DO BLOCO DE MENSAGEM ESTÁTICA *****
  // O bloco de código que enviava a mensagem de processamento estática foi removido daqui.
  // A lógica de reconhecimento dinâmico agora reside no consultantService.ts (worker QStash).
  logger.debug(`${postTag} Mensagem de processamento estática não é mais enviada desta rota (v2.2).`);
  // ***** FIM DA REMOÇÃO DO BLOCO DE MENSAGEM ESTÁTICA *****


  // 5. Publish Task to QStash
  if (!qstashClient) {
      logger.error(`${postTag} Cliente QStash não inicializado (QSTASH_TOKEN ausente?). Não é possível enfileirar tarefa.`);
      return NextResponse.json({ error: 'QStash client not configured' }, { status: 500 });
  }

  const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appBaseUrl) {
      logger.error(`${postTag} URL base da aplicação não configurada (APP_BASE_URL ou NEXT_PUBLIC_APP_URL ausente!).`);
      return NextResponse.json({ error: 'App base URL not configured' }, { status: 500 });
  }
  const workerUrl = `${appBaseUrl}/api/whatsapp/process-response`;

  const qstashPayload = { 
      fromPhone: fromPhone,
      incomingText: rawText,
      userId: uid,
      determinedIntent: determinedIntent,
  };

  try {
      logger.info(`${postTag} Publicando tarefa no QStash para ${workerUrl} com payload para User ${uid}. Payload: ${JSON.stringify(qstashPayload)}`);
      const publishResponse = await qstashClient.publishJSON({
          url: workerUrl,
          body: qstashPayload,
      });
      logger.info(`${postTag} Tarefa publicada no QStash com sucesso. Message ID: ${publishResponse.messageId}`);
  } catch (qstashError) {
      logger.error(`${postTag} Falha ao publicar tarefa no QStash para User ${uid}:`, qstashError);
      return NextResponse.json({ error: 'Failed to queue task' }, { status: 500 });
  }

  logger.debug(`${postTag} Retornando 200 OK para Meta.`);
  return NextResponse.json({ received_message: true, task_queued: true }, { status: 200 });
}
