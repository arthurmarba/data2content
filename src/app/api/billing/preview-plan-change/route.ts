// src/app/api/billing/preview-plan-change/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import User from "@/app/models/User";
import { connectToDatabase } from "@/app/lib/mongoose";
import { stripe } from "@/app/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cacheHeader = { "Cache-Control": "no-store, max-age=0" } as const;

type Plan = "monthly" | "annual";
type Currency = "BRL" | "USD";

type PreviewPayload = {
  amountDue: number;
  currency: string;
  previewSupported: boolean;
  subtotal: number;
  discountsTotal: number;
  tax: number;
  total: number;
  nextCycleAmount: number;
  affiliateApplied: boolean;
  scheduleAttached?: boolean;
  note?: string;
};

// Resolve Price ID por plano/moeda
function getPriceId(plan: Plan, currency: Currency) {
  if (plan === "monthly" && currency === "BRL") return process.env.STRIPE_PRICE_MONTHLY_BRL!;
  if (plan === "annual"  && currency === "BRL") return process.env.STRIPE_PRICE_ANNUAL_BRL!;
  if (plan === "monthly" && currency === "USD") return process.env.STRIPE_PRICE_MONTHLY_USD!;
  if (plan === "annual"  && currency === "USD") return process.env.STRIPE_PRICE_ANNUAL_USD!;
  return "";
}

function normalizePlan(p: any): Plan | null {
  return p === "monthly" || p === "annual" ? p : null;
}

function normalizeCurrency(c?: string | null): Currency {
  const up = (c || "BRL").toUpperCase();
  return (up === "USD" ? "USD" : "BRL") as Currency;
}

function sumDiscounts(inv: any): number {
  const arrA: any[] = Array.isArray(inv?.discount_amounts) ? inv.discount_amounts : [];
  const arrB: any[] = Array.isArray(inv?.total_discount_amounts) ? inv.total_discount_amounts : [];
  const a = arrA.reduce((acc, d) => acc + (d?.amount ?? 0), 0);
  const b = arrB.reduce((acc, d) => acc + (d?.amount ?? 0), 0);
  return a || b || 0;
}

// Helper opcional para detectar schedule anexado (mais robusto que só ler subscription.schedule)
async function getAttachedSchedule(subscriptionId: string) {
  try {
    const list = await stripe.subscriptionSchedules.list({ subscription: subscriptionId, limit: 1 } as any);
    return list?.data?.[0] ?? null;
  } catch {
    return null;
  }
}

// Trata respostas de preview/upcoming em um payload unificado
function toPayloadFromInvoiceLike(inv: any, fallbackCurrency: Currency): PreviewPayload {
  const currency = (inv?.currency ?? fallbackCurrency).toString().toUpperCase();
  const subtotal = inv?.subtotal ?? 0;
  const total = inv?.total ?? 0;
  const tax = inv?.tax ?? 0;
  const discountsTotal = sumDiscounts(inv);

  return {
    amountDue: total ?? 0,
    currency,
    previewSupported: true,
    subtotal,
    discountsTotal,
    tax,
    total,
    nextCycleAmount: total ?? 0,
    affiliateApplied: discountsTotal > 0,
  };
}

