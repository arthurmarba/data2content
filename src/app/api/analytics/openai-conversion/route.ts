import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";
import { stripe } from "@/app/lib/stripe";
import { sendOpenAiSubscriptionConversion } from "@/app/lib/analytics/openAiConversions";
import {
  buildOpenAiSubscriptionEventId,
  normalizeOpenAiAdsAttemptId,
} from "@/lib/openAiAdsEvent";
import {
  normalizeOpenAiOppref,
  OPENAI_OBREF_COOKIE_NAME,
  OPENAI_OPPREF_COOKIE_NAME,
} from "@/lib/openAiAdsAttribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadAuthOptions() {
  if (process.env.NODE_ENV === "test") return {} as any;
  const mod = await import("@/app/api/auth/[...nextauth]/route");
  return mod.authOptions as any;
}

function normalizePlanId(value: unknown): "d2c_pro_monthly" | "d2c_pro_annual" {
  return value === "d2c_pro_annual" ? "d2c_pro_annual" : "d2c_pro_monthly";
}

type CheckoutVerification = {
  authorized: boolean;
  confirmed: boolean;
};

function subscriptionIsConfirmed(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

async function verifyCheckoutAttempt(
  attemptId: string,
  userId: string,
): Promise<CheckoutVerification> {
  if (attemptId.startsWith("cs_")) {
    const checkoutSession = await stripe.checkout.sessions.retrieve(attemptId);
    const ownerId = checkoutSession.client_reference_id
      ?? checkoutSession.metadata?.userId
      ?? null;
    if (ownerId !== userId) return { authorized: false, confirmed: false };
    if (checkoutSession.status !== "complete") {
      return { authorized: true, confirmed: false };
    }

    const subscriptionRef = checkoutSession.subscription;
    if (!subscriptionRef) return { authorized: true, confirmed: false };
    const subscription = typeof subscriptionRef === "string"
      ? await stripe.subscriptions.retrieve(subscriptionRef)
      : subscriptionRef;
    return {
      authorized: true,
      confirmed: subscriptionIsConfirmed(subscription.status),
    };
  }

  const subscription = await stripe.subscriptions.retrieve(attemptId);
  const authorized = subscription.metadata?.userId === userId;
  return {
    authorized,
    confirmed: authorized && subscriptionIsConfirmed(subscription.status),
  };
}

export async function POST(request: NextRequest) {
  if (request.cookies.get("cookie_consent")?.value !== "granted") {
    return NextResponse.json({ ok: true, delivered: false, reason: "consent_required" });
  }

  const authOptions = await loadAuthOptions();
  const session = await getServerSession(authOptions as any);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const attemptId = normalizeOpenAiAdsAttemptId(body?.attemptId);
  const eventId = buildOpenAiSubscriptionEventId(attemptId);
  if (!attemptId || !eventId) {
    return NextResponse.json({ error: "Tentativa inválida" }, { status: 400 });
  }

  try {
    const verification = await verifyCheckoutAttempt(attemptId, String(userId));
    if (!verification.authorized) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    if (!verification.confirmed) {
      return NextResponse.json(
        { ok: true, delivered: false, reason: "subscription_not_confirmed" },
        { status: 409 },
      );
    }

    const appUrl = new URL(
      process.env.NEXT_PUBLIC_APP_URL?.trim()
        || process.env.NEXTAUTH_URL?.trim()
        || request.nextUrl.origin,
    );
    const result = await sendOpenAiSubscriptionConversion({
      eventId,
      timestampMs: Date.now(),
      sourceUrl: new URL("/billing/success", appUrl).toString(),
      planId: normalizePlanId(body?.planId),
      email: session.user?.email,
      externalId: String(userId),
      obref: request.cookies.get(OPENAI_OBREF_COOKIE_NAME)?.value ?? null,
      oppref: normalizeOpenAiOppref(
        request.cookies.get(OPENAI_OPPREF_COOKIE_NAME)?.value,
      ),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.warn("[openai-ads][conversion_delivery_failed]", {
      eventId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "Não foi possível registrar a conversão" },
      { status: 502 },
    );
  }
}
