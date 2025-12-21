import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

// 🔧 Tipo mínimo para evitar o erro de TS
type SessionWithUserId = { user?: { id?: string | null } } | null;

async function loadAuthOptions() {
  if (process.env.NODE_ENV === "test") {
    return {} as any;
  }
  const mod = await import("@/app/api/auth/[...nextauth]/route");
  return mod.authOptions as any;
}

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId } = (await req.json().catch(() => ({}))) as {
      subscriptionId?: string;
    };

    const authOptions = await loadAuthOptions();
    const session = (await getServerSession(authOptions as any)) as SessionWithUserId;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

    const customerId = (user as any).stripeCustomerId;
    if (!customerId) {
      (user as any).planStatus = "inactive";
      (user as any).stripeSubscriptionId = null;
      (user as any).stripePriceId = null;
      (user as any).planInterval = null;
      (user as any).planExpiresAt = null;
      (user as any).cancelAtPeriodEnd = false;
      await user.save();
      logger.info("billing_abort_no_customer", {
        endpoint: "POST /api/billing/abort",
        userId: String(user._id),
        customerId: null,
        subscriptionId: null,
        status: (user as any).planStatus ?? null,
        stripeRequestId: null,
      });
      return NextResponse.json({ ok: true, cleaned: [], status: "no_customer" });
    }

    const cleaned: string[] = [];

    // Se veio um subscriptionId explícito, cancelá-lo se for pendência
    if (subscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (sub && (sub.status === "incomplete" || sub.status === "incomplete_expired")) {
          await stripe.subscriptions.cancel(sub.id);
          cleaned.push(sub.id);
          logger.info("billing_abort_cancelled_sub", {
            endpoint: "POST /api/billing/abort",
            userId: String(user._id),
            customerId,
            subscriptionId: sub.id,
            status: sub.status,
            stripeRequestId: (sub as any)?.lastResponse?.requestId ?? null,
          });
        }
      } catch {
        // ignore id inválido/inesperado
      }
    }

  // Limpeza geral de pendências
  const res = await cancelBlockingIncompleteSubs(customerId);
  cleaned.push(...res.canceled);

  // Reatacha uma assinatura válida (active/trialing ou non_renewing) caso exista
  try {
    const listed = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    } as any);

    const pick = listed.data.find((s: any) => {
      const st = s?.status;
      const cape = Boolean((s as any)?.cancel_at_period_end);
      return st === "active" || st === "trialing" || (cape && (st === "active" || st === "trialing"));
    });

    if (pick) {
      const firstItem: any = pick.items?.data?.[0];
      const interval = firstItem?.price?.recurring?.interval;
      const planInterval = interval === "month" || interval === "year" ? interval : undefined;
      const cancelAtPeriodEnd = Boolean((pick as any)?.cancel_at_period_end);
      const ends = (pick.items?.data ?? [])
        .map((it: any) => it?.current_period_end)
        .filter((n: any) => typeof n === "number");
      const planExpiresAt =
        typeof (pick as any).cancel_at === "number"
          ? new Date((pick as any).cancel_at * 1000)
          : ends.length
          ? new Date(Math.min(...ends) * 1000)
          : typeof (pick as any).current_period_end === "number"
          ? new Date((pick as any).current_period_end * 1000)
          : null;

      (user as any).stripeSubscriptionId = pick.id;
      (user as any).stripePriceId = firstItem?.price?.id ?? null;
      if (planInterval !== undefined) (user as any).planInterval = planInterval;
      (user as any).planExpiresAt = planExpiresAt;
      (user as any).currentPeriodEnd = planExpiresAt;
      (user as any).cancelAtPeriodEnd = cancelAtPeriodEnd;
      (user as any).planStatus = (pick as any).status;
      await user.save();

      logger.info("billing_abort_reattached", {
        endpoint: "POST /api/billing/abort",
        userId: String(user._id),
        customerId,
        subscriptionId: pick.id,
        status: (pick as any).status,
        stripeRequestId: (pick as any)?.lastResponse?.requestId ?? null,
      });

      return NextResponse.json({ ok: true, cleaned, reattachedSubscriptionId: pick.id });
    }
  } catch {
    // cai no reset local abaixo
  }

  // Reset local (sem assinatura válida encontrada)
  (user as any).planStatus = "inactive";
  (user as any).stripeSubscriptionId = null;
  (user as any).stripePriceId = null;
  (user as any).planInterval = null;
  (user as any).planExpiresAt = null;
  (user as any).cancelAtPeriodEnd = false;
  await user.save();

  logger.info("billing_abort_reset", {
    endpoint: "POST /api/billing/abort",
    userId: String(user._id),
    customerId,
    subscriptionId: null,
    status: (user as any).planStatus ?? null,
    stripeRequestId: null,
  });

  return NextResponse.json({ ok: true, cleaned });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "abort_failed" }, { status: 500 });
  }
}
