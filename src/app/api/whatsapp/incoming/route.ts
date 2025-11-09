// src/app/api/whatsapp/incoming/route.ts - v2.4.0 (IG CTA + igConnected flag)
// - Mantém v2.3.9 intacto (intent restaurada + expiração só se existir expiresAt)
// - ADICIONA: PS de conexão do Instagram em respostas special_handled (quando usuário ainda não conectou)
// - ADICIONA: igConnected no payload do QStash para o worker poder anexar o mesmo PS

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/app/lib/helpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { UserNotFoundError } from '@/app/lib/errors';
import { logger } from '@/app/lib/logger';
import { Client as QStashClient } from '@upstash/qstash';
import * as dataService from '@/app/lib/dataService';
import {
  buildWhatsappTrialActivation,
  canStartWhatsappTrial,
} from '@/app/lib/whatsappTrial';
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

const WHATSAPP_TRIAL_UPSELL_URL =
  process.env.NEXT_PUBLIC_PRO_UPGRADE_URL ||
  process.env.WHATSAPP_TRIAL_UPSELL_URL ||
  'https://app.data2content.co/dashboard/billing/checkout';

/* ──────────────────────────────────────────────────────────────────
   Normalização e checagem de plano
   ────────────────────────────────────────────────────────────────── */
function normalizePlanStatusStrong(s: unknown): string | null {
  if (s == null) return null;
  let v = String(s).trim().toLowerCase();
  v = v.replace(/[\s-]+/g, '_').replace(/_+/g, '_');
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
    logger.error('[whatsapp/incoming GET v2.4.0] Error: WHATSAPP_VERIFY_TOKEN não está no .env');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (searchParams.get('hub.mode') === 'subscribe' && searchParams.get('hub.verify_token') === verifyToken) {
    logger.debug('[whatsapp/incoming GET v2.4.0] Verification succeeded.');
    return new Response(searchParams.get('hub.challenge') || '', { status: 200 });
  }

  logger.error('[whatsapp/incoming GET v2.4.0] Verification failed:', {
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
    logger.error('[whatsapp/incoming getSenderAndMessage v2.4.0] Erro ao parsear payload:', error);
  }
  return null;
}

function extractExcerpt(text: string, maxLength = 30): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/** PS de conexão do Instagram quando o usuário ainda não conectou. */
function appendIgCtaIfNeeded(
  text: string,
  user: Pick<IUser, 'isInstagramConnected' | 'instagramAccountId'>
) {
  const isConnected = Boolean(user.isInstagramConnected && user.instagramAccountId);
  if (isConnected) return text;
  return (
    text +
    '\n\n🔗 Para eu analisar seus conteúdos e responder com dados reais, conecte seu Instagram na plataforma (Perfil → Conectar Instagram).'
  );
}

/* ──────────────────────────────────────────────────────────────────
   POST
   ────────────────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  const postTag = '[whatsapp/incoming POST v2.4.0 InterruptionLogic]';
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
    const verifyTag = '[whatsapp/incoming][Verification v2.4.0]';
    logger.info(`${verifyTag} Código detectado: ${verificationCode} de ${fromPhone}`);

    try {
      const userWithCode = await User.findOne({ whatsappVerificationCode: verificationCode });
      if (userWithCode) {
        // ===== Checagem de expiração (só expira se existir expiresAt) =====
        const exp: Date | undefined =
          (userWithCode as any).whatsappVerificationCodeExpiresAt instanceof Date
            ? (userWithCode as any).whatsappVerificationCodeExpiresAt
            : (userWithCode as any).whatsappVerificationCodeExpiresAt
            ? new Date((userWithCode as any).whatsappVerificationCodeExpiresAt)
            : undefined;

        const now = Date.now();
        if (exp && exp.getTime() <= now) {
          logger.warn(
            `${verifyTag} Código expirado para user=${userWithCode._id}; exp=${exp.toISOString()}`
          );
          // Limpa o código expirado para evitar confusão
          (userWithCode as any).whatsappVerificationCode = null;
          (userWithCode as any).whatsappVerificationCodeExpiresAt = undefined;
          await userWithCode.save();

          await sendWhatsAppMessage(
            fromPhone,
            'Seu código expirou. Gere um novo na plataforma (Perfil > Vincular WhatsApp) e envie aqui novamente.'
          );
          return NextResponse.json({ verification_attempted: true, expired: true }, { status: 200 });
        }
        // ===== FIM: checagem de expiração =====

        let raw = userWithCode.planStatus;
        let norm = normalizePlanStatusStrong(raw);
        logger.debug(`${verifyTag} user=${userWithCode._id} planStatus raw="${raw}" normalized="${norm}"`);

        // Checagem normalizada + revalidação
        let activeLike = isActiveLikeNormalized(raw);
        if (!activeLike) {
          const reval = await revalidateActiveLikeById(String(userWithCode._id));
          logger.debug(`${verifyTag} Revalidação: raw="${reval.raw}" normalized="${reval.norm}" active=${reval.active}`);
          activeLike = reval.active;
        }

        let trialActivation: ReturnType<typeof buildWhatsappTrialActivation> | null = null;
        if (!activeLike && canStartWhatsappTrial(userWithCode as any)) {
          const activationNow = new Date();
          trialActivation = buildWhatsappTrialActivation(activationNow);
          for (const [key, value] of Object.entries(trialActivation.set)) {
            (userWithCode as any)[key] = value;
          }
          raw = userWithCode.planStatus;
          norm = normalizePlanStatusStrong(raw);
          activeLike = true;
          logger.info(
            `${verifyTag} Trial de WhatsApp iniciado para user=${userWithCode._id}, expira em ${trialActivation.expiresAt.toISOString()}`
          );
        }

        let reply = '';
        if (activeLike) {
          (userWithCode as any).whatsappPhone = fromPhone;
          (userWithCode as any).whatsappVerificationCode = null;
          (userWithCode as any).whatsappVerificationCodeExpiresAt = undefined;
          (userWithCode as any).whatsappVerified = true;
          await userWithCode.save();

          const firstName = userWithCode.name ? userWithCode.name.split(' ')[0] : '';
          reply = `Olá ${firstName}, me chamo Mobi! Seu número de WhatsApp (${fromPhone}) foi vinculado com sucesso à sua conta. A partir de agora serei seu assistente de métricas e insights via WhatsApp. 👋
Vou acompanhar em tempo real o desempenho dos seus conteúdos, enviar resumos diários com os principais indicadores e sugerir dicas práticas para você melhorar seu engajamento. Sempre que quiser consultar alguma métrica, receber insights sobre seus posts ou configurar alertas personalizados, é só me chamar por aqui. Estou à disposição para ajudar você a crescer de forma inteligente!
Você pode começar me pedindo um planejamento de conteudo que otimize seu alcance. :)`;

          if (trialActivation) {
            reply += '\n\n🎉 Você ganhou 48 horas de acesso gratuito via WhatsApp. Após esse período, ative seu Plano Agência para desbloquear mais 7 dias gratuitos.';
          }

          // PS: conexão do Instagram, se ainda não estiver conectado
          if (!userWithCode.isInstagramConnected || !userWithCode.instagramAccountId) {
            reply += '\n\n⚠️ Para que eu puxe seus dados e gere análises, conecte seu Instagram na plataforma (Perfil → Conectar Instagram).';
          }

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

  const trialExpiresRaw = user.whatsappTrialExpiresAt;
  const trialExpiresDate =
    trialExpiresRaw instanceof Date ? trialExpiresRaw : trialExpiresRaw ? new Date(trialExpiresRaw) : null;
  const trialExpiresAt = trialExpiresDate && !Number.isNaN(trialExpiresDate.getTime()) ? trialExpiresDate : null;
  const trialExpiresIso = trialExpiresAt ? trialExpiresAt.toISOString() : 'null';
  const trialWindowActive =
    Boolean(user.whatsappTrialActive) && Boolean(trialExpiresAt && trialExpiresAt.getTime() > Date.now());

  if (user.whatsappTrialActive && !trialWindowActive) {
    const message =
      `Seu teste gratuito de 48h com a estrategista terminou. ` +
      `Ative o Plano Agência para continuar recebendo alertas personalizados: ${WHATSAPP_TRIAL_UPSELL_URL}`;
    logger.info(`${postTag} Trial expirado para ${uid} (expiresAt=${trialExpiresIso}). Notificando e encerrando atendimento.`);
    try {
      await sendWhatsAppMessage(fromPhone, message);
    } catch (sendError) {
      logger.error(`${postTag} Falha ao enviar mensagem de trial expirado:`, sendError);
    }
    return NextResponse.json({ trial_expired: true }, { status: 200 });
  }

  if (trialWindowActive) {
    logger.debug(`${postTag} Usuário ${uid} em trial ativo até ${trialExpiresIso}.`);
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

  // Interrupção / estado de diálogo
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

  // >>> RESTAURADO: cálculo da intenção <<<
  const greeting = getRandomGreeting(userFirstName);
  let intentResult: IntentResult;
  let determinedIntent: DeterminedIntent | null = null;

  try {
    const t0 = Date.now();
    intentResult = await determineIntent(normText_MsgNova, user, rawText_MsgNova, currentDialogueState, greeting, uid);
    logger.debug(`${postTag} determineIntent levou ${Date.now() - t0}ms.`);

    if (intentResult.type === 'special_handled') {
      // Acrescenta PS do Instagram se ainda não estiver conectado
      const toSend = appendIgCtaIfNeeded(intentResult.response, user);
      await sendWhatsAppMessage(fromPhone, toSend);

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
  // <<< FIM RESTAURADO

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
  const igConnected = Boolean(user.isInstagramConnected && user.instagramAccountId);
  const qstashPayload = { fromPhone, incomingText: rawText_MsgNova, userId: uid, determinedIntent, igConnected };

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
