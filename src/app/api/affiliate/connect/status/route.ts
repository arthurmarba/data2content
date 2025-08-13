import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";
import { mapStripeAccountInfo } from "@/app/services/stripe/mapAccountInfo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const { allowed } = await checkRateLimit(
      `connect_status:${session.user.id}:${ip}`,
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

    const accountId = user.paymentInfo?.stripeAccountId || null;

    if (accountId) {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        const info = mapStripeAccountInfo(account as any);

        const prev = user.paymentInfo || {};
        user.paymentInfo = {
          ...prev,
          stripeAccountStatus: info.stripeAccountStatus,
          stripeAccountDefaultCurrency: info.default_currency || undefined,
          stripeAccountPayoutsEnabled: info.payouts_enabled,
          stripeAccountChargesEnabled: info.charges_enabled,
          stripeAccountDisabledReason: info.disabled_reason || undefined,
          stripeAccountCapabilities: new Map(
            Object.entries(info.capabilities)
          ),
          stripeAccountNeedsOnboarding: info.needsOnboarding,
        } as any;
        user.markModified("paymentInfo");
        await user.save();

        return NextResponse.json(info);
      } catch (err) {
        console.error("[affiliate/connect/status] retrieve error:", err);
      }
    }

    return NextResponse.json({
      payouts_enabled: false,
      charges_enabled: false,
      default_currency: null,
      disabled_reason: null,
      needsOnboarding: true,
      capabilities: { card_payments: "inactive", transfers: "inactive" },
      requirements: { currently_due: [], past_due: [], current_deadline: null },
      stripeAccountStatus: "pending",
    });
  } catch (err) {
    console.error("[affiliate/connect/status] error:", err);
    return NextResponse.json({ error: "Erro ao obter status" }, { status: 500 });
  }
}
