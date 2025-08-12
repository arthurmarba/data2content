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
      `connect_link:${session.user.id}:${ip}`,
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
    let accountId = user.paymentInfo.stripeAccountId;

    // fallback: garantir a conta com as capacidades corretas (BR exige ambos)
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
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
      user.paymentInfo.stripeAccountId = accountId;
      user.paymentInfo.stripeAccountStatus = "pending";
      user.affiliatePayoutMode = "connect";
      await user.save();
    }

    const account = await stripe.accounts.retrieve(accountId!);
    const verified = !!account.payouts_enabled;

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    if (verified) {
      const ll = await stripe.accounts.createLoginLink(accountId!);
      return NextResponse.json({ url: ll.url, kind: "login" });
    }

    const refreshUrl =
      process.env.STRIPE_CONNECT_REFRESH_URL ||
      `${origin}/affiliate/connect/refresh`;
    const returnUrl =
      process.env.STRIPE_CONNECT_RETURN_URL ||
      `${origin}/affiliate/connect/return`;

    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url, kind: "onboarding" });
  } catch (err) {
    console.error("[affiliate/connect/link] error:", err);
    return NextResponse.json({ error: "Erro ao gerar link" }, { status: 500 });
  }
}
