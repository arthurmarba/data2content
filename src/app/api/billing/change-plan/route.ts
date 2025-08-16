// src/app/api/billing/change-plan/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "monthly" | "annual";
type When = "now" | "period_end";

// >>> FIX: tipagem simples para a sessão
type SessionWithUserId = { user?: { id?: string | null } } | null;

// Resolve o Price ID por plano/moeda
function getPriceId(plan: Plan, currency: string) {
  const cur = (currency || "BRL").toUpperCase();
  if (plan === "monthly" && cur === "BRL") return process.env.STRIPE_PRICE_MONTHLY_BRL!;
  if (plan === "annual"  && cur === "BRL") return process.env.STRIPE_PRICE_ANNUAL_BRL!;
  if (plan === "monthly" && cur === "USD") return process.env.STRIPE_PRICE_MONTHLY_USD!;
  if (plan === "annual"  && cur === "USD") return process.env.STRIPE_PRICE_ANNUAL_USD!;
  throw new Error("PriceId not configured for plan/currency");
}

// Helper para obter o menor current_period_end
function getCurrentPeriodEndSec(sub: any): number | null {
  const top = sub?.current_period_end;
  if (typeof top === "number") return top;
  const itemEnds = (sub?.items?.data ?? [])
    .map((it: any) => it?.current_period_end)
    .filter((n: any) => typeof n === "number");
  return itemEnds.length ? Math.min(...itemEnds) : null;
}

export async function POST(req: Request) {
  try {
    // >>> FIX: cast explícito evita "Property 'user' does not exist on type '{}'"
    const session = (await getServerSession(authOptions as any)) as SessionWithUserId;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { to, when }: { to: Plan; when: When } = await req.json().catch(() => ({} as any));
    if (!to || !["monthly", "annual"].includes(to)) {
      return NextResponse.json({ error: "Parâmetro 'to' inválido" }, { status: 400 });
    }
    if (!when || !["now", "period_end"].includes(when)) {
      return NextResponse.json({ error: "Parâmetro 'when' inválido" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user || !user.stripeSubscriptionId || !user.stripeCustomerId) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    // Expandimos items.data.price e schedule
    const sub: any = await stripe.subscriptions.retrieve(user.stripeSubscriptionId as string, {
      expand: ["items.data.price", "schedule"],
    } as any);

    const currentItem = sub.items?.data?.[0];
    if (!currentItem) {
      return NextResponse.json({ error: "Item da assinatura não encontrado" }, { status: 400 });
    }

    const currentCurrency =
      (currentItem.price?.currency?.toUpperCase?.() as string) ||
      (user as any)?.currency ||
      "BRL";

    const newPriceId = getPriceId(to, currentCurrency);
    const currentPriceId = currentItem.price?.id || (currentItem as any)?.plan?.id || null;

    // No-op: já está no mesmo price
    if (currentPriceId && currentPriceId === newPriceId) {
      return NextResponse.json({ ok: true, noop: true, message: "Seu plano já está nesse valor." });
    }

    // Helper: buscar schedule anexado
    const getAttachedSchedule = async () => {
      try {
        const list = await stripe.subscriptionSchedules.list({
          subscription: sub.id,
          limit: 1,
        } as any);
        return list?.data?.[0] ?? null;
      } catch {
        return null;
      }
    };

    if (when === "now") {
      // Libera/cancela schedule prévio para permitir update direto
      const sched = await getAttachedSchedule();
      if (sched && sched.status !== "released") {
        try {
          await stripe.subscriptionSchedules.release(sched.id as string);
        } catch {
          try {
            await stripe.subscriptionSchedules.cancel(sched.id as string);
          } catch {
            /* ignore */
          }
        }
      }

      // Requer charge_automatically para pending updates
      if ((sub as any).collection_method && (sub as any).collection_method !== "charge_automatically") {
        return NextResponse.json(
          {
            error:
              "Assinatura está em modo de cobrança manual (send_invoice). Ative cobrança automática e defina um método de pagamento padrão antes de trocar o plano agora.",
            code: "SubNotAutopay",
          },
          { status: 409 }
        );
      }

      // Troca imediata sem cobrança agora
      const updated = await stripe.subscriptions.update(
        sub.id,
        {
          items: [{ id: currentItem.id, price: newPriceId }],
          proration_behavior: "none",
          payment_behavior: "pending_if_incomplete",
          expand: ["latest_invoice.payment_intent"],
        } as any
      );

      const latestInvoice: any = (updated as any).latest_invoice;
      const pi: any = latestInvoice?.payment_intent;
      const clientSecret: string | null = pi?.client_secret ?? null;

      return NextResponse.json({
        ok: true,
        when: "now",
        subscriptionId: updated.id,
        clientSecret,
      });
    }

    // when === "period_end": agenda via Subscription Schedule
    const cpeSec = getCurrentPeriodEndSec(sub);

    let schedule = await getAttachedSchedule();
    if (!schedule) {
      schedule = await stripe.subscriptionSchedules.create({
        from_subscription: sub.id,
        end_behavior: "release",
      } as any);
    }

    const currentQty = currentItem.quantity ?? 1;

    const phases: any[] = [
      {
        // Fase 1: de agora até o fim do ciclo atual (ou 1 iteração), mantendo o preço atual
        start_date: "now", // <<< importante para ancorar datas
        items: [{ price: currentPriceId, quantity: currentQty }],
        proration_behavior: "none",
        ...(typeof cpeSec === "number" ? { end_date: cpeSec } : { iterations: 1 }),
      },
      {
        // Fase 2: próximo ciclo com o novo preço
        ...(typeof cpeSec === "number" ? { start_date: cpeSec } : {}),
        items: [{ price: newPriceId, quantity: 1 }],
        proration_behavior: "none",
      },
    ];

    const updatedSchedule = await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases,
    } as any);

    return NextResponse.json({
      ok: true,
      when: "period_end",
      scheduleId: updatedSchedule.id,
      scheduleStatus: updatedSchedule.status,
    });
  } catch (err: any) {
    const msg =
      err?.raw?.message ||
      err?.message ||
      "Erro ao processar mudança de plano. Tente novamente em instantes.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
