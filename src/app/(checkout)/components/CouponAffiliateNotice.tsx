interface Props {
  hasManualCoupon: boolean;
  affiliateApplied: boolean;
  affiliateCode?: string;
}

export function CouponAffiliateNotice({ hasManualCoupon, affiliateApplied, affiliateCode }: Props) {
  if (hasManualCoupon) {
    return (
      <p className="text-sm">
        Cupom promocional aplicado. Esse cupom não faz parte do programa de afiliados.
      </p>
    );
  }
  if (affiliateApplied) {
    return (
      <p className="text-sm">
        Indicação registrada pelo código de afiliado <strong>{affiliateCode}</strong>. O preço da assinatura permanece o mesmo.
      </p>
    );
  }
  return null;
}
