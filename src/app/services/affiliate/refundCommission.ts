// src/app/services/affiliate/refundCommission.ts
import mongoose, { Types } from 'mongoose';
import AffiliateRefundProgress from '@/app/models/AffiliateRefundProgress';
import User from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { COMMISSION_RATE } from '@/config/affiliates';
import { logger } from '@/app/lib/logger';

/** Utility: obtain total refunded paid amount from Stripe invoice or charge */
export function getRefundedPaidTotal(obj: any): number {
  if (!obj) return 0;
  if (obj.object === 'invoice') {
    if (typeof (obj as any).amount_paid_refunded === 'number') {
      return (obj as any).amount_paid_refunded;
    }
    // fallback: somar refunds das charges anexadas ao invoice (quando presentes)
    const charges = (obj as any).charges?.data;
    if (Array.isArray(charges)) {
      return charges.reduce((s: number, c: any) => s + (c?.amount_refunded || 0), 0);
    }
    return 0;
  }
  if (obj.object === 'charge') {
    return (obj as any).amount_refunded || 0;
  }
  return 0;
}

/**
 * Garante doc de progresso (upsert) e retorna delta cumulativo a aplicar.
 * Upsert via updateOne + leitura pela coleção nativa (evita overloads de TS).
 */
async function computeDelta(
  invoiceId: string,
  affiliateUserId: Types.ObjectId,
  eventTotal: number
) {
  // upsert só para inicializar o doc, sem alterar valor existente
  await AffiliateRefundProgress.updateOne(
    { invoiceId, affiliateUserId },
    { $setOnInsert: { refundedPaidCentsTotal: 0 } },
    { upsert: true }
  );

  // ler o progresso atual (cumulativo já aplicado anteriormente) pela coleção (driver)
  const progress = (await (AffiliateRefundProgress as any).collection.findOne({
    invoiceId,
    affiliateUserId,
  })) as { refundedPaidCentsTotal?: number } | null;

  const prev = progress?.refundedPaidCentsTotal ?? 0;
  const delta = Math.max(0, eventTotal - prev);
  return { progress, prev, delta };
}

export async function processAffiliateRefund(
  invoiceId: string,
  refundedPaidTotalCents: number
) {
  if (!invoiceId || !Number.isFinite(refundedPaidTotalCents) || refundedPaidTotalCents < 0) return;

  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const owner = await User.findOne({ 'commissionLog.invoiceId': invoiceId }).session(session);
      if (!owner) return;

      // Tipar como any para permitir campos opcionais históricos sem conflitos de TS.
      const entry: any = ((owner as any).commissionLog || []).find(
        (e: any) => e.invoiceId === invoiceId && e.type === 'commission'
      );
      if (!entry) return;

      const affiliateUserId = owner._id as Types.ObjectId;
      const progress = await AffiliateRefundProgress.findOneAndUpdate(
        { invoiceId, affiliateUserId },
        { $setOnInsert: { refundedPaidCentsTotal: 0 } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session },
      );
      if (!progress) throw new Error('Unable to initialize affiliate refund progress');

      const previousTotal = Number(progress.refundedPaidCentsTotal || 0);
      const delta = Math.max(0, refundedPaidTotalCents - previousTotal);
      logger.info('[affiliate:refund] delta', {
        invoiceId,
        affiliateUserId: String(affiliateUserId),
        previousTotal,
        refundedPaidTotalCents,
        delta,
      });
      if (delta === 0) return;

      // Usa a taxa persistida na comissão para manter o histórico imutável.
      const commissionRateBps = typeof entry.commissionRateBps === 'number' ? entry.commissionRateBps : undefined;
      const rate = commissionRateBps != null ? commissionRateBps / 10000 : COMMISSION_RATE;

      const alreadyReversed = ((owner as any).commissionLog || [])
        .filter(
          (e: any) =>
            e.invoiceId === invoiceId && e.type === 'adjustment' && e.status === 'reversed'
        )
        .reduce((s: number, e: any) => s + Math.abs(Number(e.amountCents || 0)), 0);

      const inferredPriorReversal =
        entry.status === 'pending' || entry.status === 'canceled'
          ? Math.round(previousTotal * rate)
          : alreadyReversed;
      const storedPriorReversal = Number(progress.reversedCommissionCentsTotal || 0);
      const previouslyApplied = Math.max(storedPriorReversal, inferredPriorReversal);
      const targetReversal = Math.round(refundedPaidTotalCents * rate);
      let reverse = Math.max(0, targetReversal - previouslyApplied);

      const origCommission =
        entry.status === 'pending' || entry.status === 'canceled'
          ? Math.abs(Number(entry.amountCents || 0)) + previouslyApplied
          : Math.abs(Number(entry.amountCents || 0));
      const maxReversable = origCommission - previouslyApplied;

      if (maxReversable <= 0) {
        progress.refundedPaidCentsTotal = refundedPaidTotalCents;
        progress.reversedCommissionCentsTotal = previouslyApplied;
        await progress.save({ session });
        return;
      }

      reverse = Math.min(reverse, maxReversable);
      if (reverse <= 0) {
        progress.refundedPaidCentsTotal = refundedPaidTotalCents;
        progress.reversedCommissionCentsTotal = previouslyApplied;
        await progress.save({ session });
        return;
      }

      const cur = entry.currency;
      (owner as any).affiliateBalances ||= new Map();
      (owner as any).affiliateDebtByCurrency ||= new Map();

      if (entry.status === 'pending') {
        // Ainda segurando: ajusta ou cancela antes de maturar.
        if (reverse >= entry.amountCents) {
          entry.amountCents = 0;
          entry.status = 'canceled';
        } else {
          entry.amountCents -= reverse;
        }
      } else if (entry.status === 'available') {
        // Já disponível, ainda não pago: debita saldo e gera ajuste.
        const prevBal = (owner as any).affiliateBalances.get(cur) ?? 0;
        const balDec = Math.min(prevBal, reverse);
        const debtInc = Math.max(reverse - prevBal, 0);

        (owner as any).affiliateBalances.set(cur, Math.max(prevBal - balDec, 0));
        if (debtInc > 0) {
          const prevDebt = (owner as any).affiliateDebtByCurrency.get(cur) ?? 0;
          (owner as any).affiliateDebtByCurrency.set(cur, prevDebt + debtInc);
          (owner as any).markModified?.('affiliateDebtByCurrency');
        }

        (owner as any).markModified?.('affiliateBalances');
        (owner as any).commissionLog.push({
          type: 'adjustment',
          status: 'reversed',
          invoiceId,
          affiliateUserId,
          currency: cur,
          amountCents: -reverse,
          commissionRateBps,
          reversedAt: new Date(),
          reasonCode: 'refund',
          note: 'refund partial/total',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      } else if (entry.status === 'paid') {
        // Já pago (resgatado): vira dívida e registra ajuste.
        const prevDebt = (owner as any).affiliateDebtByCurrency.get(cur) ?? 0;
        (owner as any).affiliateDebtByCurrency.set(cur, prevDebt + reverse);
        (owner as any).markModified?.('affiliateDebtByCurrency');
        (owner as any).commissionLog.push({
          type: 'adjustment',
          status: 'reversed',
          invoiceId,
          affiliateUserId,
          currency: cur,
          amountCents: -reverse,
          commissionRateBps,
          reversedAt: new Date(),
          reasonCode: 'refund',
          note: 'refund partial/total',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }

      progress.refundedPaidCentsTotal = refundedPaidTotalCents;
      progress.reversedCommissionCentsTotal = previouslyApplied + reverse;
      await owner.save({ session });
      await progress.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

export { computeDelta };
