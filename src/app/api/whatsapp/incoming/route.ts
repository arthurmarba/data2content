// src/app/api/whatsapp/incoming/route.ts - v2.3.8
// - Normalização forte de planStatus (trim/lower/collapsing de espaços/hífens)
// - Aceita active-like: active | non_renewing | non-renewing | nonrenewing | trial | trialing
// - Revalida no DB antes de negar (evita falso negativo por atraso ou formatação)
// - Logs detalhados (raw vs normalized)
// - Mantém interrupção/QStash e demais correções (não chama extractContextFromAIResponse)

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/app/lib/helpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { UserNotFoundError } from '@/app/lib/errors';
import { logger } from '@/app/lib/logger';
import { Client as QStashClient } from '@upstash/qstash';
import * as dataService from '@/app/lib/dataService';
import {
  normalizeText,
  determineIntent,
  getRandomGreeting,
  IntentResult,
  DeterminedIntent,
  isSimpleConfirmationOrAcknowledgement,
} from '@/app/lib/intentService';
import { IUser } from '@/app/models/User';
import User from '@/app/models/User';
import * as stateService from '@/app/lib/stateService';

/* ──────────────────────────────────────────────────────────────────
   Normalização e checagem de plano
   ────────────────────────────────────────────────────────────────── */
function normalizePlanStatusStrong(s: unknown): string | null {
  if (s == null) return null;
  // stringifica, trim, lower, troca espaços/hífens por "_", colapsa múltiplos "_"
  let v = String(s).trim().toLowerCase();
  v = v.replace(/[\s-]+/g, '_').replace(/_+/g, '_');
  // também aceitamos variantes sem "_"
  if (v === 'nonrenewing') v = 'non_renewing';
  return v;
}
function isActiveLikeNormalized(s: unknown): boolean {
  const v = normalizePlanStatusStrong(s);
  return v === 'active' || v === 'non_renewing' || v === 'trial' || v === 'trialing';
}
async function revalidateActiveLikeById(userId: string) {
  try {
    const fresh = await User.findById(userId).select('planStatus').lean<{ planStatus?: string }>();
    const raw = fresh?.planStatus;
    const norm = normalizePlanStatusStrong(raw);
    return { raw, norm, active: isActiveLikeNormalized(raw) };
  } catch (e) {
    logger.warn('[incoming/revalidateActiveLikeById] Falha ao revalidar planStatus:', e);
    return { raw: undefined, norm: undefined, active: false };
  }
}

// ──────────────────────────────────────────────────────────────────
// QStash
// ──────────────────────────────────────────────────────────────────
if (!process.env.QSTASH_TOKEN) {
  logger.error('[whatsapp/incoming] Variável de ambiente QSTASH_TOKEN não definida!');
}
if (!process.env.APP_BASE_URL && !process.env.NEXT_PUBLIC_APP_URL) {
  logger.warn('[whatsapp/incoming] APP_BASE_URL/NEXT_PUBLIC_APP_URL não definida! Usando fallback.');
}
const qstashClient = process.env.QSTASH_TOKEN ? new QStashClient({ token: process.env.QSTASH_TOKEN }) : null;

/* ──────────────────────────────────────────────────────────────────
   GET (verificação do webhook)
   ────────────────────────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    logger.error('[whatsapp/incoming GET v2.3.8] Error: WHATSAPP_VERIFY_TOKEN não está no .env');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (searchParams.get('hub.mode') === 'subscribe' && searchParams.get('hub.verify_token') === verifyToken) {
    logger.debug('[whatsapp/incoming GET v2.3.8] Verification succeeded.');
    return new Response(searchParams.get('hub.challenge') || '', { status: 200 });
  }

  logger.error('[whatsapp/incoming GET v2.3.8] Verification failed:', {
    mode: searchParams.get('hub.mode'),
    token_received: searchParams.get('hub.verify_token') ? '******' : 'NONE',
    expected_defined: !!verifyToken,
  });
  return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 });
}

/* ──────────────────────────────────────────────────────────────────
   Utilitários
   ────────────────────────────────────────────────────────────────── */
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
    logger.error('[whatsapp/incoming getSenderAndMessage v2.3.8] Erro ao parsear payload:', error);
  }
  return null;
}

