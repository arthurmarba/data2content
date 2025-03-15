import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import mercadopago from "@/app/lib/mercadopago";
import User from "@/app/models/User";

// Garante que essa rota use Node.js em vez de Edge
export const runtime = "nodejs";

/**
 * POST /api/plan/webhook
 * Webhook do Mercado Pago para notificar sobre pagamentos.
 */
export async function POST(request: NextRequest) {
  try {
    // 1) Conecta ao banco
    await connectToDatabase();

    // 2) Lê o corpo da requisição
    const body = await request.json();
    console.log("Plan Webhook - body:", JSON.stringify(body, null, 2));

    // 3) Verifica se é simulação ou se não há 'data.id'
    if (!body.data || !body.data.id) {
      console.log("Notificação sem 'data.id' - possivelmente simulação.");
      return NextResponse.json({ received: true, simulation: true }, { status: 200 });
    }

    // 4) Se não for "payment", ignoramos
    if (body.type !== "payment") {
      console.log(`Notificação de tipo diferente: ${body.type}`);
      return NextResponse.json({ received: true, nonPayment: true }, { status: 200 });
    }

    // 5) Extrai o ID do pagamento e busca detalhes no Mercado Pago
    const paymentId = body.data.id;
    const paymentResponse = await mercadopago.payment.get(paymentId);
    const paymentDetails = paymentResponse.body; // Em algumas versões, use paymentResponse.response

    // 6) Valida external_reference (deve ser o _id do User)
    const externalReference = paymentDetails.external_reference;
    if (!externalReference) {
      console.log("Payment details sem 'external_reference'. (Modo teste?)");
      return NextResponse.json({ received: true, noExternalRef: true }, { status: 200 });
    }
    if (!mongoose.isValidObjectId(externalReference)) {
      console.log(`Referência externa inválida: ${externalReference}`);
      return NextResponse.json({ error: "Referência externa inválida." }, { status: 200 });
    }

    // 7) Busca o usuário
    const user = await User.findById(externalReference);
    if (!user) {
      console.log(`Usuário não encontrado para externalReference=${externalReference}`);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 200 });
    }

    // 8) Se o pagamento for aprovado, ativa o plano
    if (paymentDetails.status === "approved") {
      // Ex.: plano ativo por +30 dias
      user.planStatus = "active";
      user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // 9) Se tiver afiliado, credita comissão (10% do valor pago)
      if (user.affiliateUsed) {
        const affUser = await User.findOne({ affiliateCode: user.affiliateUsed });
        if (affUser) {
          const commissionRate = 0.1; // 10%
          const transactionAmount = paymentDetails.transaction_amount || 0;
          const commission = transactionAmount * commissionRate;

          // Soma ao saldo do afiliado
          affUser.affiliateBalance = (affUser.affiliateBalance || 0) + commission;
          // Atualiza contagem de convites
          affUser.affiliateInvites = (affUser.affiliateInvites || 0) + 1;

          // Exemplo: rank up a cada 5 convites
          if (affUser.affiliateInvites % 5 === 0) {
            affUser.affiliateRank = (affUser.affiliateRank || 1) + 1;
          }

          await affUser.save();
          console.log(`Comissão de R$${commission.toFixed(2)} creditada para afiliado=${affUser._id}`);
        }
      }

      await user.save();
      console.log(`Plano ativado para userId=${externalReference} (paymentId=${paymentId})`);
    } else {
      console.log(`Pagamento status="${paymentDetails.status}" não aprovado.`);
    }

    // 10) Retorna 200 para confirmar o processamento
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: unknown) {
    console.error("Erro em POST /api/plan/webhook:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
