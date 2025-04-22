// src/app/api/whatsapp/incoming/route.ts - v1.6 (Final)

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/app/lib/helpers';
import { connectToDatabase } from '@/app/lib/mongoose';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { getConsultantResponse } from '@/app/lib/consultantService';
import { UserNotFoundError } from '@/app/lib/errors';
import { logger } from '@/app/lib/logger'; // Usar logger importado

// Remover listeners globais em produção ou configurá-los adequadamente
// process.on('unhandledRejection', ...);
// process.on('uncaughtException', ...);

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
    token_received: searchParams.get('hub.verify_token') ? '******' : 'NONE', // Não logar token recebido
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
 * Acknowledge immediately, then process in background.
 */
export async function POST(request: NextRequest) {
  const postTag = '[whatsapp/incoming POST v1.6]'; // Atualiza tag
  let body: any;

  try {
    await connectToDatabase(); // Garante conexão antes de qualquer operação de DB
    body = await request.json();
  } catch (error) {
    logger.error(`${postTag} Erro ao parsear JSON ou conectar ao DB:`, error);
    return NextResponse.json({ error: 'Invalid request body or DB connection failed' }, { status: 400 });
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

  // Se chegou aqui, é uma mensagem válida (senderAndMsg não é null)
  const immediateAck = NextResponse.json({ received_message: true }, { status: 200 });

  // Processa a mensagem em background usando IIFE
  // Não usar await aqui para retornar o ACK imediatamente
  (async () => {
    const bgTag = '[whatsapp/incoming][bg v1.6]'; // Atualiza tag
    try {
      // Garante que senderAndMsg não é null
      if (!senderAndMsg) {
           logger.error(`${bgTag} Erro crítico: senderAndMsg é null dentro do IIFE.`);
           return;
      };

      const phone = normalizePhoneNumber(senderAndMsg.from);
      const text = senderAndMsg.text.trim();
      logger.info(`${bgTag} Processando de: ${phone}, Texto: "${text.slice(0, 50)}..."`);

      // Lógica de verificação de código (6 caracteres)
      const codeMatch = text.match(/^\s*([A-Z0-9]{6})\s*$/);
      if (codeMatch && codeMatch[1]) {
        const verificationCode = codeMatch[1];
        logger.debug(`${bgTag} Código de verificação detectado: ${verificationCode}`);
        const { default: User } = await import('@/app/models/User');

        const user = await User.findOne({ whatsappVerificationCode: verificationCode });
        let reply = 'Código inválido ou expirado. Verifique o código no seu perfil ou gere um novo.';
        if (user) {
          if (user.planStatus === 'active') {
            user.whatsappPhone = phone;
            user.whatsappVerificationCode = null;
            // --- LINHA DESCOMENTADA ---
            // Lembre-se: 'whatsappVerified' precisa existir no Schema/Interface User
            user.whatsappVerified = true;
            // --- FIM ---
            await user.save();
            reply = `Olá ${user.name || ''}! Seu número de WhatsApp foi vinculado com sucesso à sua conta.`;
            logger.info(`${bgTag} Número ${phone} vinculado ao usuário ${user._id}.`);
          } else {
            reply = `Olá ${user.name || ''}. Encontramos seu código, mas seu plano (${user.planStatus}) não está ativo. Ative seu plano para vincular o WhatsApp.`;
            logger.warn(`${bgTag} Usuário ${user._id} tentou vincular com plano ${user.planStatus}.`);
          }
        } else {
            logger.warn(`${bgTag} Código de verificação ${verificationCode} não encontrado.`);
        }
        await sendWhatsAppMessage(phone, reply);
        logger.debug(`${bgTag} Resposta de verificação enviada para ${phone}.`);
        return;
      }

      // Lógica para pedido de relatório fora de sexta-feira
      const lowerText = text.toLowerCase();
      const isReportRequest = lowerText.includes('relatório') || lowerText.includes('relatorio');
      const today = new Date();
      const isFriday = today.getDay() === 5; // 0=Dom, 5=Sex

      if (isReportRequest && !isFriday) {
        logger.debug(`${bgTag} Pedido de relatório detectado fora de sexta-feira.`);
        await sendWhatsAppMessage(
          phone,
          'Olá! O relatório semanal completo é gerado e enviado automaticamente às sextas-feiras. Se precisar de alguma análise específica antes disso, pode me pedir!'
        );
        logger.debug(`${bgTag} Resposta sobre relatório fora do dia enviada para ${phone}.`);
        return;
      }

      // Chama o consultor
      logger.debug(`${bgTag} Chamando getConsultantResponse para "${text.slice(0, 50)}"...`);
      const responseText = await getConsultantResponse(phone, text);

      logger.debug(`${bgTag} Enviando resposta (${responseText.length} chars) do consultor para ${phone}.`);
      await sendWhatsAppMessage(phone, responseText);
      logger.info(`${bgTag} Resposta do consultor enviada com sucesso para ${phone}.`);

    } catch (err) {
      logger.error(`${bgTag} Erro durante processamento background:`, err);
      // Envio de mensagem de erro genérica (exceto UserNotFound)
      if (!(err instanceof UserNotFoundError) && senderAndMsg?.from) {
         try {
           const phone = normalizePhoneNumber(senderAndMsg.from);
           await sendWhatsAppMessage(phone, "Desculpe, ocorreu um erro interno ao processar sua mensagem. A equipe já foi notificada. Tente novamente mais tarde.");
         } catch (sendError) {
           logger.error(`${bgTag} Falha ao enviar mensagem de erro para o usuário:`, sendError);
         }
      } else if (err instanceof UserNotFoundError) {
          logger.warn(`${bgTag} Erro UserNotFoundError tratado, mensagem específica já foi enviada por consultantService.`);
      }
    }
  // O .catch() aqui pega erros da própria execução da IIFE (raro, mas possível)
  })().catch(iifeError => {
      logger.error(`${postTag} Erro NÃO TRATADO na execução do IIFE:`, iifeError);
  });

  // Retorna a confirmação imediata para a Meta
  return immediateAck;
}
