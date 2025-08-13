import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";

// --- Tipos para clareza ---
type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";
type AffiliateCheckResult = {
  couponId?: string;
  error?: "invalid_code" | "coupon_not_configured";
};

// --- Funções Auxiliares Refatoradas ---

function getPriceId(plan: Plan, currency: Currency): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${currency.toUpperCase()}`;
  const priceId = process.env[key];
  if (!priceId) throw new Error(`Price ID não configurado para ${key}`);
  return priceId;
}

async function getOrCreateStripeCustomerId(userId: string): Promise<string> {
  const user = await User.findById(userId);
  if (!user) throw new Error("Usuário não encontrado");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: String(user._id) },
  });
  
  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}

/**
 * Verifica a validade de um código de afiliado e a configuração do cupom.
 * Retorna o ID do cupom ou um erro específico.
 */
async function checkAffiliateCode(affiliateCode: string, currency: Currency): Promise<AffiliateCheckResult> {
  if (!affiliateCode) {
    return {}; // Nenhum código fornecido, sem erro.
  }
  
  const owner = await User.findOne({ affiliateCode: affiliateCode.toUpperCase() }).select("_id").lean();
  if (!owner) {
    return { error: "invalid_code" }; // Código não encontrado no DB.
  }

  const couponEnvKey = `STRIPE_COUPON_AFFILIATE10_ONCE_${currency.toUpperCase()}`;
  const couponId = process.env[couponEnvKey];
  
  if (!couponId) {
    console.error(`[billing/preview] CRITICAL: Cupom de afiliado não configurado para ${currency}. Defina a variável ${couponEnvKey}.`);
    return { error: "coupon_not_configured" }; // Cupom não configurado no .env
  }

  return { couponId };
}


export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();
    const { plan, currency, affiliateCode } = await req.json();

    const priceId = getPriceId(plan, currency);
    const customerId = await getOrCreateStripeCustomerId(session.user.id);
    const affiliateCheck = await checkAffiliateCode(affiliateCode, currency);

    // Se o código for inválido, retorna um erro claro para o frontend.
    if (affiliateCheck.error === 'invalid_code') {
      return NextResponse.json({ error: "Código de afiliado inválido." }, { status: 400 });
    }
    if (affiliateCheck.error === 'coupon_not_configured') {
      return NextResponse.json({ error: "O sistema de cupons não está configurado corretamente." }, { status: 500 });
    }

    const affiliateCouponId = affiliateCheck.couponId;

    const invoice = await stripe.invoices.retrieveUpcoming({
      customer: customerId,
      subscription_items: [{ price: priceId, quantity: 1 }],
      discounts: affiliateCouponId ? [{ coupon: affiliateCouponId }] : [],
    });

    const price = await stripe.prices.retrieve(priceId);
    const nextCycleAmount = price.unit_amount ?? 0;

    return NextResponse.json({
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      discountsTotal: invoice.total_discount_amounts?.reduce((acc, d) => acc + d.amount, 0) ?? 0,
      tax: invoice.tax ?? 0,
      total: invoice.total,
      nextCycleAmount,
      affiliateApplied: !!affiliateCouponId,
    });
  } catch (error: any) {
    console.error("[billing/preview] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
