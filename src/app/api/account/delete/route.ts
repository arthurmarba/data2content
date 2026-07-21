// src/app/api/account/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Redemption from "@/app/models/Redemption";
import { logger } from "@/app/lib/logger";
import { stripe } from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";
import { normalizedBalanceMap, summarizeAffiliateLedger } from "@/server/affiliate/ledger";
import mongoose from "mongoose";

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

    // Uma exclusão não pode apagar obrigação financeira nem interromper um
    // Transfer já iniciado. O bloqueio é uma invariante, não uma feature flag.
    const balances = normalizedBalanceMap(user.affiliateBalances);
    const debts = normalizedBalanceMap(user.affiliateDebtByCurrency);
    const ledger = summarizeAffiliateLedger(user.commissionLog || []);
    const hasAffiliateLiability =
      Object.values(balances).some((value) => value > 0) ||
      Object.values(debts).some((value) => value > 0) ||
      Object.values(ledger).some(
        (summary) => summary.availableCents > 0 || summary.pendingCents > 0,
      );
    const redemptionRecord = await Redemption.findOne(
      { userId: user._id },
      "_id status",
    ).lean();
    const hasActiveRedemption = redemptionRecord?.status === "requested";
    const hasAffiliateFinancialHistory =
      Boolean(user.commissionLog?.length) || Boolean(redemptionRecord);

    if (hasAffiliateLiability || hasActiveRedemption) {
      logger.warn("[account.delete] abort due to affiliate financial state", {
        userId: user._id,
        balances,
        debts,
        hasActiveRedemption,
      });
      return NextResponse.json(
        {
          error: "ERR_AFFILIATE_BALANCE",
          message: "Você possui comissões pendentes. Solicite o saque antes de excluir a conta.",
        },
        { status: 409 }
      );
    }
    if (hasAffiliateFinancialHistory) {
      return NextResponse.json(
        {
          error: "ERR_AFFILIATE_HISTORY",
          message: "Sua conta possui histórico financeiro de afiliado. Solicite a anonimização ao suporte.",
        },
        { status: 409 },
      );
    }

    // Revalida e exclui na mesma transação. Isso fecha a janela em que uma
    // comissão poderia maturar entre a primeira checagem e o hard delete.
    const deleteSession = await mongoose.startSession();
    let blockedAtCommit: "liability" | "history" | null = null;
    try {
      await deleteSession.withTransaction(async () => {
        blockedAtCommit = null;
        const freshUser = await User.findOne(
          { _id: user._id },
          null,
          { session: deleteSession },
        );
        if (!freshUser) return;

        const freshBalances = normalizedBalanceMap(freshUser.affiliateBalances);
        const freshDebts = normalizedBalanceMap(freshUser.affiliateDebtByCurrency);
        const freshLedger = summarizeAffiliateLedger(freshUser.commissionLog || []);
        const redemption = await Redemption.findOne(
          { userId: freshUser._id },
          "_id status",
          { session: deleteSession },
        ).lean();
        const hasFreshLiability =
          redemption?.status === "requested" ||
          Object.values(freshBalances).some((value) => value > 0) ||
          Object.values(freshDebts).some((value) => value > 0) ||
          Object.values(freshLedger).some(
            (summary) => summary.availableCents > 0 || summary.pendingCents > 0,
          );
        blockedAtCommit = hasFreshLiability
          ? "liability"
          : freshUser.commissionLog?.length || redemption
            ? "history"
            : null;
        if (blockedAtCommit) return;

        await User.deleteOne({ _id: freshUser._id }, { session: deleteSession });
      });
    } finally {
      await deleteSession.endSession();
    }

    if (blockedAtCommit) {
      const historyOnly = blockedAtCommit === "history";
      return NextResponse.json(
        {
          error: historyOnly ? "ERR_AFFILIATE_HISTORY" : "ERR_AFFILIATE_BALANCE",
          message: historyOnly
            ? "Sua conta possui histórico financeiro de afiliado. Solicite a anonimização ao suporte."
            : "Você possui comissões pendentes. Solicite o saque antes de excluir a conta.",
        },
        { status: 409 },
      );
    }

    // A limpeza externa ocorre somente depois que a exclusão local foi
    // confirmada; nunca removemos a conta de saque de um usuário retido.
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

    logger.info("[account.delete] user deleted", { userId: user._id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error("[account.delete] error", e);
    return NextResponse.json({ error: "InternalError" }, { status: 500 });
  }
}
