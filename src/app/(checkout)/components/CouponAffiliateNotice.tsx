interface Props {
  hasManualCoupon: boolean;
  affiliateApplied: boolean;
  affiliateCode?: string;
}

export function CouponAffiliateNotice({ hasManualCoupon, affiliateApplied, affiliateCode }: Props) {
  if (hasManualCoupon) {
    return (
      <p className="text-sm">
        Cupom aplicado. O desconto de afiliado não é cumulativo e não gera comissão.
      </p>
    );
  }
  if (affiliateApplied) {
    return (
      <p className="text-sm">
        Desconto de afiliado <strong>10%</strong> aplicado na 1ª fatura pelo código <strong>{affiliateCode}</strong>.
      </p>
    );
  }
  return null;
}
