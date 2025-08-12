import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Redemption from "@/app/models/Redemption";
import stripe from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";

export const runtime = "nodejs";

function minForCurrency(cur: string) {
  const upper = cur.toUpperCase();
  const fromEnv = Number(process.env[`REDEEM_MIN_${upper}`] || 0);
  return fromEnv > 0 ? Math.round(fromEnv) : 50 * 100; // cents
}

export async function POST(req: NextRequest) {
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

    let destCurrency =
      (account as any).default_currency ||
      user.paymentInfo?.stripeAccountDefaultCurrency ||
      user.currency;
    destCurrency = destCurrency ? String(destCurrency).toLowerCase() : "";
    if (!destCurrency) {
      return NextResponse.json({ error: "Moeda destino não disponível; finalize o onboarding da Stripe." }, { status: 400 });
    }

    const balances: Map<string, number> = user.affiliateBalances || new Map();
    const current = balances.get(destCurrency) ?? 0;
    const min = minForCurrency(destCurrency);

    if (current <= 0) return NextResponse.json({ error: "Sem saldo disponível." }, { status: 400 });
    if (current < min) {
      return NextResponse.json(
        { error: `Valor mínimo: ${(min / 100).toFixed(2)} ${destCurrency.toUpperCase()}` },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0,10).replace(/-/g,"");
    const idemKey = `redeem_${session.user.id}_${current}_${today}`;

    // Tenta "reservar" o saldo antes de chamar a Stripe
    const preUpdate = await User.findOneAndUpdate(
      { _id: user._id, [`affiliateBalances.${destCurrency}`]: current },
      { $set: { [`affiliateBalances.${destCurrency}`]: 0 } }
    );

    if (!preUpdate) {
      return NextResponse.json({ error: 'Saldo já resgatado.' }, { status: 409 });
    }

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
              date: new Date(),
              description: 'affiliate redeem',
              status: 'paid',
              transactionId: transfer.id,
              currency: destCurrency,
              amountCents: current,
            },
          },
        }
      );

      return NextResponse.json({ ok: true, mode: 'auto', redemptionId: String(redemption._id), transactionId: transfer.id });
    } catch (err: any) {
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

      return NextResponse.json({ ok: true, mode: 'queued', redemptionId: String(redemption._id), transactionId: null });
    }
  } catch (err: any) {
    console.error("[affiliate/redeem] error:", err);
    return NextResponse.json({ error: "Erro ao processar resgate." }, { status: 500 });
  }
}
