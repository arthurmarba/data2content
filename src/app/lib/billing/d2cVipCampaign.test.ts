import {
  checkVipCampaignWindow,
  resolveVipCampaignLimits,
} from "./d2cVipCampaign";

const NO_LIMITS = { maxRedemptions: null, expiresAt: null };

describe("resolveVipCampaignLimits", () => {
  it("reads the cap and the deadline from env", () => {
    expect(
      resolveVipCampaignLimits({
        D2C_VIP_MAX_REDEMPTIONS: "100",
        D2C_VIP_EXPIRES_AT: "2026-12-31T23:59:59Z",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      maxRedemptions: 100,
      expiresAt: new Date("2026-12-31T23:59:59Z"),
    });
  });

  it("treats garbage as no limit rather than as zero", () => {
    expect(
      resolveVipCampaignLimits({
        D2C_VIP_MAX_REDEMPTIONS: "abacaxi",
        D2C_VIP_EXPIRES_AT: "nunca",
      } as NodeJS.ProcessEnv),
    ).toEqual(NO_LIMITS);
  });

  it("ignores a non-positive cap, which would close the campaign by accident", () => {
    expect(
      resolveVipCampaignLimits({ D2C_VIP_MAX_REDEMPTIONS: "0" } as NodeJS.ProcessEnv),
    ).toEqual(NO_LIMITS);
  });
});

describe("checkVipCampaignWindow", () => {
  it("stays open when nothing is configured — today's behaviour", () => {
    expect(
      checkVipCampaignWindow({
        promotionCode: { times_redeemed: 999 },
        limits: NO_LIMITS,
      }),
    ).toEqual({ available: true });
  });

  it("closes once the cap is reached", () => {
    expect(
      checkVipCampaignWindow({
        promotionCode: { times_redeemed: 100 },
        limits: { maxRedemptions: 100, expiresAt: null },
      }),
    ).toEqual({ available: false, reason: "sold_out" });
  });

  it("still allows the last redemption below the cap", () => {
    expect(
      checkVipCampaignWindow({
        promotionCode: { times_redeemed: 99 },
        limits: { maxRedemptions: 100, expiresAt: null },
      }),
    ).toEqual({ available: true });
  });

  it("closes after the deadline", () => {
    expect(
      checkVipCampaignWindow({
        promotionCode: { times_redeemed: 0 },
        limits: { maxRedemptions: null, expiresAt: new Date("2026-01-01") },
        now: new Date("2026-01-02"),
      }),
    ).toEqual({ available: false, reason: "expired" });
  });

  it("expiry wins over the cap, so the message names the real reason", () => {
    expect(
      checkVipCampaignWindow({
        promotionCode: { times_redeemed: 500 },
        limits: { maxRedemptions: 100, expiresAt: new Date("2026-01-01") },
        now: new Date("2026-06-01"),
      }),
    ).toEqual({ available: false, reason: "expired" });
  });

  it("counts a missing promotion code as zero redemptions", () => {
    expect(
      checkVipCampaignWindow({
        promotionCode: null,
        limits: { maxRedemptions: 1, expiresAt: null },
      }),
    ).toEqual({ available: true });
  });
});
