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
    let status: 'verified' | 'pending' | 'disabled' | null =
      user.paymentInfo?.stripeAccountStatus || null;
    let destCurrency = user.paymentInfo?.stripeAccountDefaultCurrency || null;

    if (accountId) {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        destCurrency = ((account as any).default_currency || null)?.toLowerCase() || null;
        const verified = account.charges_enabled && account.payouts_enabled;
        status = verified ? 'verified' : 'pending';
        if (account.requirements?.disabled_reason || (account as any).disabled_reason) {
          status = 'disabled';
        }
        user.paymentInfo = user.paymentInfo || {};
        user.paymentInfo.stripeAccountStatus = status;
        user.paymentInfo.stripeAccountDefaultCurrency = destCurrency || undefined;
        await user.save();
      } catch (err) {
        console.error("[affiliate/connect/status] retrieve error:", err);
      }
    }

    if (!accountId) {
      status = null;
      destCurrency = null;
    }

    const needsOnboarding = !accountId || status !== 'verified';

    return NextResponse.json({
      stripeAccountId: accountId,
      stripeAccountStatus: status,
      destCurrency,
      needsOnboarding,
    });
  } catch (err) {
    console.error("[affiliate/connect/status] error:", err);
    return NextResponse.json({ error: "Erro ao obter status" }, { status: 500 });
  }
}

