import { evaluateMcpEntitlement } from "./entitlement";

describe("evaluateMcpEntitlement", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  const connectedInstagram = {
    isInstagramConnected: true,
    instagramAccountId: "ig-account-1",
  };

  it("allows an active subscriber without requiring Instagram", () => {
    expect(evaluateMcpEntitlement({ planStatus: "active" }, now)).toMatchObject({
      eligible: true,
      reason: "active",
      instagramConnected: false,
    });
  });

  it("allows an active subscriber and reports Instagram separately", () => {
    expect(
      evaluateMcpEntitlement({ planStatus: "active", ...connectedInstagram }, now),
    ).toMatchObject({
      eligible: true,
      instagramConnected: true,
    });
  });

  it("allows a non-renewing subscriber until the paid period ends", () => {
    expect(
      evaluateMcpEntitlement(
        {
          planStatus: "non-renewing",
          currentPeriodEnd: "2026-09-01T00:00:00.000Z",
        },
        now,
      ),
    ).toMatchObject({ eligible: true, reason: "non_renewing" });
  });

  it("blocks a non-renewing subscriber after the paid period ends", () => {
    expect(
      evaluateMcpEntitlement(
        {
          planStatus: "non_renewing",
          currentPeriodEnd: "2026-08-20T00:00:00.000Z",
        },
        now,
      ),
    ).toMatchObject({ eligible: false, reason: "subscription_expired" });
  });

  it.each(["trial", "trialing", "past_due", "inactive", undefined])(
    "blocks non-subscriber status %s",
    (planStatus) => {
      expect(evaluateMcpEntitlement({ planStatus }, now)).toMatchObject({
        eligible: false,
        reason: "subscription_required",
      });
    },
  );

  it("blocks a missing user", () => {
    expect(evaluateMcpEntitlement(null, now)).toMatchObject({
      eligible: false,
      reason: "user_not_found",
    });
  });
});
