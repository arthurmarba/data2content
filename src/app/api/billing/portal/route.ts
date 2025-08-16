import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).lean();
    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404, headers: noStoreHeaders }
      );
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "Cliente Stripe ainda não foi criado para este usuário." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    // (Opcional) Evita abrir o portal com assinatura incompleta.
    // O Customer Portal não ajuda a concluir um "incomplete".
    if (user.planStatus && !["active", "trialing"].includes(user.planStatus)) {
      return NextResponse.json(
        {
          code: "PortalUnavailable",
          error:
            "Sua assinatura ainda não foi ativada. Retome o pagamento para concluir.",
        },
        { status: 409, headers: noStoreHeaders }
      );
    }

    const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
    const returnUrl = `${baseUrl}/dashboard/billing`;

    // Se você criou uma configuração no Dashboard e quer fixá-la:
    // STRIPE_BILLING_PORTAL_CONFIG_ID=pc_123...
    const configuration = process.env.STRIPE_BILLING_PORTAL_CONFIG_ID;

    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
      ...(configuration ? { configuration } : {}),
    });

    return NextResponse.json({ url: portal.url }, { headers: noStoreHeaders });
  } catch (err: any) {
    // Erro comum quando o portal NÃO está configurado em modo de teste.
    const msg: string =
      err?.raw?.message || err?.message || "Falha ao abrir o portal de cobrança.";

    // Log completo para debug
    console.error("[billing/portal] error:", err);

    if (
      typeof msg === "string" &&
      msg.includes("default configuration has not been created")
    ) {
      return NextResponse.json(
        {
          code: "PortalNotConfiguredTestMode",
          message:
            "Stripe Customer Portal não está configurado no modo de teste. Acesse Stripe Dashboard → Settings → Billing → Customer portal (em TEST MODE) e clique em Save para criar a configuração padrão. Opcionalmente, defina STRIPE_BILLING_PORTAL_CONFIG_ID com o ID da configuração.",
        },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const status =
      err?.statusCode || err?.raw?.statusCode || 400;

    return NextResponse.json(
      { message: msg },
      { status, headers: noStoreHeaders }
    );
  }
}
