// src/app/api/account/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import { stripe } from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";

export const runtime = "nodejs";

type SessionWithUserId = { user?: { id?: string | null } } | null;

async function loadAuthOptions() {
  if (process.env.NODE_ENV === "test") {
    return {} as any;
  }
  const mod = await import("@/app/api/auth/[...nextauth]/route");
  return mod.authOptions as any;
}

export async function DELETE(req: NextRequest) {
  try {
    const authOptions = await loadAuthOptions();
    const session = (await getServerSession(authOptions as any)) as SessionWithUserId;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // rate limit leve: 3 req/min por IP + user
    const ip = getClientIp(req);
    const { allowed } = await checkRateLimit(
      `account_delete:${session.user.id}:${ip}`,
      3,
      60
    );
    if (!allowed) {
      return NextResponse.json({ error: "TooManyRequests" }, { status: 429 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "NotFound" }, { status: 404 });
    }

    // ---------- BLOQUEIO (Stripe primeiro, depois fallback no DB) ----------
    const ACTIVE_LIKE = new Set(["active", "trialing", "past_due", "unpaid"]);
    let mustBlock = false;

    // 1) Stripe como fonte de verdade (se houver subscriptionId)
    if (user.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        mustBlock = ACTIVE_LIKE.has(sub.status) && !sub.cancel_at_period_end;
      } catch (err) {
        logger.warn("[account.delete] stripe retrieve failed, falling back to DB", {
          userId: user._id,
          err,
        });
      }
    }

    // 2) Fallback pelo que está salvo no DB
    if (!mustBlock) {
      const status = (user.planStatus as string) || "";
      mustBlock = ACTIVE_LIKE.has(status) && !user.cancelAtPeriodEnd;
    }

    if (mustBlock) {
      logger.warn("[account.delete] blocked due to active subscription status", {
        userId: user._id,
        planStatus: user.planStatus,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      });
      return NextResponse.json(
        {
          error: "ERR_ACTIVE_SUBSCRIPTION",
          message: "Cancele sua assinatura ativa antes de excluir a conta.",
        },
        { status: 409 }
      );
    }
    // ----------------------------------------------------------------------

    // 🔧 Stripe (opcional): se houver customer, limpar pendências e (opcional) registrar snapshot
    if (user.stripeCustomerId) {
      const customerId = user.stripeCustomerId;
      try {
        // 1) Limpa pendências: incomplete / incomplete_expired
        try {
          await cancelBlockingIncompleteSubs(customerId);
        } catch { /* noop */ }

        // 2) Snapshot de diagnósticos (opcional)
        if (process.env.VERIFY_STRIPE_BEFORE_DELETE === "true") {
          const subs = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 100,
          });
          logger.info("[account.delete] stripe subs snapshot", {
            userId: user._id,
            customerId,
            subs: subs.data.map((s) => ({
              id: s.id,
              status: s.status,
              cancel_at_period_end: s.cancel_at_period_end,
            })),
          });
        }
      } catch (e) {
        logger.error("[account.delete] Stripe verification/cleanup failed (continuing)", e);
      }
    }

    // 💸 Opcional: bloquear exclusão se houver saldo de afiliado positivo
    const balancesRaw =
      user.affiliateBalances instanceof Map
        ? Object.fromEntries(user.affiliateBalances as any)
        : (user.affiliateBalances as any) || {};
    const balances = (balancesRaw || {}) as Record<string, number>;
    const hasAffiliateBalances = Object.values(balances).some((v) => Number(v) > 0);

    if (hasAffiliateBalances && process.env.BLOCK_DELETE_WITH_AFFILIATE_BALANCE === "true") {
      logger.warn("[account.delete] abort due to affiliate balances", {
        userId: user._id,
        balances,
      });
      return NextResponse.json(
        {
          error: "ERR_AFFILIATE_BALANCE",
          message: "Você possui comissões pendentes. Solicite o saque antes de excluir a conta.",
        },
        { status: 409 }
      );
    }

    if (hasAffiliateBalances) {
      logger.warn("[account.delete] deleting account with affiliate balances", {
        userId: user._id,
        balances,
      });
    }

    // (Opcional) deletar Stripe Connected Account
    if (
      process.env.DELETE_CONNECT_ACCOUNT_ON_USER_DELETE === "true" &&
      user.paymentInfo?.stripeAccountId
    ) {
      try {
        await stripe.accounts.del(user.paymentInfo.stripeAccountId);
      } catch (e) {
        logger.error("[account.delete] could not delete connected account", {
          userId: user._id,
          err: e,
        });
      }
    }

    // Efetiva a exclusão (hard delete)
    await User.deleteOne({ _id: user._id });

    logger.info("[account.delete] user deleted", { userId: user._id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error("[account.delete] error", e);
    return NextResponse.json({ error: "InternalError" }, { status: 500 });
  }
}
