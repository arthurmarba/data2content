import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Redemption from '@/app/models/Redemption';
import stripe from '@/app/lib/stripe';

export const runtime = 'nodejs';

const locks = new Map<string, number>();
function acquireLock(key: string, ttlSec: number): boolean {
  const now = Date.now();
  const expiry = locks.get(key);
  if (expiry && expiry > now) return false;
  locks.set(key, now + ttlSec * 1000);
  return true;
}
function releaseLock(key: string) {
  locks.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, code: 'unauthorized', message: 'Não autenticado.' }, { status: 401 });
    }

    const { currency, amountCents, clientToken } = await req.json().catch(() => ({}));
    const cur = String(currency || '').toUpperCase();
    if (!cur) {
      return NextResponse.json({ ok: false, code: 'server_error', message: 'Currency requerida.' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id, 'affiliateBalances affiliateDebtByCurrency paymentInfo');
    if (!user) {
      return NextResponse.json({ ok: false, code: 'server_error', message: 'Usuário não encontrado.' }, { status: 500 });
    }

    const lockKey = `redeem:${user._id}:${cur}`;
    if (!acquireLock(lockKey, 20)) {
      return NextResponse.json({ ok: false, code: 'already_processing', message: 'Há um resgate em andamento.' }, { status: 409 });
    }

    try {
      const accountId = user.paymentInfo?.stripeAccountId;
      if (!accountId) {
        return NextResponse.json({ ok: false, code: 'needs_onboarding', message: 'Conecte/atualize sua conta Stripe.' }, { status: 400 });
      }
      const acct = await stripe.accounts.retrieve(accountId);
      const payoutsEnabled = !!acct.payouts_enabled;
      const defaultCurrency = acct.default_currency?.toUpperCase() ?? null;
      if (!payoutsEnabled) {
        return NextResponse.json({ ok: false, code: 'needs_onboarding', message: 'Conecte/atualize sua conta Stripe.' }, { status: 400 });
      }

      const balances: Map<string, number> = user.affiliateBalances || new Map();
      const available = balances.get(cur) ?? 0;
      const debts: Map<string, number> = user.affiliateDebtByCurrency || new Map();
      const debt = debts.get(cur) ?? 0;
      const minRedeem = Number(
        process.env[`AFFILIATE_MIN_REDEEM_${cur}`] ?? process.env.AFFILIATE_MIN_REDEEM_DEFAULT ?? 0,
      );

      if (debt > 0) {
        return NextResponse.json({ ok: false, code: 'has_debt', message: 'Há dívida nesta moeda.' }, { status: 400 });
      }
      if (available <= 0) {
        return NextResponse.json({ ok: false, code: 'no_funds', message: 'Sem saldo disponível.' }, { status: 400 });
      }
      if (available < minRedeem) {
        return NextResponse.json({ ok: false, code: 'below_min', message: 'Valor mínimo para saque não atingido.' }, { status: 400 });
      }
      if (defaultCurrency && defaultCurrency !== cur) {
        return NextResponse.json({ ok: false, code: 'currency_mismatch', message: 'Sua conta Stripe recebe outra moeda.' }, { status: 400 });
      }

      const amount = amountCents ?? available;
      if (amount <= 0) {
        return NextResponse.json({ ok: false, code: 'no_funds', message: 'Sem saldo disponível.' }, { status: 400 });
      }

      const redemption = await Redemption.create({
        userId: user._id,
        currency: cur,
        amountCents: amount,
        status: 'processing',
        transferId: null,
      } as any);

      const upd = await User.updateOne(
        { _id: user._id, [`affiliateBalances.${cur}`]: { $gte: amount } },
        { $inc: { [`affiliateBalances.${cur}`]: -amount } },
      );
      if (upd.modifiedCount === 0) {
        await Redemption.updateOne({ _id: redemption._id }, { $set: { status: 'rejected', reasonCode: 'race_condition' } });
        return NextResponse.json(
          { ok: false, code: 'server_error', message: 'Saldo insuficiente no momento. Tente novamente.' },
          { status: 409 },
        );
      }

      try {
        const idempotencyKey = `redeem:${user._id}:${cur}:${amount}:${clientToken ?? redemption._id.toString()}`;
        const transfer = await stripe.transfers.create(
          {
            amount,
            currency: cur.toLowerCase(),
            destination: accountId,
          },
          { idempotencyKey },
        );

        await Redemption.updateOne(
          { _id: redemption._id },
          { $set: { status: 'paid', transferId: transfer.id } },
        );

        return NextResponse.json({ ok: true, transferId: transfer.id, redeemId: redemption._id.toString(), amountCents: amount, currency: cur });
      } catch (err: any) {
        await User.updateOne(
          { _id: user._id },
          { $inc: { [`affiliateBalances.${cur}`]: amount } },
        );
        await Redemption.updateOne(
          { _id: redemption._id },
          { $set: { status: 'rejected', reasonCode: 'stripe_error', notes: err.message } },
        );
        return NextResponse.json({ ok: false, code: 'stripe_error', message: 'Falha ao processar no Stripe.' }, { status: 400 });
      }
    } finally {
      releaseLock(lockKey);
    }
  } catch (err) {
    return NextResponse.json({ ok: false, code: 'server_error', message: 'Erro interno.' }, { status: 500 });
  }
}
