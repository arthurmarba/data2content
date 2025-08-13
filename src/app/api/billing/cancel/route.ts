import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { Stripe } from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession({ req, ...authOptions });
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // VERIFICAÇÃO DE IDEMPOTÊNCIA: Se a assinatura já foi cancelada, retorna sucesso.
    if (user.planStatus === "canceled") {
      return NextResponse.json({
        message:
          "Sua assinatura já foi cancelada. O acesso permanece até o fim do período pago.",
      });
    }

    let subscriptionId = user.stripeSubscriptionId;
    
    // LÓGICA DE AUTO-CORREÇÃO: Se não houver ID da assinatura no DB, busca no Stripe.
    if (!subscriptionId && user.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
      });
      subscriptionId = subs.data[0]?.id;
    }

    if (!subscriptionId) {
      return NextResponse.json({ error: "Assinatura Stripe não encontrada" }, { status: 404 });
    }

    // CANCELAMENTO NO STRIPE: Agenda o cancelamento para o final do período.
    const sub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // ATUALIZAÇÃO NO BANCO DE DADOS
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          // MUDANÇA: Padronizado para 'canceled' para consistência.
          planStatus: "canceled", 
          planInterval:
            sub.items.data[0]?.price.recurring?.interval ?? user.planInterval,
          planExpiresAt: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : user.planExpiresAt,
          stripeSubscriptionId: sub.id,
        },
        // LIMPEZA: Remove erros de pagamento antigos, pois não são mais relevantes.
        $unset: { lastPaymentError: 1 },
      }
    );

    return NextResponse.json({
      message:
        "Renovação cancelada. Seu acesso permanece até o fim do período já pago.",
    });
  } catch (err: any) {
    console.error("[billing/cancel] error:", err);

    // MELHORIA: Tratamento de erro específico do Stripe para mensagens mais claras.
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
    }

    return NextResponse.json({ error: "Ocorreu um erro inesperado ao cancelar a renovação." }, { status: 500 });
  }
}
