// src/app/api/account/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import stripe from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // rate limit leve: 3 req/min
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

    // 🔒 Gate pelo status do NOSSO banco:
    //    Só bloqueia se realmente estiver ativo ou em trial.
    //    'pending' e 'non_renewing' NÃO bloqueiam.
    const blockedStatuses = new Set(["active", "trial"]);
    const blocked = blockedStatuses.has((user.planStatus as any) || "");
    if (blocked) {
      logger.warn("[account.delete] blocked due to active/trial subscription", {
        userId: user._id,
        planStatus: user.planStatus,
      });
      return NextResponse.json(
        {
          error: "ERR_ACTIVE_SUBSCRIPTION",
          message: "Cancele sua assinatura antes de excluir a conta.",
        },
        { status: 409 }
      );
    }

    // (Opcional) checagem no Stripe se habilitada
    // Corrigido: só considera 'active'/'trialing' que NÃO estão marcadas para cancelar ao fim do ciclo.
    if (
      process.env.VERIFY_STRIPE_BEFORE_DELETE === "true" &&
      user.stripeCustomerId
    ) {
      const customerId = user.stripeCustomerId;
      try {
        try {
          await cancelBlockingIncompleteSubs(customerId);
        } catch {}
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 100,
        });
        const activeLike = new Set([
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "paused",
        ]);
        const hasBlocking = subs.data.some((s) =>
          activeLike.has(s.status as any)
        );
        if (hasBlocking) {
          logger.warn("[account.delete] blocked by live Stripe subscription", {
            customerId,
            userId: user._id,
          });
          return NextResponse.json(
            { error: "has_active_subscription" },
            { status: 409 }
          );
        }
      } catch (e) {
        logger.error(
          "[account.delete] Stripe verification failed (continuing with DB status)",
          e
        );
      }
    }

    // normaliza balances -> Record<string, number>
    const balancesRaw =
      user.affiliateBalances instanceof Map
        ? Object.fromEntries(user.affiliateBalances as any)
        : user.affiliateBalances || {};
    const balances = (balancesRaw || {}) as Record<string, number>;
    const hasAffiliateBalances = Object.values(balances).some(
      (v) => Number(v) > 0
    );

    // (Opcional) bloquear exclusão se houver saldo de afiliado positivo
    if (
      hasAffiliateBalances &&
      process.env.BLOCK_DELETE_WITH_AFFILIATE_BALANCE === "true"
    ) {
      logger.warn("[account.delete] abort due to affiliate balances", {
        userId: user._id,
        balances,
      });
      return NextResponse.json(
        {
          error: "ERR_AFFILIATE_BALANCE",
          message:
            "Você possui comissões pendentes. Solicite o saque antes de excluir a conta.",
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

    // TODO: limpar coleções relacionadas (métricas, webhooks, etc.) se necessário
    await User.deleteOne({ _id: user._id });

    logger.info("[account.delete] user deleted", { userId: user._id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error("[account.delete] error", e);
    return NextResponse.json({ error: "InternalError" }, { status: 500 });
  }
}
