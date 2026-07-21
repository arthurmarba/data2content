import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Redemption from '@/app/models/Redemption';
import { stripe } from '@/app/lib/stripe';
import mongoose, { Types } from 'mongoose';
import { normalizedBalanceMap, summarizeAffiliateLedger } from '@/server/affiliate/ledger';

export const runtime = 'nodejs';

const locks = new Map<string, number>();
async function loadAuthOptions() {
  if (process.env.NODE_ENV === 'test') {
    return {} as any;
  }
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  return mod.authOptions as any;
}
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

function isDefinitiveStripeRejection(error: any) {
  const status = Number(error?.statusCode || error?.raw?.statusCode || 0);
  const type = String(error?.type || error?.rawType || '');
  if (type === 'StripeIdempotencyError' || status === 409 || status === 429) return false;
  return (
    type === 'StripeInvalidRequestError' ||
    type === 'StripeAuthenticationError' ||
    type === 'StripePermissionError' ||
    (status >= 400 && status < 404)
  );
}

export async function POST(req: NextRequest) {
  try {
    const authOptions = await loadAuthOptions();
    const session = (await getServerSession(authOptions)) as { user?: { id?: string } } | null;
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, code: 'unauthorized', message: 'Não autenticado.' }, { status: 401 });
    }

    const { currency, amountCents } = await req.json().catch(() => ({}));
    const cur = String(currency || '').toUpperCase();
    if (!cur) {
      return NextResponse.json({ ok: false, code: 'server_error', message: 'Currency requerida.' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(
      session.user.id,
      'affiliateBalances affiliateDebtByCurrency paymentInfo commissionLog affiliateStatus'
    );
    if (!user) {
      return NextResponse.json({ ok: false, code: 'server_error', message: 'Usuário não encontrado.' }, { status: 500 });
    }
    if (user.affiliateStatus === 'inactive' || user.affiliateStatus === 'suspended') {
      return NextResponse.json(
        { ok: false, code: 'affiliate_inactive', message: 'Programa de afiliados indisponível para esta conta.' },
        { status: 403 },
      );
    }

    const lockKey = `redeem:${user._id}:${cur}`;
    if (!acquireLock(lockKey, 20)) {
      return NextResponse.json({ ok: false, code: 'already_processing', message: 'Há um resgate em andamento.' }, { status: 409 });
    }

    try {
      const currencyKey = cur.toLowerCase();
      let redemption = await Redemption.findOne({
        userId: user._id,
        currency: currencyKey,
        status: 'requested',
      });
      const accountId = redemption?.accountId || user.paymentInfo?.stripeAccountId;
      if (!accountId) {
        return NextResponse.json({ ok: false, code: 'needs_onboarding', message: 'Conecte/atualize sua conta Stripe.' }, { status: 400 });
      }
      let defaultCurrency: string | null = null;
      if (!redemption) {
        const acct = await stripe.accounts.retrieve(accountId);
        defaultCurrency = acct.default_currency?.toUpperCase() ?? null;
        if (!acct.payouts_enabled) {
          return NextResponse.json({ ok: false, code: 'needs_onboarding', message: 'Conecte/atualize sua conta Stripe.' }, { status: 400 });
        }
      }

      const balances = normalizedBalanceMap(user.affiliateBalances);
      const debts = normalizedBalanceMap(user.affiliateDebtByCurrency);
      const ledger = summarizeAffiliateLedger(user.commissionLog || []);
      const available = ledger[cur]?.availableCents ?? 0;
      const storedAvailable = balances[cur] ?? 0;
      const debt = debts[cur] ?? 0;
      const minRedeem = Number(
        process.env[`AFFILIATE_MIN_REDEEM_${cur}`] ?? process.env.AFFILIATE_MIN_REDEEM_DEFAULT ?? (cur === 'USD' ? 1000 : 5000),
      );

      if (!redemption && debt > 0) {
        return NextResponse.json({ ok: false, code: 'has_debt', message: 'Há dívida nesta moeda.' }, { status: 400 });
      }
      const expectedStoredAvailable = redemption?.balanceReservedAt
        ? available - redemption.amountCents
        : available;
      if (!redemption && storedAvailable !== expectedStoredAvailable) {
        return NextResponse.json(
          { ok: false, code: 'ledger_out_of_sync', message: 'Saldo em conferência. Tente novamente após a reconciliação.' },
          { status: 409 },
        );
      }
      if (!redemption && available <= 0) {
        return NextResponse.json({ ok: false, code: 'no_funds', message: 'Sem saldo disponível.' }, { status: 400 });
      }
      if (!redemption && available < minRedeem) {
        return NextResponse.json({ ok: false, code: 'below_min', message: 'Valor mínimo para saque não atingido.' }, { status: 400 });
      }
      if (!redemption && defaultCurrency && defaultCurrency !== cur) {
        return NextResponse.json({ ok: false, code: 'currency_mismatch', message: 'Sua conta Stripe recebe outra moeda.' }, { status: 400 });
      }

      const amount = redemption?.amountCents ?? amountCents ?? available;
      if (amount <= 0) {
        return NextResponse.json({ ok: false, code: 'no_funds', message: 'Sem saldo disponível.' }, { status: 400 });
      }
      if (!redemption && amount !== available) {
        return NextResponse.json(
          { ok: false, code: 'partial_not_supported', message: 'Saque parcial ainda não é suportado.' },
          { status: 400 },
        );
      }

      const entries = (user.commissionLog || [])
        .filter(
          (entry: any) =>
            String(entry.currency || '').toUpperCase() === cur &&
            ((entry?.type === 'commission' && entry?.status === 'available') ||
              (entry?.type === 'adjustment' &&
                (entry?.status === 'available' || entry?.status === 'reversed'))),
        )
        .sort((a: any, b: any) => {
          const getTime = (val: any) => {
            const date = new Date(val || 0);
            return Number.isNaN(date.getTime()) ? 0 : date.getTime();
          };
          const ad = getTime(a.maturedAt || a.availableAt || a.createdAt);
          const bd = getTime(b.maturedAt || b.availableAt || b.createdAt);
          return ad - bd;
        });

      const payoutEntryIds: Types.ObjectId[] = [];
      let accumulated = 0;
      for (const entry of entries) {
        const amountForEntry = Number(entry?.amountCents || 0);
        if (!entry?._id || amountForEntry === 0) continue;
        payoutEntryIds.push(entry._id);
        accumulated += amountForEntry;
      }

      if (!redemption && (payoutEntryIds.length === 0 || accumulated !== amount)) {
        return NextResponse.json(
          {
            ok: false,
            code: 'ledger_out_of_sync',
            message: 'Não foi possível conciliar o saldo disponível. Tente novamente em instantes.',
          },
          { status: 409 },
        );
      }

      if (!redemption) {
        const redemptionId = new Types.ObjectId();
        const idempotencyKey = `redeem:${redemptionId.toString()}`;
        try {
          redemption = await Redemption.create({
            _id: redemptionId,
            userId: user._id,
            currency: cur,
            amountCents: amount,
            status: 'requested',
            idempotencyKey,
            accountId,
            payoutEntryIds,
          } as any);
        } catch (error: any) {
          if (error?.code !== 11000) throw error;
          redemption = await Redemption.findOne({
            userId: user._id,
            currency: cur.toLowerCase(),
            status: 'requested',
          });
          if (!redemption) throw error;
        }
      }

      // Completa solicitações legadas antes de qualquer chamada externa. Assim,
      // toda retomada também possui chave estável e a lista exata do ledger.
      if (
        !redemption.idempotencyKey ||
        !redemption.accountId ||
        !Array.isArray(redemption.payoutEntryIds) ||
        redemption.payoutEntryIds.length === 0
      ) {
        if (payoutEntryIds.length === 0 || accumulated !== redemption.amountCents) {
          return NextResponse.json(
            { ok: false, code: 'ledger_out_of_sync', message: 'Resgate antigo requer conciliação manual.' },
            { status: 409 },
          );
        }
        const legacyPatch = {
          idempotencyKey: redemption.idempotencyKey || `redeem:${redemption._id.toString()}`,
          accountId: redemption.accountId || accountId,
          payoutEntryIds,
        };
        await Redemption.updateOne(
          { _id: redemption._id, status: 'requested' },
          { $set: legacyPatch },
        );
        Object.assign(redemption, legacyPatch);
      }

      if (!redemption.balanceReservedAt) {
        const reservedAt = new Date();
        const reserveSession = await mongoose.startSession();
        let reserved = false;
        try {
          await reserveSession.withTransaction(async () => {
            reserved = false;
            const upd = await User.updateOne(
              { _id: user._id, [`affiliateBalances.${currencyKey}`]: { $gte: redemption!.amountCents } },
              { $inc: { [`affiliateBalances.${currencyKey}`]: -redemption!.amountCents } },
              { session: reserveSession },
            );
            if (upd.modifiedCount !== 1) return;

            const marked = await Redemption.updateOne(
              { _id: redemption!._id, status: 'requested', balanceReservedAt: null },
              { $set: { balanceReservedAt: reservedAt } },
              { session: reserveSession },
            );
            if (marked.modifiedCount !== 1) {
              throw new Error('Unable to persist redemption reservation');
            }
            reserved = true;
          });
        } finally {
          await reserveSession.endSession();
        }

        if (!reserved) {
          await Redemption.updateOne(
            { _id: redemption._id, balanceReservedAt: null },
            { $set: { status: 'rejected', reasonCode: 'race_condition', processedAt: reservedAt } },
          );
          return NextResponse.json(
            { ok: false, code: 'server_error', message: 'Saldo insuficiente no momento. Tente novamente.' },
            { status: 409 },
          );
        }
        redemption.balanceReservedAt = reservedAt;
      }

      let transfer;
      try {
        transfer = await stripe.transfers.create(
          {
            amount: redemption.amountCents,
            currency: cur.toLowerCase(),
            destination: accountId,
            metadata: { redemptionId: redemption._id.toString(), affiliateUserId: user._id.toString() },
          },
          { idempotencyKey: redemption.idempotencyKey! },
        );
      } catch (err: any) {
        if (isDefinitiveStripeRejection(err)) {
          const rejectedAt = new Date();
          const rejectionSession = await mongoose.startSession();
          let restored = false;
          try {
            await rejectionSession.withTransaction(async () => {
              restored = false;
              const rejected = await Redemption.updateOne(
                {
                  _id: redemption!._id,
                  status: 'requested',
                  balanceReservedAt: { $ne: null },
                },
                {
                  $set: {
                    status: 'rejected',
                    reasonCode: err?.code || 'stripe_rejected',
                    notes: err?.message || 'Stripe rejected transfer',
                    processedAt: rejectedAt,
                  },
                },
                { session: rejectionSession },
              );
              if (rejected.modifiedCount !== 1) return;

              const balanceRestored = await User.updateOne(
                { _id: user._id },
                { $inc: { [`affiliateBalances.${currencyKey}`]: redemption!.amountCents } },
                { session: rejectionSession },
              );
              if (balanceRestored.modifiedCount !== 1) {
                throw new Error('Unable to restore definitively rejected redemption');
              }
              restored = true;
            });
          } finally {
            await rejectionSession.endSession();
          }

          if (restored) {
            return NextResponse.json(
              { ok: false, code: 'stripe_rejected', message: 'A Stripe recusou o pagamento. Atualize sua conta e tente novamente.' },
              { status: 400 },
            );
          }
        }

        // A falha pode ter ocorrido depois de a Stripe aceitar a requisição.
        // Mantemos a reserva e a Redemption em `requested`; a próxima tentativa
        // reutiliza a mesma chave e obtém exatamente o mesmo Transfer.
        await Redemption.updateOne(
          { _id: redemption._id, status: 'requested' },
          { $set: { reasonCode: 'stripe_retryable', notes: err?.message || 'Stripe transfer failed' } },
        );
        return NextResponse.json(
          { ok: false, code: 'temporarily_unavailable', message: 'Pagamento em processamento. Tente novamente em instantes.' },
          { status: 503 },
        );
      }

      const dbSession = await mongoose.startSession();
      try {
        await dbSession.withTransaction(async () => {
          const paidAt = new Date();
          const redemptionUpdate = await Redemption.updateOne(
            { _id: redemption!._id, status: 'requested' },
            {
              $set: {
                status: 'paid',
                transferId: transfer.id,
                transactionId: transfer.id,
                processedAt: paidAt,
                reasonCode: null,
              },
            },
            { session: dbSession },
          );
          if (redemptionUpdate.modifiedCount !== 1) {
            const alreadyPaid = await Redemption.exists({
              _id: redemption!._id,
              status: 'paid',
              transferId: transfer.id,
            }).session(dbSession);
            if (!alreadyPaid) throw new Error('Redemption state changed during settlement');
            return;
          }

          const ledgerUpdate = await User.updateOne(
            { _id: user._id },
            {
              $set: {
                'commissionLog.$[entry].status': 'paid',
                'commissionLog.$[entry].paidAt': paidAt,
                'commissionLog.$[entry].redeemId': redemption!._id,
                'commissionLog.$[entry].transferId': transfer.id,
                'commissionLog.$[entry].updatedAt': paidAt,
              },
            },
            {
              arrayFilters: [{ 'entry._id': { $in: redemption!.payoutEntryIds || payoutEntryIds } }],
              session: dbSession,
            },
          );
          if (ledgerUpdate.modifiedCount !== 1) {
            throw new Error('Unable to settle affiliate ledger entries');
          }
        });
      } finally {
        await dbSession.endSession();
      }

      return NextResponse.json({
        ok: true,
        transferId: transfer.id,
        redeemId: redemption._id.toString(),
        amountCents: redemption.amountCents,
        currency: cur,
      });
    } finally {
      releaseLock(lockKey);
    }
  } catch (err) {
    return NextResponse.json({ ok: false, code: 'server_error', message: 'Erro interno.' }, { status: 500 });
  }
}
