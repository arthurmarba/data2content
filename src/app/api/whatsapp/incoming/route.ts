// src/app/api/whatsapp/incoming/route.ts - Redirect-only inbound handler (v3.0.0)
// - Enforces template-based replies and redirects users to Chat AI.
// - Supports opt-in/out commands and basic phone verification without IA/LLM calls.

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/app/lib/helpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import { sendTemplateMessage, type ITemplateComponent } from '@/app/lib/whatsappService';
import { logger } from '@/app/lib/logger';
import { getFromCache, setInCache } from '@/app/lib/stateService';
import User, { type IUser } from '@/app/models/User';

const INBOUND_MODE = (process.env.WHATSAPP_INBOUND_MODE || 'redirect_only').toLowerCase();
const REDIRECT_TEMPLATE = process.env.WHATSAPP_TEMPLATE_REDIRECT || 'd2c_redirect_chat_ai';
const OPT_OUT_TEMPLATE = process.env.WHATSAPP_TEMPLATE_OPTOUT || 'd2c_optout_confirm';
const OPT_IN_TEMPLATE = process.env.WHATSAPP_TEMPLATE_OPTIN || 'd2c_optin_confirm';
const HELP_TEMPLATE = process.env.WHATSAPP_TEMPLATE_HELP || 'd2c_help';
const CODE_EXPIRED_TEMPLATE = process.env.WHATSAPP_TEMPLATE_CODE_EXPIRED || 'd2c_code_expired';
const CODE_CONFIRMED_TEMPLATE = process.env.WHATSAPP_TEMPLATE_CODE_CONFIRMED || 'd2c_code_confirmed';
const CHAT_AI_URL =
  process.env.NEXT_PUBLIC_CHAT_AI_URL || process.env.CHAT_AI_URL || 'https://data2content.ai/chat';
const REDIRECT_RATE_LIMIT_MINUTES = Number(process.env.WHATSAPP_REDIRECT_RATE_LIMIT_MINUTES || '10');

const DEDUP_TTL_SECONDS = 60 * 60 * 48;
const REDIRECT_COOLDOWN_SECONDS = Math.max(REDIRECT_RATE_LIMIT_MINUTES, 1) * 60;

const OPT_OUT_KEYWORDS = ['PARAR', 'STOP', 'SAIR', 'CANCELAR'];
const OPT_IN_KEYWORDS = ['VOLTAR', 'START', 'RETOMAR'];
const HELP_KEYWORDS = ['AJUDA', 'HELP', 'MENU', '?'];

interface IncomingMessage {
  from: string;
  text: string;
  messageId: string;
  timestamp?: number;
}

function normalizeCommand(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();
}

function sanitizePhoneForKey(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

function extractSenderAndMessage(body: any): { message: IncomingMessage | null; isStatusUpdate: boolean } {
  const fallback = { message: null, isStatusUpdate: false };
  try {
    if (!body || !Array.isArray(body.entry)) return fallback;

    for (const entry of body.entry) {
      if (!Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        if (change.field === 'messages' && Array.isArray(change.value?.messages) && change.value.messages.length > 0) {
          const message = change.value.messages[0];
          if (message?.type === 'text' && message.text?.body && message.from && message.id) {
            return {
              message: {
                from: message.from,
                text: message.text.body,
                messageId: message.id,
                timestamp: message.timestamp ? Number(message.timestamp) : undefined,
              },
              isStatusUpdate: false,
            };
          }
        }

        if (change.field === 'messages' && Array.isArray(change.value?.statuses)) {
          return { message: null, isStatusUpdate: true };
        }
      }
    }
  } catch (error) {
    logger.error('[whatsapp/incoming] Erro ao parsear payload:', error);
  }
  return fallback;
}

async function alreadyProcessed(messageId: string): Promise<boolean> {
  const cacheKey = `wa:dedup:${messageId}`;
  const cached = await getFromCache(cacheKey);
  if (cached) return true;
  await setInCache(cacheKey, '1', DEDUP_TTL_SECONDS);
  return false;
}

async function hasRecentRedirect(phone: string): Promise<boolean> {
  const cacheKey = `wa:redirect:last:${sanitizePhoneForKey(phone)}`;
  const cached = await getFromCache(cacheKey);
  return Boolean(cached);
}

async function markRedirect(phone: string): Promise<void> {
  const cacheKey = `wa:redirect:last:${sanitizePhoneForKey(phone)}`;
  await setInCache(cacheKey, String(Date.now()), REDIRECT_COOLDOWN_SECONDS);
}

async function loadUserByPhone(phone: string): Promise<IUser | null> {
  try {
    const user = await User.findOne({ whatsappPhone: phone }).lean<IUser>();
    return user || null;
  } catch (error) {
    logger.error('[whatsapp/incoming] Erro ao buscar usuário por telefone:', error);
    return null;
  }
}

async function sendTemplateSafe(to: string, templateName: string, components: ITemplateComponent[]): Promise<string | null> {
  try {
    const wamid = await sendTemplateMessage(to, templateName, components);
    logger.info('[whatsapp/incoming] Template enviado', { template: templateName, to, wamid });
    return wamid;
  } catch (error) {
    logger.error('[whatsapp/incoming] Falha ao enviar template', { template: templateName, to, error });
    return null;
  }
}

async function sendRedirect(to: string): Promise<void> {
  const components: ITemplateComponent[] = [
    {
      type: 'body',
      parameters: [{ type: 'text', text: CHAT_AI_URL }],
    },
  ];
  await sendTemplateSafe(to, REDIRECT_TEMPLATE, components);
  await markRedirect(to);
}

function matchesKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text === keyword || text.startsWith(`${keyword} `));
}

