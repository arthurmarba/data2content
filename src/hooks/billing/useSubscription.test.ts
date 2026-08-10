import { subscriptionFallbackFromPlanStatus } from "./useSubscription";

describe("subscriptionFallbackFromPlanStatus", () => {
  it("keeps manual and internal Pro access coherent without Stripe billing", () => {
    expect(subscriptionFallbackFromPlanStatus({
      ok: true,
      status: "active",
      planExpiresAt: null,
      cancelAtPeriodEnd: false,
      extras: { normalizedStatus: "active", hasPremiumAccess: true },
    })).toMatchObject({
      planName: "Pro",
      status: "active",
      billingManagedByStripe: false,
    });
  });

  it("does not invent a subscription for a Free account", () => {
    expect(subscriptionFallbackFromPlanStatus({
      ok: true,
      status: "inactive",
      extras: { normalizedStatus: "inactive", hasPremiumAccess: false },
    })).toBeNull();
  });
});