function extractExcerpt(text: string, maxLength = 30): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/* ──────────────────────────────────────────────────────────────────
   POST
   ────────────────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  const postTag = '[whatsapp/incoming POST v2.3.8 InterruptionLogic]';
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
    body.entry.some(
      (e: any) => Array.isArray(e.changes) && e.changes.some((c: any) => c.field === 'messages' && Array.isArray(c.value?.statuses)),
    );

  if (!senderAndMsg && !isStatusUpdate) {
    logger.warn(`${postTag} Payload não contém mensagem de texto válida ou status conhecido.`);
    return NextResponse.json({ received_but_not_processed: true }, { status: 200 });
  }

  if (isStatusUpdate) {
    logger.debug(`${postTag} Atualização de status recebida, confirmando e ignorando.`);
    return NextResponse.json({ received_status_update: true }, { status: 200 });
  }

  const fromPhone = normalizePhoneNumber(senderAndMsg!.from);
  const rawText_MsgNova = senderAndMsg!.text.trim();
  const normText_MsgNova = normalizeText(rawText_MsgNova);
  logger.info(`${postTag} MsgNova de ${fromPhone}: "${rawText_MsgNova.slice(0, 50)}..."`);

  await connectToDatabase();
  let alreadyLinkedUser: IUser | null = null;
  try {
    alreadyLinkedUser = await User.findOne({ whatsappPhone: fromPhone, whatsappVerified: true }).lean<IUser>();
    if (alreadyLinkedUser) {
      logger.debug(
        `${postTag} Número ${fromPhone} já vinculado ao usuário ${alreadyLinkedUser._id}. Pulando verificação de código.`,
      );
    }
  } catch (e) {
    logger.error(`${postTag} Erro ao verificar vinculação prévia para ${fromPhone}:`, e);
  }

  // 1) Fluxo de CÓDIGO DE VERIFICAÇÃO
  const codeMatch = !alreadyLinkedUser ? rawText_MsgNova.match(/\b([A-Za-z0-9]{6})\b/) : null;
  if (!alreadyLinkedUser && codeMatch && codeMatch[1]) {
    const verificationCode = codeMatch[1].toUpperCase();
    const verifyTag = '[whatsapp/incoming][Verification v2.3.8]';
    logger.info(`${verifyTag} Código detectado: ${verificationCode} de ${fromPhone}`);

    try {
      const userWithCode = await User.findOne({ whatsappVerificationCode: verificationCode });
      if (userWithCode) {
        const raw = userWithCode.planStatus;
        const norm = normalizePlanStatusStrong(raw);
        logger.debug(`${verifyTag} user=${userWithCode._id} planStatus raw="${raw}" normalized="${norm}"`);

        // Checagem normalizada
        let activeLike = isActiveLikeNormalized(raw);

        // Revalida no DB (raro, mas evita edge case)
        if (!activeLike) {
          const reval = await revalidateActiveLikeById(String(userWithCode._id));
          logger.debug(`${verifyTag} Revalidação: raw="${reval.raw}" normalized="${reval.norm}" active=${reval.active}`);
          activeLike = reval.active;
        }

        let reply = '';
        if (activeLike) {
          userWithCode.whatsappPhone = fromPhone;
          userWithCode.whatsappVerificationCode = null;
          userWithCode.whatsappVerified = true;
          await userWithCode.save();

          const firstName = userWithCode.name ? userWithCode.name.split(' ')[0] : '';
          reply = `Olá ${firstName}, me chamo Mobi! Seu número de WhatsApp (${fromPhone}) foi vinculado com sucesso à sua conta. A partir de agora serei seu assistente de métricas e insights via WhatsApp. 👋
Vou acompanhar em tempo real o desempenho dos seus conteúdos, enviar resumos diários com os principais indicadores e sugerir dicas práticas para você melhorar seu engajamento. Sempre que quiser consultar alguma métrica, receber insights sobre seus posts ou configurar alertas personalizados, é só me chamar por aqui. Estou à disposição para ajudar você a crescer de forma inteligente!
Você pode começar me pedindo um planejamento de conteudo que otimize seu alcance. :)`;
          logger.info(`${verifyTag} VINCULADO com sucesso user=${userWithCode._id}, status="${norm ?? raw}"`);
        } else {
          const firstName = userWithCode.name ? userWithCode.name.split(' ')[0] : '';
          reply = `Olá ${firstName}. Encontramos seu código, mas seu plano (${raw ?? 'indefinido'}) não está ativo. Ative sua assinatura para vincular o WhatsApp.`;
          logger.warn(`${verifyTag} NEGADO user=${userWithCode._id}, status raw="${raw}", normalized="${norm}"`);
        }

        await sendWhatsAppMessage(fromPhone, reply);
      } else {
        logger.warn(`${verifyTag} Nenhum usuário encontrado para o código: ${verificationCode}`);
        await sendWhatsAppMessage(fromPhone, 'Código inválido ou expirado. Verifique o código no seu perfil ou gere um novo.');
      }

      return NextResponse.json({ verification_attempted: true }, { status: 200 });
    } catch (error) {
      logger.error(`${verifyTag} Erro processando código ${verificationCode}:`, error);
      try {
        await sendWhatsAppMessage(fromPhone, 'Ocorreu um erro ao tentar verificar seu código. Tente novamente mais tarde.');
      } catch {}
      return NextResponse.json({ error: 'Failed to process verification code' }, { status: 500 });
    }
  }

  // 2) Fluxo NORMAL
  let user: IUser;
  let uid: string;
  let userFirstName: string;

  try {
    user = alreadyLinkedUser ?? await dataService.lookupUser(fromPhone);
    uid = user._id.toString();
    userFirstName = (user.name || 'criador').split(' ')[0]!;
    logger.info(`${postTag} Usuário ${uid} (${userFirstName}) encontrado para ${fromPhone}.`);
  } catch (e) {
    logger.error(`${postTag} Erro em lookupUser para ${fromPhone}:`, e);
    if (e instanceof UserNotFoundError) {
      try {
        await sendWhatsAppMessage(
          fromPhone,
          'Olá! Não encontrei uma conta associada a este número de WhatsApp. Se você já se registou (ex: com Google), por favor, acesse a plataforma e use a opção "Vincular WhatsApp" no seu perfil.',
        );
      } catch (sendError) {
        logger.error(`${postTag} Falha ao enviar aviso de usuário não encontrado:`, sendError);
      }
      return NextResponse.json({ user_not_found_message_sent: true }, { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to lookup user' }, { status: 500 });
  }

  // Bloqueio para plano não-ativo (normalizado)
  const rawStatusUser = user.planStatus;
  const normStatusUser = normalizePlanStatusStrong(rawStatusUser);
  const activeLikeUser = isActiveLikeNormalized(rawStatusUser);
  logger.debug(`${postTag} planStatus do usuário raw="${rawStatusUser}" normalized="${normStatusUser}" activeLike=${activeLikeUser}`);

  if (!activeLikeUser) {
    try {
      await sendWhatsAppMessage(
        fromPhone,
        `Olá ${userFirstName}! Seu plano está ${rawStatusUser ?? 'indefinido'}. Para continuar usando o Mobi, reative sua assinatura em nosso site.`,
      );
    } catch (sendError) {
      logger.error(`${postTag} Falha ao enviar mensagem de plano inativo:`, sendError);
    }
    return NextResponse.json({ plan_inactive: true }, { status: 200 });
  }

  // Interrupção / intenção / QStash
  let currentDialogueState: stateService.IDialogueState = stateService.getDefaultDialogueState();
  try {
    const t0 = Date.now();
    currentDialogueState = await stateService.getDialogueState(uid);
    logger.debug(`${postTag} getDialogueState levou ${Date.now() - t0}ms.`);
  } catch (stateError) {
    logger.error(`${postTag} Erro ao buscar estado do Redis para ${uid} (usará default):`, stateError);
    currentDialogueState = stateService.getDefaultDialogueState();
  }

  if (currentDialogueState.currentProcessingMessageId) {
    const isConfirmation = isSimpleConfirmationOrAcknowledgement(normText_MsgNova);
    if (isConfirmation) {
      const ack = `Entendido, ${userFirstName}! Continuo trabalhando no seu pedido anterior sobre "${currentDialogueState.currentProcessingQueryExcerpt || 'o assunto anterior'}". 👍`;
      try { await sendWhatsAppMessage(fromPhone, ack); } catch (e) { logger.error(`${postTag} Falha ao enviar ack adaptado:`, e); }
    } else {
      const excerpt = extractExcerpt(rawText_MsgNova);
      const ack = `Recebi sua nova mensagem sobre "${excerpt}", ${userFirstName}! Só um instante enquanto concluo o raciocínio anterior sobre "${currentDialogueState.currentProcessingQueryExcerpt || 'o assunto anterior'}".`;
      try { await sendWhatsAppMessage(fromPhone, ack); } catch (e) { logger.error(`${postTag} Falha ao enviar ack padrão:`, e); }
      await stateService.updateDialogueState(uid, { interruptSignalForMessageId: currentDialogueState.currentProcessingMessageId });
      currentDialogueState = await stateService.getDialogueState(uid);
    }
  }

  const greeting = getRandomGreeting(userFirstName);
  let intentResult: IntentResult;
  let determinedIntent: DeterminedIntent | null = null;

  try {
    const t0 = Date.now();
    intentResult = await determineIntent(normText_MsgNova, user, rawText_MsgNova, currentDialogueState, greeting, uid);
    logger.debug(`${postTag} determineIntent levou ${Date.now() - t0}ms.`);

    if (intentResult.type === 'special_handled') {
      await sendWhatsAppMessage(fromPhone, intentResult.response);
      const st: Partial<stateService.IDialogueState> = { lastInteraction: Date.now() };
      if (currentDialogueState.lastAIQuestionType) { st.lastAIQuestionType = undefined; st.pendingActionContext = undefined; }
      await stateService.updateDialogueState(uid, st);
      return NextResponse.json({ special_handled: true }, { status: 200 });
    } else {
      determinedIntent = intentResult.intent;
      if (
        currentDialogueState.lastAIQuestionType &&
        determinedIntent !== 'user_confirms_pending_action' &&
        determinedIntent !== 'user_denies_pending_action'
      ) {
        await stateService.clearPendingActionState(uid);
      }
    }
  } catch (intentError) {
    logger.error(`${postTag} Erro ao determinar intenção para ${uid}:`, intentError);
    determinedIntent = 'general';
    if (currentDialogueState.lastAIQuestionType) await stateService.clearPendingActionState(uid);
  }

  if (!qstashClient) {
    logger.error(`${postTag} QStash não configurado.`);
    return NextResponse.json({ error: 'QStash client not configured' }, { status: 500 });
  }
  const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appBaseUrl) {
    logger.error(`${postTag} App base URL não configurada.`);
    return NextResponse.json({ error: 'App base URL not configured' }, { status: 500 });
  }

  const workerUrl = `${appBaseUrl}/api/whatsapp/process-response`;
  const qstashPayload = { fromPhone, incomingText: rawText_MsgNova, userId: uid, determinedIntent };

  try {
    logger.info(`${postTag} Publicando tarefa no QStash para ${workerUrl} - payload: ${JSON.stringify(qstashPayload)}`);
    const publishResponse = await qstashClient.publishJSON({ url: workerUrl, body: qstashPayload });
    logger.info(`${postTag} Tarefa publicada. QStash Message ID: ${publishResponse.messageId}`);
  } catch (err) {
    logger.error(`${postTag} Falha ao publicar tarefa no QStash:`, err);
    return NextResponse.json({ error: 'Failed to queue task' }, { status: 500 });
  }

  return NextResponse.json({ received_message: true, task_queued: true }, { status: 200 });
}
