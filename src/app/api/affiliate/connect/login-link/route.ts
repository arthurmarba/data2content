import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (process.env.STRIPE_CONNECT_MODE !== "express") {
      return NextResponse.json({ error: "Stripe Connect deve estar configurado como Express" }, { status: 400 });
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const ip = getClientIp(req);
    const { allowed } = await checkRateLimit(`connect_login:${session.user.id}:${ip}`, 5, 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Muitas tentativas, tente novamente mais tarde.' }, { status: 429 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    const accountId = user.paymentInfo?.stripeAccountId;
    if (!accountId) {
      return NextResponse.json({ error: "Conta Stripe Connect não encontrada" }, { status: 400 });
    }

    const link = await stripe.accounts.createLoginLink(accountId);
    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error("[affiliate/connect/login-link] error:", err);
    return NextResponse.json({ error: "Erro ao gerar login link" }, { status: 500 });
  }
}
