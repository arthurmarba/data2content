import {
  checkoutJourneyFromMetadata,
  checkoutJourneyToMetadata,
  normalizeCheckoutJourney,
} from "./checkoutJourney";

describe("checkoutJourney", () => {
  it("preserva somente destinos internos e valores conhecidos", () => {
    expect(normalizeCheckoutJourney({
      context: "chatgpt_intelligence",
      source: "ChatGPT Profile Upgrade",
      returnTo: "/dashboard/profile?source=chatgpt",
      postCheckoutIntent: "connect_instagram",
    })).toEqual({
      context: "chatgpt_intelligence",
      source: "chatgpt_profile_upgrade",
      returnTo: "/dashboard/profile?source=chatgpt",
      postCheckoutIntent: "connect_instagram",
    });
  });

  it("remove redirecionamento externo e intenção desconhecida", () => {
    expect(normalizeCheckoutJourney({
      context: "unknown",
      source: "chatgpt<script>",
      returnTo: "//evil.example",
      postCheckoutIntent: "external_redirect",
    })).toEqual({
      context: null,
      source: "chatgpt_script_",
      returnTo: null,
      postCheckoutIntent: null,
    });
  });

  it("faz round trip por metadados seguros do Stripe", () => {
    const journey = normalizeCheckoutJourney({
      context: "chatgpt_intelligence",
      source: "chatgpt_profile_upgrade",
      returnTo: "/dashboard/profile?source=chatgpt",
      postCheckoutIntent: "connect_instagram",
    });

    expect(checkoutJourneyFromMetadata(checkoutJourneyToMetadata(journey))).toEqual(journey);
  });
});
