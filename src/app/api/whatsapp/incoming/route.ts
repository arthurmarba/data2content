// src/app/api/whatsapp/incoming/route.ts - v1.7 (Refatorado para QStash)

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/app/lib/helpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
// getConsultantResponse não será mais chamado diretamente aqui
// import { getConsultantResponse } from '@/app/lib/consultantService';
import { UserNotFoundError } from '@/app/lib/errors';
import { logger } from '@/app/lib/logger';
import { Client as QStashClient } from "@upstash/qstash"; // Importa o cliente QStash
import * as dataService from '@/app/lib/dataService'; // Para lookupUser
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from '@/app/lib/intentService'; // Para determinar intenção
import { IUser } from '@/app/models/User';
import * as stateService from '@/app/lib/stateService'; // Para obter estado para determineIntent


// Validações de ambiente
if (!process.env.QSTASH_TOKEN) {
    logger.error("[whatsapp/incoming] Variável de ambiente QSTASH_TOKEN não definida!");
}
if (!process.env.APP_BASE_URL && !process.env.NEXT_PUBLIC_APP_URL) {
    logger.warn("[whatsapp/incoming] Variável de ambiente APP_BASE_URL ou NEXT_PUBLIC_APP_URL não definida! Usando fallback.");
    // Considere lançar um erro aqui se for crítico
}

// Inicializa cliente QStash (fora da função para reutilizar)
const qstashClient = process.env.QSTASH_TOKEN ? new QStashClient({ token: process.env.QSTASH_TOKEN }) : null;


/**
 * GET /api/whatsapp/incoming
 * Webhook verification for WhatsApp/Facebook. (Mantido como está)
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
 * Extracts the sender phone and message text from the webhook payload. (Mantido como está)
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
 * Receives message, sends initial ack, publishes task to QStash, returns immediate 200 OK.
 */