async function handleVerification(rawText: string, fromPhone: string): Promise<boolean> {
  const codeMatch = rawText.match(/\b([A-Za-z0-9]{6})\b/);
  if (!codeMatch?.[1]) return false;

  const verificationCode = codeMatch[1].toUpperCase();
  const tag = '[whatsapp/incoming][verification]';
  try {
    const user = await User.findOne({ whatsappVerificationCode: verificationCode });
    if (!user) return false;

    const expRaw = user.whatsappVerificationCodeExpiresAt;
    const exp = expRaw instanceof Date ? expRaw : expRaw ? new Date(expRaw) : null;
    if (exp && exp.getTime() <= Date.now()) {
      logger.warn(`${tag} Código expirado para user ${user._id}`);
      user.whatsappVerificationCode = null;
      user.whatsappVerificationCodeExpiresAt = null;
      await user.save();
      await sendTemplateSafe(fromPhone, CODE_EXPIRED_TEMPLATE, [
        {
          type: 'body',
          parameters: [{ type: 'text', text: CHAT_AI_URL }],
        },
      ]);
      return true;
    }

    user.whatsappPhone = fromPhone;
    user.whatsappVerified = true;
    user.whatsappLinkedAt = user.whatsappLinkedAt ?? new Date();
    user.whatsappVerificationCode = null;
    user.whatsappVerificationCodeExpiresAt = null;
    (user as any).whatsappOptOut = false;
    (user as any).whatsappOptOutAt = null;
    await user.save();

    const confirmation =
      `Pronto! Vamos usar este número para enviar alertas. ` +
      `Para falar com a IA, acesse o Chat AI: ${CHAT_AI_URL}`;
    await sendTemplateSafe(fromPhone, CODE_CONFIRMED_TEMPLATE, [
      {
        type: 'body',
        parameters: [{ type: 'text', text: CHAT_AI_URL }],
      },
    ]);
    logger.info(`${tag} Número ${fromPhone} vinculado para o usuário ${user._id}`);
    return true;
  } catch (error) {
    logger.error(`${tag} Erro ao processar verificação:`, error);
    return false;
  }
}

