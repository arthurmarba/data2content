import {
  isD2cVipPromotionCode,
  isD2cVipPromotionEffective,
  normalizePromotionCode,
} from "./d2cVipPromotion";

describe("d2cVIP promotion", () => {
  it("normalizes the public code without case sensitivity", () => {
    expect(normalizePromotionCode(" d2cVIP ")).toBe("D2CVIP");
    expect(isD2cVipPromotionCode("D2Cvip")).toBe(true);
  });

  it("makes a valid typed monthly coupon effective before the Apply click", () => {
    expect(isD2cVipPromotionEffective({
      value: "d2cVIP",
      explicitlyApplied: false,
      period: "monthly",
    })).toBe(true);
  });

  it("never applies d2cVIP to the annual plan", () => {
    expect(isD2cVipPromotionEffective({
      value: "d2cVIP",
      explicitlyApplied: true,
      period: "annual",
    })).toBe(false);
  });
});
