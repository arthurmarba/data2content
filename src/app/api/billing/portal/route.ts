import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import Stripe from "stripe";
import { logger } from "@/app/lib/logger";

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

    // Evita abrir o portal quando a assinatura está em estados pendentes/incompletos.
    const status = typeof user.planStatus === "string" ? user.planStatus.toLowerCase() : null;
    const blockedStatuses = new Set([
      "pending",
      "expired",
      "incomplete",
      "incomplete_expired",
    ]);
    let portalBlocked = status ? blockedStatuses.has(status) : false;
    let stripeStatus: string | null = null;

    if (portalBlocked && user.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ["latest_invoice.payment_intent"],
        } as any);
        stripeStatus = typeof sub.status === "string" ? sub.status : null;
        const stripeBlocked =
          stripeStatus === "incomplete" || stripeStatus === "incomplete_expired";
        portalBlocked = stripeBlocked;
      } catch {
        // se falhar, mantém o bloqueio para evitar loop de portal
      }
    }

    if (portalBlocked) {
      logger.info("billing_portal_blocked", {
        endpoint: "POST /api/billing/portal",
        userId: String(user._id),
        customerId: user.stripeCustomerId ?? null,
        subscriptionId: user.stripeSubscriptionId ?? null,
        status,
        stripeStatus,
        stripeRequestId: null,
      });
      return NextResponse.json(
        {
          code: "BILLING_BLOCKED_PENDING_OR_INCOMPLETE",
          message:
            "Sua assinatura ainda não foi ativada. Retome o checkout ou aborte a tentativa em Billing.",
        },
        { status: 409, headers: noStoreHeaders }
      );
    }

    const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
    const returnUrl = `${baseUrl}/dashboard/billing`;

    const configuration = process.env.STRIPE_BILLING_PORTAL_CONFIG_ID;

    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
      ...(configuration ? { configuration } : {}),
    });

    logger.info("billing_portal_created", {
      endpoint: "POST /api/billing/portal",
      userId: String(user._id),
      customerId: user.stripeCustomerId ?? null,
      subscriptionId: user.stripeSubscriptionId ?? null,
      status: user.planStatus ?? null,
      stripeRequestId: (portal as any)?.lastResponse?.requestId ?? null,
    });

    return NextResponse.json({ url: portal.url }, { headers: noStoreHeaders });
  } catch (err: any) {
    const msg: string =
      err?.raw?.message || err?.message || "Falha ao abrir o portal de cobrança.";

    logger.error("[billing/portal] error", err);

    if (typeof msg === "string" && msg.includes("default configuration has not been created")) {
      return NextResponse.json(
        {
          code: "PortalNotConfiguredTestMode",
          message:
            "Stripe Customer Portal não está configurado no modo de teste. Acesse Stripe Dashboard → Settings → Billing → Customer portal (TEST MODE) e clique em Save para criar a configuração padrão. Opcionalmente, defina STRIPE_BILLING_PORTAL_CONFIG_ID com o ID da configuração.",
        },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const status = err?.statusCode || err?.raw?.statusCode || 400;
    return NextResponse.json({ message: msg }, { status, headers: noStoreHeaders });
  }
}
