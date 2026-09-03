export const D2C_VIP_PROMOTION_CODE = "D2CVIP";
export const D2C_VIP_DISPLAY_CODE = "d2cVIP";

export function normalizePromotionCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function isD2cVipPromotionCode(value: unknown): boolean {
  return normalizePromotionCode(value) === D2C_VIP_PROMOTION_CODE;
}

export function isD2cVipPromotionEffective(options: {
  value: unknown;
  explicitlyApplied: boolean;
  period: "monthly" | "annual";
}): boolean {
  return options.period === "monthly"
    && (options.explicitlyApplied || isD2cVipPromotionCode(options.value));
}
