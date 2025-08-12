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

    // 🔒 bloqueia apenas se realmente tiver uma assinatura em vigor
    //    => "active" e "trial" bloqueiam
    //    => "pending" NÃO bloqueia (não há o que cancelar)
    const blockedStatuses = ["active", "trial"];
    const blocked = blockedStatuses.includes((user.planStatus as any) || "");
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
    if (
      process.env.VERIFY_STRIPE_BEFORE_DELETE === "true" &&
      user.stripeCustomerId
    ) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "all",
          limit: 10,
        });
        // ⚠️ não considere 'incomplete' como ativo; usuário não consegue cancelar algo que não “virou”
        const activeLike = ["active", "trialing", "past_due", "unpaid"]; // removido 'incomplete'
        const anyActive = subs.data.some((s) => activeLike.includes(s.status));
        if (anyActive) {
          logger.warn("[account.delete] blocked by live Stripe subscription", {
            userId: user._id,
            customerId: user.stripeCustomerId,
          });
          return NextResponse.json(
            {
              error: "ERR_ACTIVE_SUBSCRIPTION",
              message: "Cancele sua assinatura antes de excluir a conta.",
            },
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

    const hasAffiliateBalances = Object.values(balances).some((v) => Number(v) > 0);
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
