import {
  CAMPAIGNS_ROUTE,
  buildCampaignProposalHref,
  buildCampaignProposalUrl,
} from "./routes";

describe("campaign routes", () => {
  it("mantém /campaigns como rota canônica", () => {
    expect(CAMPAIGNS_ROUTE).toBe("/campaigns");
  });

  it("gera deep link seguro para uma proposta", () => {
    expect(buildCampaignProposalHref("proposal/id 123")).toBe(
      "/campaigns?proposalId=proposal%2Fid%20123"
    );
  });

  it("remove barras finais da origem ao gerar URL absoluta", () => {
    expect(buildCampaignProposalUrl("https://data2content.ai///", "123")).toBe(
      "https://data2content.ai/campaigns?proposalId=123"
    );
  });

  it("preserva a origem de um deep link de campanha", () => {
    expect(buildCampaignProposalHref("123", { source: "email" })).toBe(
      "/campaigns?proposalId=123&source=email"
    );
    expect(
      buildCampaignProposalUrl("https://data2content.ai/", "123", { source: "email" })
    ).toBe("https://data2content.ai/campaigns?proposalId=123&source=email");
  });
});
