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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const ip = getClientIp(req);
    const { allowed } = await checkRateLimit(`connect_onboard:${session.user.id}:${ip}`, 5, 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Muitas tentativas, tente novamente mais tarde.' }, { status: 429 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    user.paymentInfo = user.paymentInfo || {};
    let accountId = user.paymentInfo.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: { transfers: { requested: true } },
        metadata: { userId: String(user._id) },
      });
      accountId = account.id;
      user.paymentInfo.stripeAccountId = accountId;
      user.paymentInfo.stripeAccountStatus = "pending";
      user.affiliatePayoutMode = "connect";
      await user.save();
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: `${origin}/affiliate/connect/refresh`,
      return_url: `${origin}/affiliate/connect/return`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error("[affiliate/connect/onboard] error:", err);
    return NextResponse.json({ error: "Erro ao iniciar onboarding" }, { status: 500 });
  }
}