export async function POST(request: NextRequest) {
  const postTag = '[whatsapp/incoming POST v1.7 QStash]'; // Tag atualizada
  let body: any;

  // 1. Parse Body & Basic Validation
  try {
    // Não conectar ao DB aqui necessariamente, o worker fará isso.
    // await connectToDatabase(); // Removido - conexão desnecessária aqui
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
    return NextResponse.json({ received_but_not_processed: true }, { status: 200 }); // Retorna OK para Meta
  }

  if (isStatusUpdate) {
    logger.debug(`${postTag} Atualização de status recebida, confirmando e ignorando.`);
    return NextResponse.json({ received_status_update: true }, { status: 200 }); // Retorna OK para Meta
  }

  // Se chegou aqui, é uma mensagem de texto válida
  if (!senderAndMsg) {
      logger.error(`${postTag} Erro crítico: senderAndMsg é null após validações.`);
      return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }

  const fromPhone = normalizePhoneNumber(senderAndMsg.from);
  const rawText = senderAndMsg.text.trim();
  const normText = normalizeText(rawText);
  logger.info(`${postTag} Mensagem recebida de: ${fromPhone}, Texto: "${rawText.slice(0, 50)}..."`);

  // 2. Lookup User (Necessário para mensagem inicial e payload)
  let user: IUser;
  try {
      await connectToDatabase(); // Conecta ao DB *antes* de buscar o usuário
      user = await dataService.lookupUser(fromPhone);
  } catch (e) {
      logger.error(`${postTag} Erro em lookupUser para ${fromPhone}:`, e);
      if (e instanceof UserNotFoundError) {
          // Envia mensagem para usuário não encontrado e retorna OK para Meta
          try {
              await sendWhatsAppMessage(fromPhone, 'Olá! Parece que é nosso primeiro contato por aqui. Para começar, preciso fazer seu cadastro rápido. Pode me confirmar seu nome completo, por favor?');
          } catch (sendError) {
              logger.error(`${postTag} Falha ao enviar mensagem de usuário não encontrado:`, sendError);
          }
          return NextResponse.json({ user_not_found_message_sent: true }, { status: 200 });
      }
      // Outro erro no lookup, retorna erro 500 para Meta
      return NextResponse.json({ error: 'Failed to lookup user' }, { status: 500 });
  }
  const uid = user._id.toString();
  const userName = user.name || 'criador';
  const greeting = getRandomGreeting(userName);

  // 3. Determine Intent & Handle Special Cases (Ex: Greetings, Thanks)
  let dialogueState: stateService.DialogueState = {};
  try {
      dialogueState = await stateService.getDialogueState(uid); // Busca estado para intentService
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
          return NextResponse.json({ special_handled: true }, { status: 200 }); // Retorna OK para Meta
      } else {
          determinedIntent = intentResult.intent;
          logger.info(`${postTag} Intenção determinada para ${uid}: ${determinedIntent}`);
      }
  } catch (intentError) {
      logger.error(`${postTag} Erro ao determinar intenção para ${uid}:`, intentError);
      determinedIntent = 'general'; // Fallback
  }

  // 4. Send Initial Processing Message
  try {
      let processingMessage = `Ok, ${userName}! Recebi seu pedido. 👍\nEstou a analisar as informações e já te trago os insights...`; // Default
      switch (determinedIntent) {
          case 'script_request': processingMessage = `Ok, ${userName}! Pedido de roteiro recebido. 👍\nEstou a estruturar as ideias e já te mando o script...`; break;
          case 'content_plan': processingMessage = `Ok, ${userName}! Recebi seu pedido de plano de conteúdo. 👍\nEstou a organizar a agenda e já te apresento o planejamento...`; break;
          case 'ranking_request': processingMessage = `Entendido, ${userName}! Você quer um ranking. 👍\nEstou a comparar os dados e já te mostro os resultados ordenados...`; break;
          case 'report': case 'ASK_BEST_PERFORMER': case 'ASK_BEST_TIME': processingMessage = `Certo, ${userName}! Recebi seu pedido de análise/relatório. 👍\nEstou a compilar os dados e já te apresento os resultados...`; break;
          case 'content_ideas': processingMessage = `Legal, ${userName}! Buscando ideias de conteúdo para você. 👍\nEstou a verificar as tendências e já te trago algumas sugestões...`; break;
          case 'general': default: processingMessage = `Ok, ${userName}! Recebi sua mensagem. 👍\nEstou a processar e já te respondo...`; break;
      }
      logger.debug(`${postTag} Enviando mensagem de processamento (intenção: ${determinedIntent}) para ${fromPhone}...`);
      await sendWhatsAppMessage(fromPhone, processingMessage);
  } catch (sendError) {
      logger.error(`${postTag} Falha ao enviar mensagem inicial de processamento para ${fromPhone} (não fatal):`, sendError);
      // Continua mesmo se a mensagem inicial falhar
  }

  // 5. Publish Task to QStash
  if (!qstashClient) {
      logger.error(`${postTag} Cliente QStash não inicializado (QSTASH_TOKEN ausente?). Não é possível enfileirar tarefa.`);
      // Retorna erro 500 para Meta, pois não podemos processar
      return NextResponse.json({ error: 'QStash client not configured' }, { status: 500 });
  }

  const workerUrl = `${process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'YOUR_FALLBACK_URL'}/api/whatsapp/process-response`;
  if (workerUrl.includes('YOUR_FALLBACK_URL')) {
       logger.error(`${postTag} URL do worker não configurada (APP_BASE_URL ou NEXT_PUBLIC_APP_URL ausente!).`);
       return NextResponse.json({ error: 'Worker URL not configured' }, { status: 500 });
  }

  const payload = {
      fromPhone: fromPhone,
      incomingText: rawText, // Envia o texto original
      userId: uid,
      // Inclua outros dados se o worker precisar e for mais eficiente que buscar lá
      // userName: userName,
  };

  try {
      logger.info(`${postTag} Publicando tarefa no QStash para ${workerUrl} com payload para User ${uid}...`);
      const publishResponse = await qstashClient.publishJSON({
          url: workerUrl,
          body: payload,
          // contentBasedDeduplication: true, // Opcional: Evita duplicatas se a mesma msg chegar rápido
          // delay: '1s' // Opcional: Adiciona um pequeno delay se necessário
      });
      logger.info(`${postTag} Tarefa publicada no QStash com sucesso. Message ID: ${publishResponse.messageId}`);
  } catch (qstashError) {
      logger.error(`${postTag} Falha ao publicar tarefa no QStash para User ${uid}:`, qstashError);
      // Retorna erro 500 para Meta, pois a tarefa não foi enfileirada
      return NextResponse.json({ error: 'Failed to queue task' }, { status: 500 });
  }

  // 6. Return Immediate OK to Meta
  logger.debug(`${postTag} Retornando 200 OK para Meta.`);
  return NextResponse.json({ received_message: true, task_queued: true }, { status: 200 });
}
