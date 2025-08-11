import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";

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

    if (user.planStatus === "non_renewing") {
      return NextResponse.json({
        message:
          "Renovação cancelada. Seu acesso permanece até o fim do período já pago.",
      });
    }

    let subscriptionId = user.stripeSubscriptionId;
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

    const sub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          planStatus: "non_renewing",
          planInterval:
            sub.items.data[0]?.price.recurring?.interval ?? user.planInterval,
          planExpiresAt: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : user.planExpiresAt,
          stripeSubscriptionId: sub.id,
        },
        $unset: { lastPaymentError: 1 },
      }
    );

    return NextResponse.json({
      message:
        "Renovação cancelada. Seu acesso permanece até o fim do período já pago.",
    });
  } catch (err: any) {
    console.error("[billing/cancel] error:", err);
    return NextResponse.json({ error: err?.message || "Erro ao cancelar renovação" }, { status: 500 });
  }
}

