import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const accountId = user.paymentInfo?.stripeAccountId || null;
    let status = user.paymentInfo?.stripeAccountStatus || null;
    let destCurrency = 'usd';

    if (accountId) {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        destCurrency = ((account as any).default_currency || 'usd').toLowerCase();
        let newStatus: 'verified' | 'restricted' | 'disabled' | 'pending' | null = 'pending';
        if (account.details_submitted && account.charges_enabled && account.payouts_enabled) newStatus = 'verified';
        else if (account.requirements?.disabled_reason) newStatus = 'restricted';
        else if ((account as any).disabled_reason) newStatus = 'disabled';
        status = newStatus;
        user.paymentInfo = user.paymentInfo || {};
        user.paymentInfo.stripeAccountStatus = status;
        await user.save();
      } catch (err) {
        console.error("[affiliate/connect/status] retrieve error:", err);
      }
    }

    return NextResponse.json({
      stripeAccountId: accountId,
      stripeAccountStatus: status,
      affiliatePayoutMode: user.affiliatePayoutMode,
      needsOnboarding: status !== 'verified',
      destCurrency,
    });
  } catch (err) {
    console.error("[affiliate/connect/status] error:", err);
    return NextResponse.json({ error: "Erro ao obter status" }, { status: 500 });
  }
}

