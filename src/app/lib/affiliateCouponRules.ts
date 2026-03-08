import type Stripe from 'stripe';
import { AFFILIATE_DISCOUNT_PERCENT } from '@/config/affiliates';

export const AFFILIATE_COUPON_DURATION = 'once' as const;

export function getAffiliateCouponValidationError(
  coupon: Stripe.Coupon | Stripe.DeletedCoupon | null | undefined
): string | null {
  if (!coupon || coupon.deleted === true) {
    return 'Cupom de afiliado não encontrado no Stripe.';
  }

  if (coupon.percent_off !== AFFILIATE_DISCOUNT_PERCENT) {
    return `Cupom de afiliado inválido: esperado ${AFFILIATE_DISCOUNT_PERCENT}% de desconto.`;
  }

  if (coupon.duration !== AFFILIATE_COUPON_DURATION) {
    return 'Cupom de afiliado inválido: o desconto deve valer apenas na primeira cobrança.';
  }

  return null;
}
