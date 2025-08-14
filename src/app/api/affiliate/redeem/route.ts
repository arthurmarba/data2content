import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Redemption from "@/app/models/Redemption";
import stripe from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";
import { buildRedeemIdempotencyKey } from "@/app/services/affiliate/buildRedeemIdempotencyKey";
import {
  logAffiliateEvent,
  metrics,
  startAffiliateSpan,
  SpanStatusCode,
} from "@/app/lib/telemetry";

export const runtime = "nodejs";

function minForCurrency(cur: string) {
  const upper = cur.toUpperCase();
  const fromEnv = Number(process.env[`REDEEM_MIN_${upper}`] || 0);
  return fromEnv > 0 ? Math.round(fromEnv) : 50 * 100; // cents
}

export async function POST(req: NextRequest) {
  let destCurrency = "";
  let current = 0;
  const span = startAffiliateSpan("affiliate_redeem");
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const { allowed } = await checkRateLimit(`redeem_connect:${session.user.id}:${ip}`, 5, 60);
    if (!allowed) return NextResponse.json({ error: "Muitas tentativas; tente novamente." }, { status: 429 });

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const acctId = user.paymentInfo?.stripeAccountId || null;
    if (!acctId) {
      return NextResponse.json({ error: "Conecte sua conta Stripe antes do saque." }, { status: 400 });
    }

    const account = await stripe.accounts.retrieve(acctId);
    if (!account.payouts_enabled) {
      return NextResponse.json({ error: "Conta Stripe não verificada para saques." }, { status: 400 });
    }

    destCurrency =
      (account as any).default_currency ||
      user.paymentInfo?.stripeAccountDefaultCurrency ||
      user.currency;
    destCurrency = destCurrency ? String(destCurrency).toLowerCase() : "";
    if (!destCurrency) {
      metrics.affiliates_redeem_requests_total.inc({ currency: "unknown", result: "blocked_currency" });
      return NextResponse.json({ error: "Moeda destino não disponível; finalize o onboarding da Stripe." }, { status: 400 });
    }

    const balances: Map<string, number> = user.affiliateBalances || new Map();
    current = balances.get(destCurrency) ?? 0;
    const debtMap: Map<string, number> = user.affiliateDebtByCurrency || new Map();
    const debt = debtMap.get(destCurrency) ?? 0;
    if (debt > 0) {
      metrics.affiliates_redeem_requests_total.inc({ currency: destCurrency, result: "blocked_debt" });
      return NextResponse.json(
        {
          error: `Você possui uma dívida de ${(debt / 100).toFixed(2)} ${destCurrency.toUpperCase()} devido a reembolsos. Seus próximos ganhos compensarão automaticamente; tente novamente quando a dívida for quitada.`,
        },
        { status: 400 }
      );
    }
    const min = minForCurrency(destCurrency);

    if (current <= 0) {
      metrics.affiliates_redeem_requests_total.inc({ currency: destCurrency, result: "error" });
      return NextResponse.json({ error: "Sem saldo disponível." }, { status: 400 });
    }
    if (current < min) {
      metrics.affiliates_redeem_requests_total.inc({ currency: destCurrency, result: "blocked_min" });
      return NextResponse.json(
        { error: `Valor mínimo: ${(min / 100).toFixed(2)} ${destCurrency.toUpperCase()}` },
        { status: 400 }
      );
    }

    const idemKey = buildRedeemIdempotencyKey(session.user.id, current);

    logAffiliateEvent("affiliate:redeem.request", {
      affiliate_user_id: String(user._id),
      currency: destCurrency,
      amount_cents: current,
      idempotency_key: idemKey,
    });
    metrics.affiliates_redeem_requests_total.inc({ currency: destCurrency, result: "ok" });
    span.setAttribute("affiliate_user_id", String(user._id));
    span.setAttribute("currency", destCurrency);
    span.setAttribute("amount_cents", current);
    span.setAttribute("idempotency_key", idemKey);

    // Tenta "reservar" o saldo antes de chamar a Stripe
    const preUpdate = await User.findOneAndUpdate(
      { _id: user._id, [`affiliateBalances.${destCurrency}`]: current },
      { $set: { [`affiliateBalances.${destCurrency}`]: 0 } }
    );

    if (!preUpdate) {
      return NextResponse.json({ error: 'Saldo já resgatado.' }, { status: 409 });
    }

    const t0 = Date.now();
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: current,
          currency: destCurrency,
          destination: acctId,
          description: `Affiliate redeem ${destCurrency.toUpperCase()} ${current / 100}`,
          metadata: { userId: String(user._id), kind: 'affiliate_redeem' },
        },
        { idempotencyKey: idemKey }
      );
      metrics.affiliates_transfer_create_duration_ms.observe({}, Date.now() - t0);
      metrics.affiliates_transfers_total.inc({ result: "ok" });

      const redemption = await Redemption.create({
        userId: user._id,
        currency: destCurrency,
        amountCents: current,
        status: 'paid',
        method: 'connect',
        transactionId: transfer.id,
        processedAt: new Date(),
        notes: 'auto-transfer',
      } as any);

      await User.updateOne(
        { _id: user._id },
        {
          $push: {
            commissionLog: {
              type: 'redeem',
              status: 'paid',
              affiliateUserId: user._id,
              transactionId: transfer.id,
              currency: destCurrency,
              amountCents: current,
              note: 'affiliate redeem',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        }
      );

      logAffiliateEvent("affiliate:redeem.transfer_ok", {
        redemption_id: String(redemption._id),
        transaction_id: transfer.id,
        currency: destCurrency,
        amount_cents: current,
      });

      return NextResponse.json({ ok: true, mode: 'auto', redemptionId: String(redemption._id), transactionId: transfer.id });
    } catch (err: any) {
      metrics.affiliates_transfer_create_duration_ms.observe({}, Date.now() - t0);
      metrics.affiliates_transfers_total.inc({ result: "error" });
      const redemption = await Redemption.create({
        userId: user._id,
        currency: destCurrency,
        amountCents: current,
        status: 'requested',
        method: 'connect',
        notes: `auto-transfer failed: ${err.message}`,
      });

      // Reverte o saldo
      await User.updateOne(
        { _id: user._id },
        { $set: { [`affiliateBalances.${destCurrency}`]: current } }
      );
      logAffiliateEvent("affiliate:redeem.transfer_fail", {
        redemption_id: String(redemption._id),
        currency: destCurrency,
        amount_cents: current,
        error_kind: err.type || "unknown",
        error_message: err.message,
      });
      return NextResponse.json({ ok: true, mode: 'queued', redemptionId: String(redemption._id), transactionId: null });
    }
  } catch (err: any) {
    logAffiliateEvent("affiliate:redeem.transfer_fail", {
      currency: destCurrency,
      amount_cents: current,
      error_kind: "unexpected",
      error_message: err.message,
    });
    metrics.affiliates_redeem_requests_total.inc({ currency: destCurrency || "unknown", result: "error" });
    metrics.affiliates_transfers_total.inc({ result: "error" });
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR });
    return NextResponse.json({ error: "Erro ao processar resgate." }, { status: 500 });
  } finally {
    span.end();
  }
}
