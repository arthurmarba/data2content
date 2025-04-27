// src/app/api/whatsapp/incoming/route.ts - v1.9 (Log RawText na Verificação)

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/app/lib/helpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
// getConsultantResponse não será mais chamado diretamente aqui
import { UserNotFoundError } from '@/app/lib/errors';
import { logger } from '@/app/lib/logger';
import { Client as QStashClient } from "@upstash/qstash"; // Importa o cliente QStash
import * as dataService from '@/app/lib/dataService'; // Para lookupUser
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from '@/app/lib/intentService'; // Para determinar intenção
import { IUser } from '@/app/models/User';
import User from '@/app/models/User'; // <<< IMPORTAÇÃO DIRETA DO MODELO USER >>>
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
 * Receives message, handles verification codes OR sends initial ack & publishes task to QStash, returns immediate 200 OK.
 */
export async function POST(request: NextRequest) {
  const postTag = '[whatsapp/incoming POST v1.9 QStash]'; // Tag atualizada
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
  const rawText = senderAndMsg.text.trim(); // Usa trim() para remover espaços extras no início/fim
  const normText = normalizeText(rawText); // Normaliza para intent (lowercase, sem acentos)
  logger.info(`${postTag} Mensagem recebida de: ${fromPhone}, Texto: "${rawText.slice(0, 50)}..."`);

  // --- TENTA TRATAR COMO CÓDIGO DE VERIFICAÇÃO PRIMEIRO ---
  // *** LOG ADICIONADO AQUI ***
  logger.debug(`${postTag} Verificando se texto "${rawText}" corresponde a um código de 6 caracteres (A-Z, 0-9)...`);
  const codeMatch = rawText.match(/^\s*([A-Z0-9]{6})\s*$/);
  // *** FIM DO LOG ADICIONADO ***

  if (codeMatch && codeMatch[1]) {
    const verificationCode = codeMatch[1];
    const verifyTag = '[whatsapp/incoming][Verification]';
    logger.info(`${verifyTag} Código de verificação detectado: ${verificationCode} de ${fromPhone}`);

    try {
        await connectToDatabase(); // Conecta ao DB para buscar pelo código
        logger.debug(`${verifyTag} Buscando usuário com código: ${verificationCode}`);

        // Busca usuário pelo código
        const userWithCode = await User.findOne({ whatsappVerificationCode: verificationCode });

        if (userWithCode) {
            logger.info(`${verifyTag} Usuário ${userWithCode._id} encontrado para o código ${verificationCode}.`);
            let reply = '';
            if (userWithCode.planStatus === 'active') {
                logger.debug(`${verifyTag} Plano ativo. Vinculando número ${fromPhone} ao usuário ${userWithCode._id}`);
                userWithCode.whatsappPhone = fromPhone; // Vincula o número
                userWithCode.whatsappVerificationCode = null; // Limpa o código
                userWithCode.whatsappVerified = true; // Marca como verificado
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
        // Retorna OK para Meta após tratar o código (sucesso ou falha)
        return NextResponse.json({ verification_attempted: true, user_found: !!userWithCode }, { status: 200 });

    } catch (error) {
        logger.error(`${verifyTag} Erro ao processar código de verificação ${verificationCode}:`, error);
        // Tenta enviar uma mensagem de erro genérica
        try { await sendWhatsAppMessage(fromPhone, "Ocorreu um erro ao tentar verificar seu código. Tente novamente mais tarde."); } catch (e) {}
        // Retorna 500 para Meta indicar falha no processamento
        return NextResponse.json({ error: 'Failed to process verification code' }, { status: 500 });
    }
  }
  // --- FIM DO TRATAMENTO DE CÓDIGO ---

  // --- Se NÃO for um código de verificação, continua com o fluxo normal (QStash) ---
  logger.debug(`${postTag} Mensagem não é código de verificação. Prosseguindo para fluxo QStash.`);

  // 2. Lookup User (pelo telefone, necessário para mensagem inicial e payload)
  let user: IUser;
  try {
      await connectToDatabase(); // Conecta ao DB *antes* de buscar o usuário
      user = await dataService.lookupUser(fromPhone);
      // Se lookupUser funcionou, o número JÁ ESTÁ VINCULADO.
      logger.info(`${postTag} Usuário ${user._id} encontrado para ${fromPhone} (já vinculado?).`);

  } catch (e) {
      // Se o usuário não foi encontrado PELO TELEFONE, envia mensagem de erro e para.
      logger.error(`${postTag} Erro em lookupUser para ${fromPhone}:`, e);
      if (e instanceof UserNotFoundError) {
          // Envia mensagem para usuário não encontrado e retorna OK para Meta
          try {
              // MENSAGEM AJUSTADA: Não pede mais o nome, pois o usuário pode já existir mas sem o telefone vinculado.
              await sendWhatsAppMessage(fromPhone, 'Olá! Não encontrei uma conta associada a este número de WhatsApp. Se você já se registou (ex: com Google), por favor, acesse a plataforma e use a opção "Vincular WhatsApp" no seu perfil.');
          } catch (sendError) {
              logger.error(`${postTag} Falha ao enviar mensagem de usuário não encontrado/vinculado:`, sendError);
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

  const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appBaseUrl) {
      logger.error(`${postTag} URL base da aplicação não configurada (APP_BASE_URL ou NEXT_PUBLIC_APP_URL ausente!).`);
      return NextResponse.json({ error: 'App base URL not configured' }, { status: 500 });
  }
  const workerUrl = `${appBaseUrl}/api/whatsapp/process-response`;


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
