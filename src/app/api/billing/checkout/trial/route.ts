// src/app/api/billing/checkout/trial/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Stripe from "stripe";
import { getOrCreateStripeCustomerId } from "@/utils/stripeHelpers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

/** Base URL:
 *  - Preferimos req.nextUrl.origin (robusto em dev/prod).
 *  - Fallback para header Origin → NEXTAUTH_URL → NEXT_PUBLIC_APP_URL → localhost.
 */
function getBaseUrl(req: NextRequest) {
  const origin = (req as any)?.nextUrl?.origin || req.headers.get("origin");
  if (origin && origin.startsWith("http")) return origin;
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

function getPriceId(plan: Plan, currency: Currency) {
  const c = String(currency || "BRL").toUpperCase() as Currency;
  if (plan === "monthly" && c === "BRL") return process.env.STRIPE_PRICE_MONTHLY_BRL!;
  if (plan === "annual"  && c === "BRL") return process.env.STRIPE_PRICE_ANNUAL_BRL!;
  if (plan === "monthly" && c === "USD") return process.env.STRIPE_PRICE_MONTHLY_USD!;
  if (plan === "annual"  && c === "USD") return process.env.STRIPE_PRICE_ANNUAL_USD!;
  throw new Error("PriceId não configurado para este plano/moeda");
}

function norm(v?: string | null) {
  return (v || "").trim().toUpperCase();
}

type ResolvedAffiliate = { code?: string; source?: "typed" | "url" | "cookie" };

function resolveAffiliateCode(req: NextRequest, bodyCode?: string): ResolvedAffiliate {
  const typed = norm(bodyCode);
  if (typed) return { code: typed, source: "typed" };

  const url = new URL(req.url);
  const fromUrl = norm(url.searchParams.get("ref") || url.searchParams.get("aff"));
  if (fromUrl) return { code: fromUrl, source: "url" };

  const cookieStore = cookies();
  const fromCookie = norm(cookieStore.get("d2c_ref")?.value || "");
  if (fromCookie) return { code: fromCookie, source: "cookie" };

  return {};
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const plan = String(body.plan || "monthly").toLowerCase() as Plan;
    const currency = String(body.currency || "BRL").toUpperCase() as Currency;

    if (!["monthly", "annual"].includes(plan) || !["BRL", "USD"].includes(currency)) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    const priceId = body.priceId || getPriceId(plan, currency);
    const baseUrl = getBaseUrl(req);

    await connectToDatabase();
    const me = await User.findById((session.user as any).id);
    if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Reutiliza/garante um único customer para o usuário
    const customerId = await getOrCreateStripeCustomerId(me);

    // Antes de criar outra sessão, limpamos tentativas bloqueadas e impedimos múltiplos trials
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    const cancellable = existingSubs.data.filter((sub) =>
      sub.status === "incomplete" || sub.status === "incomplete_expired"
    );
    await Promise.allSettled(
      cancellable.map((sub) => stripe.subscriptions.cancel(sub.id).catch(() => null))
    );

    const blocking = existingSubs.data.find((sub) => {
      const status = sub.status;
      if (!status) return false;
      if (status === "canceled" || status === "incomplete_expired") return false;
      if ((sub as any).cancel_at && (sub as any).cancel_at <= Date.now() / 1000) return false;
      const cancelAtPeriodEnd = Boolean((sub as any).cancel_at_period_end);
      const isBlockingStatus =
        status === "trialing" ||
        status === "active" ||
        status === "past_due" ||
        status === "unpaid" ||
        status === "paused";
      return isBlockingStatus || cancelAtPeriodEnd;
    });

    if (blocking) {
      const code = blocking.status === "trialing"
        ? "TRIAL_ALREADY_ACTIVE"
        : "SUBSCRIPTION_ALREADY_ACTIVE";
      const message =
        code === "TRIAL_ALREADY_ACTIVE"
          ? "Você já possui um teste gratuito ativo."
          : "Você já possui uma assinatura ativa.";
      return NextResponse.json(
        {
          code,
          message,
          subscriptionId: blocking.id,
          status: blocking.status,
        },
        { status: 409 }
      );
    }

    // Afiliado (opcional): cupom "once" na PRIMEIRA fatura paga após o trial
    const { code: refCode, source } = resolveAffiliateCode(req, body.affiliateCode);
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined = undefined;
    const metadata: Record<string, string> = {
      userEmail: session.user.email,
      userId: String((session.user as any).id),
      plan,
      currency,
    };

    if (refCode) {
      const owner = await User.findOne({ affiliateCode: refCode }).select("_id affiliateCode").lean();
      if (owner && String(owner._id) !== String(me._id)) {
        metadata.affiliateCode = refCode;
        metadata.affiliate_user_id = String(owner._id);
        if (source) metadata.attribution_source = String(source);

        const couponEnv =
          currency === "BRL"
            ? process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL
            : process.env.STRIPE_COUPON_AFFILIATE10_ONCE_USD;

        if (couponEnv) {
          discounts = [{ coupon: couponEnv }];
          if (!me.affiliateUsed) {
            me.affiliateUsed = refCode;
            await me.save();
          }
        }
      }
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId, // garante reuso do mesmo customer
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always", // coleta PM já no trial $0
      // Descontos devem ficar no nível da sessão (Basil)
      ...(discounts && discounts.length > 0
        ? { discounts }
        : { allow_promotion_codes: true }),
      subscription_data: {
        trial_period_days: 7,
        metadata,
      },
      client_reference_id: String((session.user as any).id),
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/canceled`,
      // Quando já passamos `customer`, não definimos `customer_email`.
    });

    return NextResponse.json({ url: checkout.url }, { status: 200 });
  } catch (err: any) {
    console.error("[billing/checkout/trial] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
