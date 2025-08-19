// src/app/api/whatsapp/process-response/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { logger } from '@/app/lib/logger';
import { handleDailyTip } from './dailyTipHandler';
import { handleUserMessage } from './userMessageHandler';
import { ProcessRequestBody } from './types';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { isActiveLike } from '@/app/lib/isActiveLike';

export const runtime = 'nodejs';

const ROUTE_TAG = '[API Route /process-response]';

// QStash Receiver (inalterado)
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
let receiver: Receiver | null = null;

if (currentSigningKey && nextSigningKey) {
  try {
    receiver = new Receiver({ currentSigningKey, nextSigningKey });
  } catch (e) {
    logger.error(`${ROUTE_TAG} Erro ao inicializar QStash Receiver:`, e);
  }
} else {
  logger.error(`${ROUTE_TAG} Chaves de assinatura QStash não definidas.`);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!receiver) {
    logger.error(`${ROUTE_TAG} QStash Receiver não está inicializado.`);
    return NextResponse.json({ error: 'QStash Receiver not configured or initialization failed' }, { status: 500 });
  }

  let bodyText: string;
  let payload: ProcessRequestBody | undefined = undefined;
  let qstashMessageIdForLog: string | undefined = undefined;

  try {
    bodyText = await request.text();

    const signature = request.headers.get('upstash-signature');
    if (!signature) {
      logger.warn(`${ROUTE_TAG} Cabeçalho de assinatura 'upstash-signature' ausente.`);
      return NextResponse.json({ error: 'Missing QStash signature header' }, { status: 401 });
    }

    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) {
      logger.warn(`${ROUTE_TAG} Assinatura QStash inválida.`);
      return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
    }
    logger.info(`${ROUTE_TAG} Assinatura QStash verificada com sucesso.`);

    try {
      payload = JSON.parse(bodyText) as ProcessRequestBody;
      if (!payload || typeof payload !== 'object' || !payload.userId) {
        logger.error(`${ROUTE_TAG} Payload inválido ou userId ausente. Payload: ${bodyText.slice(0, 500)}`);
        return NextResponse.json({ error: 'Invalid payload structure or missing userId' }, { status: 400 });
      }
      qstashMessageIdForLog = payload.qstashMessageId || `internalNoQId_${payload.userId}_${Date.now()}`;
      logger.info(`${ROUTE_TAG} Processando MsgID: ${qstashMessageIdForLog}, UserID: ${payload.userId}, TaskType: ${payload.taskType || 'user_message'}`);
    } catch (parseError: any) {
      logger.error(`${ROUTE_TAG} Erro ao parsear JSON: ${parseError.message}. Body (início): ${bodyText.slice(0, 200)}`);
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    // --- ✅ Gate de plano + fetch de dados essenciais (inclui IG) ---
    try {
      await connectToDatabase();
      const user = await User.findById(payload.userId)
        .select('_id name planStatus whatsappPhone whatsappVerified isInstagramConnected instagramAccountId')
        .lean<{
          _id: any;
          name?: string;
          planStatus?: string;
          whatsappPhone?: string;
          whatsappVerified?: boolean;
          isInstagramConnected?: boolean;
          instagramAccountId?: string | null;
        }>();

      if (!user) {
        logger.warn(`${ROUTE_TAG} Usuário ${payload.userId} não encontrado (gate de plano).`);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (!isActiveLike(user.planStatus)) {
        const firstName = user.name ? user.name.split(' ')[0] : 'criador';
        const toPhone = payload.fromPhone || (user.whatsappVerified && user.whatsappPhone) || undefined;

        logger.info(`${ROUTE_TAG} Bloqueando processamento: plano ${user.planStatus} para user=${payload.userId}.`);
        if (toPhone) {
          try {
            await sendWhatsAppMessage(
              toPhone,
              `Olá ${firstName}! Seu plano está ${user.planStatus}. Para continuar usando o Mobi, reative sua assinatura em nosso site.`
            );
          } catch (sendErr) {
            logger.error(`${ROUTE_TAG} Falha ao enviar mensagem de plano inativo para ${toPhone}:`, sendErr);
          }
        }

        // Retorna 200 para QStash (considerado processado)
        return NextResponse.json({ plan_inactive: true, userId: String(user._id) }, { status: 200 });
      }

      // 🔹 Garante a flag igConnected no payload (fallback, caso o incoming não tenha enviado)
      if (typeof payload.igConnected === 'undefined') {
        payload.igConnected = Boolean(user.isInstagramConnected && user.instagramAccountId);
        logger.debug(`${ROUTE_TAG} payload.igConnected não informado; preenchido via DB: ${payload.igConnected}`);
      }
    } catch (gateErr) {
      logger.error(`${ROUTE_TAG} Erro no gate de plano / fetch de dados:`, gateErr);
      return NextResponse.json({ error: 'Failed plan gate check' }, { status: 500 });
    }
    // --- Fim do gate ---

    // Delegação
    if (payload.taskType === 'daily_tip') {
      return await handleDailyTip(payload);
    } else {
      return await handleUserMessage(payload);
    }

  } catch (error: any) {
    const topLevelErrorMsgId = qstashMessageIdForLog || 'N/A_NO_PAYLOAD_PARSE';
    logger.error(`${ROUTE_TAG} Erro GERAL não tratado (MsgID: ${topLevelErrorMsgId}):`, error);
    return NextResponse.json({ error: 'Internal server error processing the request at the top level.' }, { status: 500 });
  }
}
