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
      return NextResponse.json(
        { error: "Stripe Connect deve estar configurado como Express" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const { allowed } = await checkRateLimit(
      `connect_create:${session.user.id}:${ip}`,
      5,
      60
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas, tente novamente mais tarde." },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    user.paymentInfo ||= {};
    let accountId = user.paymentInfo.stripeAccountId as string | undefined;
    let status = user.paymentInfo.stripeAccountStatus as
      | "verified"
      | "pending"
      | "disabled"
      | undefined;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        // 🇧🇷 é obrigatório solicitar ambos no BR
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          product_description: "Pagamentos de afiliado da Data2Content",
        },
        metadata: { userId: String(user._id) },
      });

      accountId = account.id;
      status = "pending";
      user.paymentInfo.stripeAccountId = accountId;
      user.paymentInfo.stripeAccountStatus = status;
      user.affiliatePayoutMode = "connect";
      await user.save();
    }

    return NextResponse.json({ accountId, status });
  } catch (err) {
    console.error("[affiliate/connect/create] error:", err);
    return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
  }
}
