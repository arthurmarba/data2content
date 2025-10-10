import {
  getPlanAccessMeta,
  hasPlanPremiumAccess,
  hasPlanGracePeriod,
  isPlanActiveLike,
  normalizePlanStatus,
} from "@/utils/planStatus";

describe("planStatus helpers", () => {
  it("normalizes various spellings", () => {
    expect(normalizePlanStatus("ACTIVE")).toBe("active");
    expect(normalizePlanStatus("NonRenewing")).toBe("non_renewing");
    expect(normalizePlanStatus("trialling")).toBe("trialing");
    expect(normalizePlanStatus("  pending_payment  ")).toBe("pending");
    expect(normalizePlanStatus(null)).toBe("unknown");
  });

  it("flags active-like statuses", () => {
    expect(isPlanActiveLike("active")).toBe(true);
    expect(isPlanActiveLike("trial")).toBe(true);
    expect(isPlanActiveLike("TRIALING")).toBe(true);
    expect(isPlanActiveLike("nonrenewing")).toBe(true);
    expect(isPlanActiveLike("inactive")).toBe(false);
  });

  it("detects grace periods", () => {
    expect(hasPlanGracePeriod("non_renewing")).toBe(true);
    expect(hasPlanGracePeriod("active", true)).toBe(true);
    expect(hasPlanGracePeriod("active", false)).toBe(false);
    expect(hasPlanGracePeriod("inactive")).toBe(false);
  });

  it("determines premium access", () => {
    expect(hasPlanPremiumAccess("active")).toBe(true);
    expect(hasPlanPremiumAccess("trialing")).toBe(true);
    expect(hasPlanPremiumAccess("canceled")).toBe(false);
    expect(hasPlanPremiumAccess("active", true)).toBe(true);
    expect(hasPlanPremiumAccess("unknown", true)).toBe(true);
  });

  it("produces meta summary", () => {
    expect(getPlanAccessMeta("nonrenewing", false)).toEqual({
      normalizedStatus: "non_renewing",
      hasPremiumAccess: true,
      isGracePeriod: true,
      needsBilling: false,
    });

    expect(getPlanAccessMeta("inactive")).toEqual({
      normalizedStatus: "inactive",
      hasPremiumAccess: false,
      isGracePeriod: false,
      needsBilling: true,
    });
  });
});
