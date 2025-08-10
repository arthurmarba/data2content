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
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: "Assinatura Stripe não encontrada" }, { status: 404 });
    }

    const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Reflete imediatamente na UI
    user.planStatus = "non_renewing";
    if (sub.current_period_end) {
      user.planExpiresAt = new Date(sub.current_period_end * 1000);
    }
    await user.save();

    return NextResponse.json({
      message: "Renovação cancelada. Seu acesso permanece até o fim do período já pago.",
    });
  } catch (err: any) {
    console.error("[billing/cancel] error:", err);
    return NextResponse.json({ error: err?.message || "Erro ao cancelar renovação" }, { status: 500 });
  }
}

