import {
  appendAffiliateConnectReturn,
  normalizeAffiliateConnectReturn,
} from "./affiliateConnectReturn";

describe("affiliateConnectReturn", () => {
  it("aceita apenas caminhos internos", () => {
    expect(normalizeAffiliateConnectReturn("/dashboard/boards/mobile-strategic-profile?affiliate=1"))
      .toBe("/dashboard/boards/mobile-strategic-profile?affiliate=1");
    expect(normalizeAffiliateConnectReturn("https://malicious.example"))
      .toBe("/dashboard/chat");
    expect(normalizeAffiliateConnectReturn("//malicious.example"))
      .toBe("/dashboard/chat");
  });

  it("anexa o retorno validado à URL do Stripe", () => {
    expect(appendAffiliateConnectReturn(
      "https://data2content.ai/affiliate/connect/return",
      "/dashboard/boards/mobile-strategic-profile?affiliate=1",
    )).toBe(
      "https://data2content.ai/affiliate/connect/return?returnTo=%2Fdashboard%2Fboards%2Fmobile-strategic-profile%3Faffiliate%3D1",
    );
  });
});
