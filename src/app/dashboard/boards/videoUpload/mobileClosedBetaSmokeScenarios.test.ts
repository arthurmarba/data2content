import { getMobileClosedBetaSmokeScenarios } from "./mobileClosedBetaSmokeScenarios";

describe("mobileClosedBetaSmokeScenarios", () => {
  it("lista todos os estados mínimos do smoke interno MM91", () => {
    const scenarios = getMobileClosedBetaSmokeScenarios();
    const ids = scenarios.map((scenario) => scenario.id);

    expect(ids).toEqual(expect.arrayContaining([
      "free_unused",
      "free_preview_used",
      "pro_needs_instagram",
      "pro_instagram_connected",
      "pro_quota_reached",
      "payment_pending",
      "payment_action_needed",
      "community_free_banner",
      "community_pro_banner",
      "mediakit_available",
      "mediakit_needs_instagram",
      "real_endpoint_blocked_for_common_user",
      "real_endpoint_allowlist_success_mocked_or_fixture",
      "post_checkout_connect_instagram",
      "post_checkout_join_community",
    ]));
  });

  it("usa apenas rotas internas seguras e nao chama endpoint real diretamente", () => {
    for (const scenario of getMobileClosedBetaSmokeScenarios()) {
      expect(scenario.href.startsWith("/")).toBe(true);
      expect(scenario.href.startsWith("//")).toBe(false);
      expect(scenario.href).not.toContain("/api/dashboard/mobile-strategic-profile/analyze-real");
      expect(scenario.href).not.toContain("uploadUrl");
      expect(scenario.href).not.toContain("signedUrl");
      expect(scenario.href).not.toContain("objectKey");
    }
  });
});
