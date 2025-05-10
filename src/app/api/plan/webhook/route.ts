// src/app/api/plan/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
// getServerSession e authOptions não são usados neste arquivo, podem ser removidos se não houver planos futuros para eles aqui.
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose, { Types } from "mongoose"; // Types importado para referredUserId
import { connectToDatabase } from "@/app/lib/mongoose";
import mercadopago from "@/app/lib/mercadopago";
import User, { IUser, ICommissionLogEntry } from "@/app/models/User"; // IUser e ICommissionLogEntry importados
import crypto from 'crypto';

export const runtime = "nodejs";

const MERCADOPAGO_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET;

function validateWebhookSignature(
    requestHeaders: Headers,
    dataIdFromUrl: string | null,
): { isValid: boolean; timestamp?: string; receivedSignature?: string } {
    // console.log("[validateWebhookSignature] Iniciando validação (v_CorrectManifest)...");

    if (!MERCADOPAGO_WEBHOOK_SECRET) {
        console.error("[validateWebhookSignature] Erro: MERCADOPAGO_WEBHOOK_SECRET não está configurado.");
        return { isValid: false };
    }
    // console.log("[validateWebhookSignature] Chave secreta carregada.");

    try {
        const signatureHeader = requestHeaders.get('x-signature');
        const requestIdHeader = requestHeaders.get('x-request-id');

        // console.log("[validateWebhookSignature] Cabeçalho x-signature:", signatureHeader);
        // console.log("[validateWebhookSignature] Cabeçalho x-request-id:", requestIdHeader);
        // console.log("[validateWebhookSignature] data.id da URL:", dataIdFromUrl);

        if (!signatureHeader || !requestIdHeader || !dataIdFromUrl) {
            //  console.warn("[validateWebhookSignature] Dados necessários ausentes (x-signature, x-request-id, ou data.id da URL).");
            return { isValid: false };
        }

        const parts = signatureHeader.split(',').reduce((acc, part) => {
            const [key, value] = part.split('=');
            if (key && value) acc[key.trim()] = value.trim();
            return acc;
        }, {} as { [key: string]: string });

        const timestamp = parts['ts'];
        const receivedSignature = parts['v1'];

        // console.log("[validateWebhookSignature] Timestamp (ts):", timestamp);
        // console.log("[validateWebhookSignature] Assinatura Recebida (v1):", receivedSignature);

        if (!timestamp || !receivedSignature) {
            //  console.warn("[validateWebhookSignature] Timestamp (ts) ou assinatura (v1) ausente no cabeçalho parseado.");
            return { isValid: false };
        }

        const processedDataId = dataIdFromUrl.toLowerCase();
        // console.log("[validateWebhookSignature] data.id processado (lowercase):", processedDataId);

        const manifest = `id:${processedDataId};request-id:${requestIdHeader};ts:${timestamp};`;
        // console.log("[validateWebhookSignature] Manifest construído:", manifest);

        const expectedSignature = crypto
            .createHmac('sha256', MERCADOPAGO_WEBHOOK_SECRET)
            .update(manifest)
            .digest('hex');
        // console.log("[validateWebhookSignature] Assinatura esperada calculada:", expectedSignature);

        const receivedSignatureBuffer = Buffer.from(receivedSignature, 'hex');
        const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

        if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
            //  console.warn("[validateWebhookSignature] Tamanho das assinaturas não coincide.");
             return { isValid: false, timestamp, receivedSignature };
        }

        const isValid = crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer);

        if (!isValid) {
            //  console.warn("[validateWebhookSignature] Assinatura inválida na comparação!");
        } else {
            //  console.log("[validateWebhookSignature] Assinatura validada com sucesso.");
        }
        return { isValid, timestamp, receivedSignature };
    } catch (error) {
        console.error("[validateWebhookSignature] Erro inesperado durante a validação:", error);
        return { isValid: false };
    }
}

/**
 * POST /api/plan/webhook
 * Webhook do Mercado Pago para notificar sobre pagamentos.
 * ATUALIZADO: Adiciona entrada ao commissionLog do afiliado.
 */
