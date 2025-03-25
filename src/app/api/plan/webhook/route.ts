import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho conforme necessário
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import mercadopago from "@/app/lib/mercadopago";
import User from "@/app/models/User";

export const runtime = "nodejs";

/**
 * POST /api/plan/webhook
 * Webhook do Mercado Pago para notificar sobre pagamentos.
 * Geralmente, webhooks não exigem sessão, mas aqui ilustramos o uso opcional de getServerSession.
 */
export async function POST(request: NextRequest) {
  try {
    // 1) (Opcional) Obter sessão do NextAuth para debug ou controle de admin
    const session = await getServerSession({ req: request, ...authOptions });
    console.debug("[plan/webhook] Sessão opcional retornada:", session);

    // 2) Conecta ao banco
    await connectToDatabase();

    // 3) Lê o corpo da requisição (JSON enviado pelo Mercado Pago)
    const body = await request.json();
    console.debug("[plan/webhook] Corpo recebido:", JSON.stringify(body, null, 2));

    // 4) Verifica se a notificação possui 'data.id'; se não, trata como simulação.
    if (!body.data || !body.data.id) {
      console.debug("[plan/webhook] Notificação sem 'data.id' - possivelmente simulação.");
      return NextResponse.json({ received: true, simulation: true }, { status: 200 });
    }

    // 5) Se o tipo não for "payment", ignoramos a notificação
    if (body.type !== "payment") {
      console.debug(`[plan/webhook] Notificação ignorada. Tipo recebido: ${body.type}`);
      return NextResponse.json({ received: true, nonPayment: true }, { status: 200 });
    }

    // 6) Extrai o ID do pagamento e obtém os detalhes via SDK do MP
    const paymentId = body.data.id;
    const paymentResponse = await mercadopago.payment.get(paymentId);
    const paymentDetails = paymentResponse.body;
    console.debug("[plan/webhook] Detalhes do pagamento:", paymentDetails);

    // 7) Valida o campo external_reference (deve ser o _id do usuário)
    const externalReference = paymentDetails.external_reference;
    if (!externalReference) {
      console.debug("[plan/webhook] Detalhes do pagamento sem 'external_reference' (modo teste?)");
      return NextResponse.json({ received: true, noExternalRef: true }, { status: 200 });
    }
    if (!mongoose.isValidObjectId(externalReference)) {
      console.error(`[plan/webhook] Referência externa inválida: ${externalReference}`);
      return NextResponse.json({ error: "Referência externa inválida." }, { status: 200 });
    }

    // 8) Busca o usuário pelo external_reference
    const user = await User.findById(externalReference);
    if (!user) {
      console.error(`[plan/webhook] Usuário não encontrado para externalReference=${externalReference}`);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 200 });
    }

    // 9) Se o pagamento for aprovado, ativa o plano e processa comissão do afiliado
    if (paymentDetails.status === "approved") {
      user.planStatus = "active";
      user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Plano ativo por 30 dias

      // 10) Se houver cupom de afiliado, credita comissão de 10%
      if (user.affiliateUsed) {
        const affUser = await User.findOne({ affiliateCode: user.affiliateUsed });
        if (affUser) {
          const commissionRate = 0.1;
          const transactionAmount = paymentDetails.transaction_amount || 0;
          const commission = transactionAmount * commissionRate;

          affUser.affiliateBalance = (affUser.affiliateBalance || 0) + commission;
          affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;

          // Rank up a cada 5 convites
          if (affUser.affiliateInvites % 5 === 0) {
            affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
          }

          await affUser.save();
          console.debug(
            `[plan/webhook] Comissão de R$${commission.toFixed(2)} creditada para afiliado=${affUser._id}`
          );
        }
      }

      await user.save();
      console.debug(
        `[plan/webhook] Plano ativado para userId=${externalReference} (paymentId=${paymentId})`
      );
    } else {
      console.debug(`[plan/webhook] Pagamento com status "${paymentDetails.status}" não aprovado.`);
    }

    // 11) Retorna resposta 200 confirmando o processamento
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("[plan/webhook] Erro em POST /api/plan/webhook:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
