// src/app/services/affiliate/refundCommission.ts
import { Types } from 'mongoose';
import AffiliateRefundProgress from '@/app/models/AffiliateRefundProgress';
import User from '@/app/models/User';
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
  if (!invoiceId) return;

  const owner = await User.findOne({ 'commissionLog.invoiceId': invoiceId });
  if (!owner) return;

  // Tipar como any para permitir campos opcionais (ex.: commissionRateBps) sem conflitos de TS
  const entry: any = ((owner as any).commissionLog || []).find(
    (e: any) => e.invoiceId === invoiceId && e.type === 'commission'
  );
  if (!entry) return;

  const affiliateUserId = owner._id as Types.ObjectId;

  const { delta } = await computeDelta(invoiceId, affiliateUserId, refundedPaidTotalCents);
  logger.info('[affiliate:refund] delta', {
    invoiceId,
    affiliateUserId: String(affiliateUserId),
    delta,
  });
  if (delta === 0) return;

  // Usa commissionRateBps se existir no entry; senão cai no COMMISSION_RATE global
  const commissionRateBps = typeof entry.commissionRateBps === 'number' ? entry.commissionRateBps : undefined;
  const rate = commissionRateBps != null ? commissionRateBps / 10000 : COMMISSION_RATE;
  let reverse = Math.round(delta * rate);

  const alreadyReversed = ((owner as any).commissionLog || [])
    .filter(
      (e: any) =>
        e.invoiceId === invoiceId && e.type === 'adjustment' && e.status === 'reversed'
    )
    .reduce((s: number, e: any) => s + Math.abs(Number(e.amountCents || 0)), 0);

  const origCommission = Math.abs(Number(entry.amountCents || 0));
  const maxReversable = origCommission - alreadyReversed;

  if (maxReversable <= 0) {
    await AffiliateRefundProgress.updateOne(
      { invoiceId, affiliateUserId },
      { $set: { refundedPaidCentsTotal: refundedPaidTotalCents } }
    );
    return;
  }

  reverse = Math.min(reverse, maxReversable);
  if (reverse <= 0) return;

  const cur = entry.currency;
  (owner as any).affiliateBalances ||= new Map();
  (owner as any).affiliateDebtByCurrency ||= new Map();

  if (entry.status === 'pending') {
    // Ainda segurando: ajusta ou cancela antes de maturar
    if (reverse >= entry.amountCents) {
      entry.amountCents = 0;
      entry.status = 'canceled';
    } else {
      entry.amountCents -= reverse;
    }
  } else if (entry.status === 'available') {
    // Já disponível, ainda não pago: debita saldo e gera ajuste
    const prevBal = (owner as any).affiliateBalances.get(cur) ?? 0;
    let balDec = reverse;
    let debtInc = 0;

    if (prevBal < reverse) {
      balDec = prevBal;
      debtInc = reverse - prevBal;
    }

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
      note: 'refund partial/total',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  } else if (entry.status === 'paid') {
    // Já pago (resgatado): vira dívida e registra ajuste
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
      note: 'refund partial/total',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  await owner.save();

  // Atualiza o total cumulativo visto para esta invoice (idempotência do delta)
  await AffiliateRefundProgress.updateOne(
    { invoiceId, affiliateUserId },
    { $set: { refundedPaidCentsTotal: refundedPaidTotalCents } }
  );
}

export { computeDelta };