export async function POST(request: NextRequest) {
  console.log("--- [plan/webhook] Nova requisição recebida ---");
  // console.log("[plan/webhook] URL da requisição:", request.url);

  try {
    const { searchParams } = request.nextUrl;
    const dataIdFromUrl = searchParams.get('data.id');
    // console.log(`[plan/webhook] Extraído data.id da URL: ${dataIdFromUrl}`);

    // console.log("[plan/webhook] Iniciando validação da assinatura...");
    const validationResult = validateWebhookSignature(request.headers, dataIdFromUrl);
    if (!validationResult.isValid) {
        console.error("[plan/webhook] VALIDAÇÃO FALHOU. Retornando 400.");
        return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
    }
    // console.log("[plan/webhook] Validação da assinatura OK.");

    await connectToDatabase();
    // console.log("[plan/webhook] Conectado ao banco.");

    const body = await request.json();
    // console.log("[plan/webhook] Corpo JSON parseado:", body);

    if (!body.data || !body.data.id) {
      // console.log("[plan/webhook] Notificação sem 'data.id' no corpo.");
      return NextResponse.json({ received: true, simulation: true }, { status: 200 });
    }
    if (body.data.id !== dataIdFromUrl) {
        //  console.error(`[plan/webhook] Discrepância entre data.id da URL (${dataIdFromUrl}) e do corpo (${body.data.id})`);
         return NextResponse.json({ error: "Discrepância de ID" }, { status: 400 });
    }

    if (body.type !== "payment") {
      // console.log(`[plan/webhook] Ignorando tipo: ${body.type}`);
      return NextResponse.json({ received: true, nonPayment: true }, { status: 200 });
    }

    const paymentId = body.data.id;
    //  console.log(`[plan/webhook] Obtendo detalhes do pagamento ID: ${paymentId}`);
    const paymentResponse = await mercadopago.payment.get(paymentId);
    const paymentDetails = paymentResponse.body;
    // console.log("[plan/webhook] Detalhes do pagamento obtidos:", paymentDetails);

    const externalReference = paymentDetails.external_reference;
    if (!externalReference || !mongoose.isValidObjectId(externalReference)) {
      console.error(`[plan/webhook] Referência externa inválida ou ausente: ${externalReference}`);
      return NextResponse.json({ error: "Referência externa inválida." }, { status: 200 });
    }
    //  console.log(`[plan/webhook] External reference (User ID): ${externalReference}`);

    const user = await User.findById(externalReference) as IUser | null; // Tipagem explícita
    if (!user) {
      console.error(`[plan/webhook] Usuário não encontrado: ${externalReference}`);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 200 });
    }
    // console.log(`[plan/webhook] Usuário encontrado: ${user.email}`);

    if (user.planStatus === 'active' && user.lastProcessedPaymentId === paymentId) {
        //  console.log(`[plan/webhook] Pagamento ${paymentId} já processado. Ignorando.`);
         return NextResponse.json({ received: true, alreadyProcessed: true }, { status: 200 });
    }

    if (paymentDetails.status === "approved") {
    //   console.log(`[plan/webhook] Pagamento ${paymentId} APROVADO. Atualizando usuário ${user._id}`);
      user.planStatus = "active";
      const approvalDate = paymentDetails.date_approved ? new Date(paymentDetails.date_approved) : new Date();
      user.planExpiresAt = new Date(approvalDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias
      user.lastProcessedPaymentId = paymentId;

      // Processa comissão
      if (user.affiliateUsed) {
        //  console.log(`[plan/webhook] Pagamento usou código de afiliado: ${user.affiliateUsed}`);
        const affUser = await User.findOne({ affiliateCode: user.affiliateUsed }) as IUser | null; // Tipagem explícita
        if (affUser) {
          const commissionRate = 0.1; // 10%
          const transactionAmount = paymentDetails.transaction_amount || 0;
          const commission = transactionAmount * commissionRate;

          affUser.affiliateBalance = (affUser.affiliateBalance || 0) + commission;
          affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;
          // A lógica do rank já estava correta
          if (affUser.affiliateInvites % 5 === 0 && affUser.affiliateInvites > 0) { // Garante que não incremente no convite 0
            affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
          }

          // --- INÍCIO: Adicionar entrada ao commissionLog ---
          const commissionEntry: ICommissionLogEntry = {
            date: new Date(), // Data em que a comissão é processada
            amount: commission,
            description: `Comissão pela assinatura de ${user.email || user._id.toString()}`,
            sourcePaymentId: paymentId.toString(),
            referredUserId: user._id, // ID do usuário que fez o pagamento
          };

          // Garante que commissionLog seja um array antes de dar push
          if (!Array.isArray(affUser.commissionLog)) {
            affUser.commissionLog = [];
          }
          affUser.commissionLog.push(commissionEntry);
          // --- FIM: Adicionar entrada ao commissionLog ---

          await affUser.save();
          console.log(`[plan/webhook] Comissão de ${commission.toFixed(2)} creditada para afiliado=${affUser._id}. Log adicionado. Novo saldo: ${affUser.affiliateBalance?.toFixed(2)}`);
        
        } else {
            console.warn(`[plan/webhook] Afiliado ${user.affiliateUsed} não encontrado.`);
        }
        user.affiliateUsed = undefined; // Limpa código usado
      } else {
        //   console.log("[plan/webhook] Pagamento sem código de afiliado.");
      }
      await user.save();
    //   console.log(`[plan/webhook] Plano ativado para userId=${externalReference}. Expira em: ${user.planExpiresAt}`);
    } else {
    //   console.log(`[plan/webhook] Pagamento não aprovado: ${paymentDetails.status}`);
    }

    // console.log("[plan/webhook] Processamento concluído com sucesso. Retornando 200.");
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: unknown) {
    console.error("[plan/webhook] Erro GERAL em POST /api/plan/webhook:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Erro interno: ${message}` }, { status: 200 });
  }
}