/* ──────────────────────────────────────────────────────────────────
   GET (verificação do webhook)
   ────────────────────────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    logger.error('[whatsapp/incoming GET] WHATSAPP_VERIFY_TOKEN ausente');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (searchParams.get('hub.mode') === 'subscribe' && searchParams.get('hub.verify_token') === verifyToken) {
    logger.debug('[whatsapp/incoming GET] Verification succeeded.');
    return new Response(searchParams.get('hub.challenge') || '', { status: 200 });
  }

  logger.error('[whatsapp/incoming GET] Verification failed', {
    mode: searchParams.get('hub.mode'),
    token_received: searchParams.get('hub.verify_token') ? '******' : 'NONE',
    expected_defined: !!verifyToken,
  });
  return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 });
}

/* ──────────────────────────────────────────────────────────────────
   POST (redirect-only)
   ────────────────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  if (INBOUND_MODE !== 'redirect_only') {
    logger.warn('[whatsapp/incoming POST] WHATSAPP_INBOUND_MODE não está em redirect_only. Forçando redirect-only.');
  }

  let body: any;
  try {
    body = await request.json();
  } catch (error) {
    logger.error('[whatsapp/incoming POST] Erro ao parsear JSON:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { message, isStatusUpdate } = extractSenderAndMessage(body);
  if (!message && !isStatusUpdate) {
    logger.warn('[whatsapp/incoming POST] Payload sem mensagem de texto ou status conhecido.');
    return NextResponse.json({ received_but_not_processed: true }, { status: 200 });
  }

  if (isStatusUpdate) {
    logger.debug('[whatsapp/incoming POST] Atualização de status recebida.');
    return NextResponse.json({ received_status_update: true }, { status: 200 });
  }

  if (await alreadyProcessed(message!.messageId)) {
    logger.info('[whatsapp/incoming POST] Mensagem duplicada ignorada', { messageId: message!.messageId });
    return NextResponse.json({ duplicate: true }, { status: 200 });
  }

  const fromPhone = normalizePhoneNumber(message!.from);
  const rawText = message!.text.trim();
  const normalizedCommand = normalizeCommand(rawText);
  const timestampMs = message!.timestamp ? Number(message!.timestamp) * 1000 : Date.now();

  logger.info('[whatsapp/incoming POST] Mensagem recebida', {
    from: fromPhone,
    messageId: message!.messageId,
    timestamp: new Date(timestampMs).toISOString(),
    char_count: rawText.length,
  });

  await connectToDatabase();

  // Vinculação por código continua permitida, mas com resposta estática (sem IA)
  const verificationHandled = await handleVerification(rawText, fromPhone);
  if (verificationHandled) {
    return NextResponse.json({ verification_processed: true }, { status: 200 });
  }

  let user: IUser | null = null;
  try {
    user = (await loadUserByPhone(fromPhone)) ?? null;
  } catch (error) {
    logger.error('[whatsapp/incoming POST] Erro ao buscar usuário por telefone:', error);
  }

  if (!user) {
    logger.warn('[whatsapp/incoming POST] Nenhum usuário vinculado ao número informado', { fromPhone });
  }

  // Comandos de opt-out / opt-in / help
  if (matchesKeyword(normalizedCommand, OPT_OUT_KEYWORDS)) {
    if (user?._id) {
      await User.updateOne(
        { _id: user._id },
        { $set: { whatsappOptOut: true, whatsappOptOutAt: new Date() } }
      );
    }
    await sendTemplateSafe(fromPhone, OPT_OUT_TEMPLATE, []);
    logger.info('[whatsapp/incoming POST] Opt-out registrado', { fromPhone, userId: user?._id });
    return NextResponse.json({ opt_out: true }, { status: 200 });
  }

  if (matchesKeyword(normalizedCommand, OPT_IN_KEYWORDS)) {
    if (user?._id) {
      await User.updateOne(
        { _id: user._id },
        { $set: { whatsappOptOut: false, whatsappOptOutAt: null } }
      );
    }
    await sendTemplateSafe(fromPhone, OPT_IN_TEMPLATE, []);
    logger.info('[whatsapp/incoming POST] Opt-in registrado', { fromPhone, userId: user?._id });
    return NextResponse.json({ opt_in: true }, { status: 200 });
  }

  if (matchesKeyword(normalizedCommand, HELP_KEYWORDS)) {
    await sendTemplateSafe(fromPhone, HELP_TEMPLATE, [
      {
        type: 'body',
        parameters: [{ type: 'text', text: CHAT_AI_URL }],
      },
    ]);
    logger.info('[whatsapp/incoming POST] Ajuda enviada', { fromPhone, userId: user?._id });
    return NextResponse.json({ help_sent: true }, { status: 200 });
  }

  if (user?.whatsappOptOut) {
    logger.info('[whatsapp/incoming POST] Usuário em opt-out, nenhuma resposta enviada', { fromPhone, userId: user._id });
    return NextResponse.json({ opt_out_active: true }, { status: 200 });
  }

  if (await hasRecentRedirect(fromPhone)) {
    logger.info('[whatsapp/incoming POST] Rate limit de redirect ativo', { fromPhone });
    return NextResponse.json({ redirect_suppressed_rate_limited: true }, { status: 200 });
  }

  await sendRedirect(fromPhone);

  if (user?._id) {
    try {
      await User.updateOne({ _id: user._id }, { $set: { whatsappLastRedirectAt: new Date() } });
    } catch (error) {
      logger.error('[whatsapp/incoming POST] Falha ao salvar whatsappLastRedirectAt', { userId: user._id, error });
    }
  }

  return NextResponse.json({ redirect_sent: true }, { status: 200 });
}
