// src/app/api/plan/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
// getServerSession e authOptions não são usados neste arquivo, podem ser removidos se não houver planos futuros para eles aqui.
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import mercadopago from "@/app/lib/mercadopago";
import User, { ICommissionLogEntry } from "@/app/models/User";
import { ANNUAL_MONTHLY_PRICE } from "@/config/pricing.config";
import crypto from "crypto";

export const runtime = "nodejs";
const isProd = process.env.NODE_ENV === "production";

const MERCADOPAGO_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET;

const toCents = (v: number) => Math.round(v * 100);
const fromCents = (c: number) => Number((c / 100).toFixed(2));

function validateWebhookSignature(
    requestHeaders: Headers,
    dataIdFromUrl: string | null,
): { isValid: boolean; timestamp?: string; receivedSignature?: string } {
    // console.log("[validateWebhookSignature] Iniciando validação (v_CorrectManifest)...");

    if (!MERCADOPAGO_WEBHOOK_SECRET) {
        if (!isProd)
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

        const manifest = `id:${dataIdFromUrl};request-id:${requestIdHeader};ts:${timestamp};`;
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
        if (!isProd)
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
  if (!isProd) {
    console.debug("--- [plan/webhook] Nova requisição recebida ---");
    // console.debug("[plan/webhook] URL da requisição:", request.url);
  }

  try {
    const { searchParams } = request.nextUrl;
    const dataIdFromUrl = searchParams.get('data.id');
    // console.log(`[plan/webhook] Extraído data.id da URL: ${dataIdFromUrl}`);

    // console.log("[plan/webhook] Iniciando validação da assinatura...");
    const validationResult = validateWebhookSignature(request.headers, dataIdFromUrl);
    if (!validationResult.isValid) {
        if (!isProd) console.error("[plan/webhook] VALIDAÇÃO FALHOU. Retornando 400.");
        return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
    }
    // console.log("[plan/webhook] Validação da assinatura OK.");

    await connectToDatabase();
    // console.log("[plan/webhook] Conectado ao banco.");

    const body = await request.json();
    if (!isProd) {
      // Log básico do tipo e dados recebidos
      console.debug("[plan/webhook] type:", body.type, "data:", body.data);
    }

    if (!body.data || !body.data.id) {
      // console.log("[plan/webhook] Notificação sem 'data.id' no corpo.");
      return NextResponse.json({ received: true, simulation: true }, { status: 200 });
    }
    if (body.data.id !== dataIdFromUrl) {
        //  console.error(`[plan/webhook] Discrepância entre data.id da URL (${dataIdFromUrl}) e do corpo (${body.data.id})`);
         return NextResponse.json({ error: "Discrepância de ID" }, { status: 400 });
    }

    const eventType = body.type;

    // Eventos de pagamento aprovados ou rejeitados
    if (eventType === "payment") {
      try {
        const paymentId = body?.data?.id;
        if (!paymentId) {
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const { body: p } = await mercadopago.payment.get(paymentId);

        // Se rejeitado/refundado/chargeback, salva último erro
        if (["rejected", "refunded", "cancelled", "charged_back"].includes(p.status)) {
          const userByPreapproval = p.preapproval_id
            ? await User.findOne({ paymentGatewaySubscriptionId: p.preapproval_id })
            : null;
          const user =
            userByPreapproval || (p.external_reference ? await User.findById(p.external_reference) : null);

          if (user) {
            user.lastPaymentError = {
              at: new Date(),
              paymentId: String(p.id),
              status: String(p.status),
              statusDetail: String(p.status_detail || "unknown"),
            };
            user.planStatus = "inactive";
            await user.save();
          }
          return NextResponse.json({ received: true, noted: "payment-rejected" }, { status: 200 });
        }

        // Ativar plano quando aprovado/accredited
        if (p.status === "approved" || p.status_detail === "accredited") {
          const userByPreapproval = p.preapproval_id
            ? await User.findOne({ paymentGatewaySubscriptionId: p.preapproval_id })
            : null;
          const user =
            userByPreapproval || (p.external_reference ? await User.findById(p.external_reference) : null);

          if (!user) {
            return NextResponse.json({ received: true }, { status: 200 });
          }

          const eventId = String(p.id);
          if (user.lastProcessedPaymentId === eventId) {
            return NextResponse.json({ received: true, alreadyProcessed: true }, { status: 200 });
          }

          const now = new Date();

          if (p.metadata?.planType === "annual_upfront") {
            // fluxo para pagamento anual à vista
            user.planStatus = "active";
            const annualExpire = new Date(now);
            annualExpire.setFullYear(annualExpire.getFullYear() + 1);
            user.planExpiresAt = annualExpire;
            user.lastPaymentError = undefined;
            user.lastProcessedPaymentId = eventId;

            if (user.pendingAgency) {
              user.agency = user.pendingAgency;
              user.pendingAgency = null;
              user.role = "guest";
            }

            // Comissão única sobre o total anual (já com desconto)
            if (user.affiliateUsed) {
              const affUser = await User.findOne({ affiliateCode: user.affiliateUsed });
              if (affUser) {
                const baseCents =
                  p.metadata?.commission_base_cents ?? Math.round((p.transaction_amount || 0) * 100);
                const commission = (baseCents / 100) * 0.1;

                affUser.affiliateBalance = (affUser.affiliateBalance || 0) + commission;
                affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;
                if (affUser.affiliateInvites % 5 === 0) {
                  affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
                }
                affUser.commissionLog = affUser.commissionLog || [];
                affUser.commissionLog.push({
                  date: new Date(),
                  amount: commission,
                  description: `Comissão (plano anual) de ${user.email || user._id}`,
                  sourcePaymentId: eventId,
                  referredUserId: user._id,
                });
                await affUser.save();
              }
              user.affiliateUsed = undefined; // não pagar comissão na renovação
            }

            // cria preapproval para renovação anual
            try {
              const renewFullCents =
                p.metadata?.renew_full_cents ?? toCents(ANNUAL_MONTHLY_PRICE * 12);
              const renewalStart = new Date(now);
              renewalStart.setFullYear(renewalStart.getFullYear() + 1);
              const preapproval = await mercadopago.preapproval.create({
                reason: "Plano Anual (renovação anual)",
                external_reference: user._id.toString(),
                payer_email: user.email,
                auto_recurring: {
                  frequency: 12,
                  frequency_type: "months",
                  transaction_amount: fromCents(renewFullCents),
                  currency_id: "BRL",
                  start_date: renewalStart.toISOString(),
                },
              } as any);
              user.paymentGatewaySubscriptionId = preapproval.body.id;
            } catch (e) {
              if (!isProd) console.error("[annual-renewal preapproval] erro:", e);
            }

            await user.save();
            return NextResponse.json(
              { received: true, activatedOn: "payment.annual_upfront" },
              { status: 200 },
            );
          }

          // fluxo padrão (mensal)
          user.planStatus = "active";
          const monthlyExpire = new Date(now);
          monthlyExpire.setMonth(monthlyExpire.getMonth() + 1);
          user.planExpiresAt = monthlyExpire;
          user.lastPaymentError = undefined;
          user.lastProcessedPaymentId = eventId;

          if (user.pendingAgency) {
            user.agency = user.pendingAgency;
            user.pendingAgency = null;
            user.role = "guest";
          }

          if (user.affiliateUsed) {
            try {
              const affUser = await User.findOne({ affiliateCode: user.affiliateUsed });
              if (affUser) {
                const commissionRate = 0.1;
                const amount = Number(p.transaction_amount || 0);
                const commission = amount * commissionRate;

                affUser.affiliateBalance = (affUser.affiliateBalance || 0) + commission;
                affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;
                if (affUser.affiliateInvites % 5 === 0 && affUser.affiliateInvites > 0) {
                  affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
                }
                affUser.commissionLog = affUser.commissionLog || [];
                affUser.commissionLog.push({
                  date: new Date(),
                  amount: commission,
                  description: `Comissão (1ª cobrança) de ${user.email || user._id}`,
                  sourcePaymentId: eventId,
                  referredUserId: user._id,
                });
                await affUser.save();
              }
            } finally {
              user.affiliateUsed = undefined;
            }
          }

          await user.save();
          return NextResponse.json({ received: true, activatedOn: "payment.approved" }, { status: 200 });
        }

        return NextResponse.json({ received: true, paymentStatus: p.status }, { status: 200 });
      } catch (e) {
        if (!isProd) console.error("[webhook/payment] erro:", e);
        return NextResponse.json({ received: true }, { status: 200 });
      }
    }

    // authorized_payment -> renovar assinatura + comissão na 1ª cobrança
    if (eventType === "authorized_payment") {
      let preapprovalId =
        body.data?.subscription_id ||
        body.data?.preapproval_id ||
        body.data?.preapproval?.id ||
        body.data?.id ||
        null;

      if (!preapprovalId && body.data?.payment_id) {
        try {
          const { body: p } = await mercadopago.payment.get(body.data.payment_id);
          preapprovalId = p?.preapproval_id || p?.metadata?.preapproval_id || null;
        } catch {}
      }

      if (!preapprovalId) {
        return NextResponse.json({ error: "preapproval_id ausente" }, { status: 200 });
      }

      const user = await User.findOne({ paymentGatewaySubscriptionId: preapprovalId });
      if (!user) {
        return NextResponse.json({ received: true }, { status: 200 });
      }

      const eventId = String(body.data.id);
      if (user.lastProcessedPaymentId === eventId) {
        return NextResponse.json({ received: true, alreadyProcessed: true }, { status: 200 });
      }

      const now = new Date();
      const expires = new Date(now);
      if (user.planType === "annual") {
        expires.setFullYear(expires.getFullYear() + 1);
      } else {
        expires.setMonth(expires.getMonth() + 1);
      }
      user.planExpiresAt = expires;
      user.planStatus = "active";

      if (user.pendingAgency) {
        user.agency = user.pendingAgency;
        user.pendingAgency = null;
        user.role = "guest";
      }

      if (user.affiliateUsed) {
        const affUser = await User.findOne({ affiliateCode: user.affiliateUsed });
        if (affUser) {
          const commissionRate = 0.1;
          let transactionAmount = body.data?.transaction_amount || 0;

          if (!transactionAmount && body.data?.payment_id) {
            try {
              const paymentResp = await mercadopago.payment.get(body.data.payment_id);
              transactionAmount = paymentResp.body?.transaction_amount || 0;
            } catch {}
          }

          const commission = transactionAmount * commissionRate;

          affUser.affiliateBalance = (affUser.affiliateBalance || 0) + commission;
          affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;
          if (affUser.affiliateInvites % 5 === 0 && affUser.affiliateInvites > 0) {
            affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
          }

          const commissionEntry: ICommissionLogEntry = {
            date: new Date(),
            amount: commission,
            description: `Comissão (1ª cobrança) de ${user.email || user._id.toString()}`,
            sourcePaymentId: eventId.toString(),
            referredUserId: user._id,
          };
          if (!Array.isArray(affUser.commissionLog)) {
            affUser.commissionLog = [];
          }
          affUser.commissionLog.push(commissionEntry);
          await affUser.save();
        }
        user.affiliateUsed = undefined;
      }

      user.lastPaymentError = undefined;
      user.lastProcessedPaymentId = eventId;
      await user.save();
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // plan/preapproval/subscription_preapproval -> update status only
    if (
      eventType === "subscription_preapproval" ||
      eventType === "preapproval" ||
      eventType === "plan"
    ) {
      const subscriptionId = body.data?.subscription_id || body.data?.id;
      if (!subscriptionId) {
        return NextResponse.json({ error: "subscription_id ausente" }, { status: 200 });
      }

      const user = await User.findOne({ paymentGatewaySubscriptionId: subscriptionId });
      if (!user) {
        return NextResponse.json({ received: true }, { status: 200 });
      }

      const eventId = String(body.data.id);
      if (user.lastProcessedPaymentId === eventId) {
        return NextResponse.json({ received: true, alreadyProcessed: true }, { status: 200 });
      }

      const status = body.data.status;
      if (status === "authorized" || status === "active") {
        user.planStatus = "active";
      } else if (status === "cancelled") {
        user.planStatus = "non_renewing";
      } else if (status === "paused" || status === "suspended") {
        user.planStatus = "inactive";
      }

      user.lastProcessedPaymentId = eventId;
      await user.save();
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Tipo de evento não tratado
    return NextResponse.json({ received: true, nonPayment: true }, { status: 200 });

  } catch (error: unknown) {
    if (!isProd) console.error("[plan/webhook] Erro GERAL em POST /api/plan/webhook:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Erro interno: ${message}` }, { status: 200 });
  }
}