// Detecta erro de parâmetro desconhecido específico para decidir fallback de shape
function isUnknownParamErr(e: any, paramName: string) {
  const code = e?.code || e?.raw?.code;
  const p = e?.param || e?.raw?.param;
  const msg: string = e?.message || e?.raw?.message || "";
  return code === "parameter_unknown" && (p === paramName || msg.includes(paramName));
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: cacheHeader });
    }

    const body = await req.json().catch(() => ({}));
    const toPlan = normalizePlan(body?.toPlan);
    if (!toPlan) {
      return NextResponse.json(
        { error: "Destino do plano (toPlan) é obrigatório", code: "MissingToPlan" },
        { status: 400, headers: cacheHeader }
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user || !user.stripeSubscriptionId || !user.stripeCustomerId) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404, headers: cacheHeader });
    }

    // Assinatura atual para extrair item/moeda
    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId as string,
      { expand: ["items.data.price"] } as any
    );

    const currentItem = subscription.items?.data?.[0] as Stripe.SubscriptionItem | undefined;
    if (!currentItem) {
      return NextResponse.json({ error: "Item da assinatura atual não foi encontrado." }, { status: 404, headers: cacheHeader });
    }

    const currentCurrency = normalizeCurrency(currentItem.price?.currency || "brl");
    const targetPriceId = getPriceId(toPlan, currentCurrency);

    if (!targetPriceId) {
      return NextResponse.json(
        {
          error: `PriceId não configurado para ${toPlan}/${currentCurrency}.`,
          code: "PriceNotConfigured",
        },
        { status: 400, headers: cacheHeader }
      );
    }

    const customerId = user.stripeCustomerId as string;
    const scheduleObj = (subscription as any).schedule || (await getAttachedSchedule(subscription.id));
    const hasSchedule = Boolean(scheduleObj);

    // ===== Estratégia A: usar PREVIEW (Basil) quando possível e sem schedule =====
    if (!hasSchedule) {
      const invoicesAny = stripe.invoices as any;

      // 1) createPreview com SHAPE NOVO (Basil)
      if (typeof invoicesAny.createPreview === "function") {
        try {
          const previewNewShape: any = await invoicesAny.createPreview({
            customer: customerId,
            subscription: user.stripeSubscriptionId as string,
            subscription_details: {
              proration_behavior: "create_prorations",
              items: [
                {
                  id: currentItem.id,
                  price: targetPriceId,
                },
              ],
            },
          });

          return NextResponse.json(toPayloadFromInvoiceLike(previewNewShape, currentCurrency), { headers: cacheHeader });
        } catch (e: any) {
          // Se o Stripe disser que 'subscription_details' é desconhecido, tente shape legado
          if (isUnknownParamErr(e, "subscription_details")) {
            try {
              const previewLegacyShape: any = await invoicesAny.createPreview({
                customer: customerId,
                subscription: user.stripeSubscriptionId as string,
                subscription_items: [
                  {
                    id: currentItem.id,
                    price: targetPriceId,
                  },
                ],
                subscription_proration_behavior: "create_prorations",
              });

              return NextResponse.json(toPayloadFromInvoiceLike(previewLegacyShape, currentCurrency), { headers: cacheHeader });
            } catch (e2) {
              console.error("[preview-plan-change] createPreview legacy error:", e2);
            }
          } else {
            console.error("[preview-plan-change] createPreview error (new shape):", e);
          }
        }
      }

      // 2) Fallback para retrieveUpcoming (ainda existe em alguns SDKs/versões)
      if (typeof invoicesAny.retrieveUpcoming === "function") {
        // Tente NOVO shape primeiro
        try {
          const upNew: any = await invoicesAny.retrieveUpcoming({
            customer: customerId,
            subscription: user.stripeSubscriptionId as string,
            subscription_details: {
              proration_behavior: "create_prorations",
              items: [
                {
                  id: currentItem.id,
                  price: targetPriceId,
                },
              ],
            },
          });

          return NextResponse.json(toPayloadFromInvoiceLike(upNew, currentCurrency), { headers: cacheHeader });
        } catch (e: any) {
          // Se o novo shape não existir nessa rota, tente o legado
          if (isUnknownParamErr(e, "subscription_details")) {
            try {
              const upLegacy: any = await invoicesAny.retrieveUpcoming({
                customer: customerId,
                subscription: user.stripeSubscriptionId as string,
                subscription_items: [
                  {
                    id: currentItem.id,
                    price: targetPriceId,
                  },
                ],
                subscription_proration_behavior: "create_prorations",
              });

              return NextResponse.json(toPayloadFromInvoiceLike(upLegacy, currentCurrency), { headers: cacheHeader });
            } catch (e2) {
              console.error("[preview-plan-change] retrieveUpcoming legacy error:", e2);
            }
          } else {
            console.error("[preview-plan-change] retrieveUpcoming error (new shape):", e);
          }
        }
      }
    }

    // ===== Fallback (ou quando houver schedule): não tentar preview dinâmico =====
    const targetPrice = await stripe.prices.retrieve(targetPriceId);
    const unit = targetPrice.unit_amount ?? 0;
    const currency = (targetPrice.currency || currentCurrency).toString().toUpperCase();

    const payload: PreviewPayload = {
      amountDue: 0, // nada a cobrar agora (prévia exata indisponível/bloqueada por schedule)
      currency,
      previewSupported: false,
      subtotal: unit,
      discountsTotal: 0,
      tax: 0,
      total: unit,
      nextCycleAmount: unit,
      affiliateApplied: false,
      scheduleAttached: hasSchedule || undefined,
      note: hasSchedule
        ? "A assinatura está vinculada a um Schedule. A migração dinâmica não é pré-visualizável; o valor do próximo ciclo é exibido."
        : "Pré-visualização exata indisponível; exibindo o valor base do próximo ciclo.",
    };

    return NextResponse.json(payload, { headers: cacheHeader });
  } catch (error: any) {
    console.error("[preview-plan-change] error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao pré-visualizar cobrança." },
      { status: 500, headers: cacheHeader }
    );
  }
}
