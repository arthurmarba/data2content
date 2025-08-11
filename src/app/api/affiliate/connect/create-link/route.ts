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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    let accountId = user.paymentInfo?.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: process.env.STRIPE_CONNECT_MODE === "express" ? "express" : "standard",
        email: user.email,
      });
      accountId = account.id;
      user.paymentInfo = user.paymentInfo || {};
      user.paymentInfo.stripeAccountId = accountId;
      user.paymentInfo.stripeAccountStatus = "pending";
      user.affiliatePayoutMode = "connect";
      await user.save();
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/dashboard/affiliate`,
      return_url: `${baseUrl}/dashboard/affiliate`,
      type: "account_onboarding",
    });

    return NextResponse.json({ onboardingUrl: link.url });
  } catch (err) {
    console.error("[affiliate/connect/create-link] error:", err);
    return NextResponse.json({ error: "Erro ao criar link" }, { status: 500 });
  }
}

