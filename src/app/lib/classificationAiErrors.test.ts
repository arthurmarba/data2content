import {
  buildDeferredClassificationErrorMessage,
  classifyAiFailureMessage,
  isRetryableAiFailureMessage,
} from "@/app/lib/classificationAiErrors";

describe("classificationAiErrors", () => {
  it("detects insufficient quota messages", () => {
    expect(
      classifyAiFailureMessage(
        "You exceeded your current quota, please check your plan and billing details."
      )
    ).toBe("insufficient_quota");
  });

  it("detects rate limit messages", () => {
    expect(classifyAiFailureMessage("Rate limit reached. Please try again in 8.5s.")).toBe("rate_limit");
  });

  it("marks retryable AI errors correctly", () => {
    expect(isRetryableAiFailureMessage("insufficient_quota")).toBe(true);
    expect(isRetryableAiFailureMessage("erro desconhecido")).toBe(false);
  });

  it("builds user-facing deferred messages", () => {
    expect(buildDeferredClassificationErrorMessage("insufficient_quota")).toContain("saldo/quota");
    expect(buildDeferredClassificationErrorMessage("rate_limit")).toContain("limite temporário");
  });
});
