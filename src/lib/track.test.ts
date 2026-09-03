import { track } from "./track";

describe("OpenAI Ads measurement mapping", () => {
  beforeEach(() => {
    (window as any).gtag = jest.fn();
    (window as any).oaiq = jest.fn();
  });

  afterEach(() => {
    delete (window as any).gtag;
    delete (window as any).oaiq;
  });

  it("mede início de checkout com o evento oficial correspondente", () => {
    track("chatgpt_funnel_event", {
      creator_id: null,
      step: "checkout_started",
      source: "chatgpt_paywall",
      context: "chatgpt_intelligence",
      status: "coupon_applied",
      event_id: null,
    });

    expect((window as any).oaiq).toHaveBeenCalledWith(
      "measure",
      "checkout_started",
      expect.objectContaining({ type: "contents" }),
    );
  });

  it("mede assinatura como enrollment sem inventar valor monetário", () => {
    track("chatgpt_funnel_event", {
      creator_id: "user-1",
      step: "subscription_activated",
      source: "chatgpt_profile_upgrade",
      context: "chatgpt_intelligence",
      status: "mensal",
      event_id: "d2c_subscription_cs_test_123",
    });

    expect((window as any).oaiq).toHaveBeenCalledWith(
      "measure",
      "subscription_created",
      { type: "plan_enrollment", plan_id: "d2c_pro_monthly" },
      { event_id: "d2c_subscription_cs_test_123" },
    );
  });
});
