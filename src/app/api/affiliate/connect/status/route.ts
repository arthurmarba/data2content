import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";

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

    let status: "verified" | "pending" | "disabled" | null =
      user.paymentInfo?.stripeAccountStatus || null;
    let destCurrency: string | null =
      user.paymentInfo?.stripeAccountDefaultCurrency || null;

    if (accountId) {
      try {
        const account = await stripe.accounts.retrieve(accountId);

        destCurrency =
          (account as any).default_currency
            ? String((account as any).default_currency).toLowerCase()
            : null;

        // Para receber transfers, o essencial é poder fazer *payouts*
        const verified = !!account.payouts_enabled;
        status = verified ? "verified" : "pending";

        // Se a Stripe marcar como desabilitada
        if (
          (account.requirements as any)?.disabled_reason ||
          (account as any).disabled_reason
        ) {
          status = "disabled";
        }

        // Persistir somente se mudou
        const prevStatus = user.paymentInfo?.stripeAccountStatus ?? null;
        const prevCurrency =
          user.paymentInfo?.stripeAccountDefaultCurrency ?? null;

        if (prevStatus !== status || prevCurrency !== destCurrency) {
          user.paymentInfo = user.paymentInfo || {};
          user.paymentInfo.stripeAccountStatus = status as any;
          user.paymentInfo.stripeAccountDefaultCurrency = destCurrency || undefined;
          await user.save();
        }
      } catch (err) {
        console.error("[affiliate/connect/status] retrieve error:", err);
      }
    } else {
      status = null;
      destCurrency = null;
    }

    const needsOnboarding = !accountId || status !== "verified";

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
