// src/app/api/plan/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho conforme necessário
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import mercadopago from "@/app/lib/mercadopago"; // Assume que está configurado
import User from "@/app/models/User";
import crypto from 'crypto'; // Importa módulo crypto do Node.js

export const runtime = "nodejs";

// Variável de ambiente para a chave secreta do webhook
const MERCADOPAGO_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET;

/**
 * Função para validar a assinatura do webhook do Mercado Pago.
 * <<< USA O FORMATO CORRETO DO MANIFEST >>>
 */
function validateWebhookSignature(
    requestHeaders: Headers,
    dataIdFromUrl: string | null, // ID do evento vindo da URL
): { isValid: boolean; timestamp?: string; receivedSignature?: string } { // Retorna mais dados para debug se necessário
    console.log("[validateWebhookSignature] Iniciando validação (v_CorrectManifest)...");

    if (!MERCADOPAGO_WEBHOOK_SECRET) {
        console.error("[validateWebhookSignature] Erro: MERCADOPAGO_WEBHOOK_SECRET não está configurado.");
        return { isValid: false };
    }
    console.log("[validateWebhookSignature] Chave secreta carregada.");

    try {
        // --- Obtenção dos dados necessários ---
        const signatureHeader = requestHeaders.get('x-signature');
        const requestIdHeader = requestHeaders.get('x-request-id'); // <<< OBTÉM x-request-id

        console.log("[validateWebhookSignature] Cabeçalho x-signature:", signatureHeader);
        console.log("[validateWebhookSignature] Cabeçalho x-request-id:", requestIdHeader);
        console.log("[validateWebhookSignature] data.id da URL:", dataIdFromUrl);

        if (!signatureHeader || !requestIdHeader || !dataIdFromUrl) {
             console.warn("[validateWebhookSignature] Dados necessários ausentes (x-signature, x-request-id, ou data.id da URL).");
            return { isValid: false };
        }

        // --- Parse do x-signature ---
        const parts = signatureHeader.split(',').reduce((acc, part) => {
            const [key, value] = part.split('=');
            if (key && value) acc[key.trim()] = value.trim();
            return acc;
        }, {} as { [key: string]: string });

        const timestamp = parts['ts'];
        const receivedSignature = parts['v1']; // Assinatura recebida

        console.log("[validateWebhookSignature] Timestamp (ts):", timestamp);
        console.log("[validateWebhookSignature] Assinatura Recebida (v1):", receivedSignature);

        if (!timestamp || !receivedSignature) {
             console.warn("[validateWebhookSignature] Timestamp (ts) ou assinatura (v1) ausente no cabeçalho parseado.");
            return { isValid: false };
        }

        // --- Preparação do data.id (minúsculas se alfanumérico) ---
        // Simplesmente usando minúsculas por segurança, mesmo que o ID seja numérico no exemplo.
        const processedDataId = dataIdFromUrl.toLowerCase();
        console.log("[validateWebhookSignature] data.id processado (lowercase):", processedDataId);

        // --- Construção da String Base (Manifest) CORRETA ---
        const manifest = `id:${processedDataId};request-id:${requestIdHeader};ts:${timestamp};`; // <<< FORMATO CORRETO
        console.log("[validateWebhookSignature] Manifest construído:", manifest);

        // --- Cálculo da Assinatura Esperada (HMAC-SHA256) ---
        const expectedSignature = crypto
            .createHmac('sha256', MERCADOPAGO_WEBHOOK_SECRET)
            .update(manifest) // <<< ASSINA O MANIFEST CORRETO
            .digest('hex');
        console.log("[validateWebhookSignature] Assinatura esperada calculada:", expectedSignature);

        // --- Comparação Segura ---
        const receivedSignatureBuffer = Buffer.from(receivedSignature, 'hex');
        const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

        if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
             console.warn("[validateWebhookSignature] Tamanho das assinaturas não coincide.");
             return { isValid: false, timestamp, receivedSignature };
        }

        const isValid = crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer);

        if (!isValid) {
             console.warn("[validateWebhookSignature] Assinatura inválida na comparação!");
        } else {
             console.log("[validateWebhookSignature] Assinatura validada com sucesso.");
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
 */
export async function POST(request: NextRequest) {
  console.log("--- [plan/webhook] Nova requisição recebida ---");
  console.log("[plan/webhook] URL da requisição:", request.url); // Log para ver a URL completa com query params

  try {
    // <<< PASSO 0a: Extrair data.id da URL >>>
    const { searchParams } = request.nextUrl; // Usa nextUrl para acessar searchParams
    const dataIdFromUrl = searchParams.get('data.id');
    console.log(`[plan/webhook] Extraído data.id da URL: ${dataIdFromUrl}`);

    // <<< PASSO 0b: Validar Assinatura do Webhook >>>
    console.log("[plan/webhook] Iniciando validação da assinatura...");
    // Passa os headers e o data.id extraído para a função de validação
    // Não precisamos mais clonar ou ler o corpo para a validação em si
    const validationResult = validateWebhookSignature(request.headers, dataIdFromUrl);
    if (!validationResult.isValid) {
        console.error("[plan/webhook] VALIDAÇÃO FALHOU. Retornando 400.");
        return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
    }
    console.log("[plan/webhook] Validação da assinatura OK.");

    // 1) (Opcional) Obter sessão do NextAuth
    // const session = await getServerSession({ req: request, ...authOptions });
    // console.debug("[plan/webhook] Sessão opcional retornada:", session);

    // 2) Conecta ao banco
    await connectToDatabase();
    console.log("[plan/webhook] Conectado ao banco.");

    // 3) Lê o corpo da requisição (JSON) - Agora podemos ler normalmente
    const body = await request.json();
    console.log("[plan/webhook] Corpo JSON parseado:", body);

    // --- Continua com a lógica original (Passos 4 a 11) ---

    // 4) Verifica 'data.id' no CORPO (redundante com a URL, mas mantém por segurança)
    if (!body.data || !body.data.id) {
      console.log("[plan/webhook] Notificação sem 'data.id' no corpo.");
      // Poderia comparar body.data.id com dataIdFromUrl aqui se quisesse
      return NextResponse.json({ received: true, simulation: true }, { status: 200 });
    }
    // Compara ID da URL com ID do corpo (devem ser iguais)
    if (body.data.id !== dataIdFromUrl) {
         console.error(`[plan/webhook] Discrepância entre data.id da URL (${dataIdFromUrl}) e do corpo (${body.data.id})`);
         return NextResponse.json({ error: "Discrepância de ID" }, { status: 400 });
    }


    // 5) Verifica tipo "payment"
    if (body.type !== "payment") {
      console.log(`[plan/webhook] Ignorando tipo: ${body.type}`);
      return NextResponse.json({ received: true, nonPayment: true }, { status: 200 });
    }

    // 6) Obtém detalhes do pagamento (usando o ID validado da URL/corpo)
    const paymentId = body.data.id;
     console.log(`[plan/webhook] Obtendo detalhes do pagamento ID: ${paymentId}`);
    const paymentResponse = await mercadopago.payment.get(paymentId);
    const paymentDetails = paymentResponse.body;
    console.log("[plan/webhook] Detalhes do pagamento obtidos:", paymentDetails);

    // 7) Valida external_reference
    const externalReference = paymentDetails.external_reference;
    if (!externalReference || !mongoose.isValidObjectId(externalReference)) {
      console.error(`[plan/webhook] Referência externa inválida ou ausente: ${externalReference}`);
      return NextResponse.json({ error: "Referência externa inválida." }, { status: 200 });
    }
     console.log(`[plan/webhook] External reference (User ID): ${externalReference}`);

    // 8) Busca o usuário
    const user = await User.findById(externalReference);
    if (!user) {
      console.error(`[plan/webhook] Usuário não encontrado: ${externalReference}`);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 200 });
    }
    console.log(`[plan/webhook] Usuário encontrado: ${user.email}`);

    // Evita reprocessamento
    if (user.planStatus === 'active' && user.lastProcessedPaymentId === paymentId) {
         console.log(`[plan/webhook] Pagamento ${paymentId} já processado. Ignorando.`);
         return NextResponse.json({ received: true, alreadyProcessed: true }, { status: 200 });
    }

    // 9) Processa pagamento aprovado
    if (paymentDetails.status === "approved") {
       console.log(`[plan/webhook] Pagamento ${paymentId} APROVADO. Atualizando usuário ${user._id}`);
      user.planStatus = "active";
      const approvalDate = paymentDetails.date_approved ? new Date(paymentDetails.date_approved) : new Date();
      user.planExpiresAt = new Date(approvalDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias
      user.lastProcessedPaymentId = paymentId;

      // Processa comissão
      if (user.affiliateUsed) {
         console.log(`[plan/webhook] Pagamento usou código de afiliado: ${user.affiliateUsed}`);
        const affUser = await User.findOne({ affiliateCode: user.affiliateUsed });
        if (affUser) {
          const commissionRate = 0.1;
          const transactionAmount = paymentDetails.transaction_amount || 0;
          const commission = transactionAmount * commissionRate;
          affUser.affiliateBalance = (affUser.affiliateBalance || 0) + commission;
          affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;
          if (affUser.affiliateInvites % 5 === 0) {
            affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
          }
          await affUser.save();
          console.log(`[plan/webhook] Comissão de ${commission.toFixed(2)} creditada para afiliado=${affUser._id}. Novo saldo: ${affUser.affiliateBalance.toFixed(2)}`);
        } else {
            console.warn(`[plan/webhook] Afiliado ${user.affiliateUsed} não encontrado.`);
        }
        user.affiliateUsed = undefined; // Limpa código usado
      } else {
          console.log("[plan/webhook] Pagamento sem código de afiliado.");
      }
      await user.save();
      console.log(`[plan/webhook] Plano ativado para userId=${externalReference}. Expira em: ${user.planExpiresAt}`);
    } else {
      console.log(`[plan/webhook] Pagamento não aprovado: ${paymentDetails.status}`);
    }

    // 11) Retorna 200 OK
    console.log("[plan/webhook] Processamento concluído com sucesso. Retornando 200.");
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: unknown) {
    console.error("[plan/webhook] Erro GERAL em POST /api/plan/webhook:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Erro interno: ${message}` }, { status: 200 }); // Retorna 200 para MP não reenviar
  }
}
