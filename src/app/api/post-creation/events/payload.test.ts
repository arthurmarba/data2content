/** @jest-environment node */
import {
  buildPostCreationEventCreatePayload,
  normalizePostCreationEventBody,
} from "@/app/api/post-creation/events/payload";

describe("post creation event payload", () => {
  it("omits optional enum fields when they are null", () => {
    const normalized = normalizePostCreationEventBody({
      eventName: "post_creation_blueprint_activated",
      stage: "blueprint",
      step: null,
      lane: null,
      scriptStatus: null,
    });

    const payload = buildPostCreationEventCreatePayload(normalized, "507f1f77bcf86cd799439011");

    expect(payload).not.toHaveProperty("step");
    expect(payload).not.toHaveProperty("lane");
    expect(payload).not.toHaveProperty("scriptStatus");
  });

  it("preserves optional enum fields when they are valid", () => {
    const normalized = normalizePostCreationEventBody({
      eventName: "post_creation_checkpoint_selected",
      stage: "path",
      step: "window",
      lane: "recommended",
      scriptStatus: "generated",
    });

    const payload = buildPostCreationEventCreatePayload(normalized, "507f1f77bcf86cd799439011");

    expect(payload).toEqual(
      expect.objectContaining({
        step: "window",
        lane: "recommended",
        scriptStatus: "generated",
      })
    );
  });

  it("accepts acquisition funnel events", () => {
    const normalized = normalizePostCreationEventBody({
      eventName: "post_creation_trial_started",
      stage: "path",
      source: "post_creation_board_trial",
      metadata: { accountState: "pre_signup" },
    });

    expect(normalized.eventName).toBe("post_creation_trial_started");
    expect(normalized.stage).toBe("path");
    expect(normalized.source).toBe("post_creation_board_trial");
  });

  it("accepts adaptive intent started event", () => {
    const normalized = normalizePostCreationEventBody({
      eventName: "post_creation_adaptive_intent_started",
      stage: "path",
      step: "adaptive_intent",
    });

    expect(normalized.eventName).toBe("post_creation_adaptive_intent_started");
    expect(normalized.step).toBe("adaptive_intent");
  });

  it("accepts adaptive answer selected event", () => {
    const normalized = normalizePostCreationEventBody({
      eventName: "post_creation_adaptive_answer_selected",
      stage: "path",
      step: "adaptive_quiz",
    });

    expect(normalized.eventName).toBe("post_creation_adaptive_answer_selected");
    expect(normalized.step).toBe("adaptive_quiz");
  });

  it("accepts adaptive map-key steps", () => {
    expect(
      normalizePostCreationEventBody({
        eventName: "post_creation_adaptive_answer_selected",
        stage: "path",
        step: "cta",
      }).step
    ).toBe("cta");
    expect(
      normalizePostCreationEventBody({
        eventName: "post_creation_adaptive_answer_selected",
        stage: "path",
        step: "brand",
      }).step
    ).toBe("brand");
  });

  it("rejects unknown eventName", () => {
    const normalized = normalizePostCreationEventBody({
      eventName: "post_creation_adaptive_unknown",
      stage: "path",
    });

    expect(normalized.eventName).toBeNull();
  });

  it("normalizes unknown step to null", () => {
    const normalized = normalizePostCreationEventBody({
      eventName: "post_creation_adaptive_answer_selected",
      stage: "path",
      step: "not_a_step",
    });

    expect(normalized.step).toBeNull();
  });

  it("preserves metadata and targetUserId", () => {
    const normalized = normalizePostCreationEventBody({
      eventName: "post_creation_adaptive_plan_generated",
      stage: "blueprint",
      step: "adaptive_plan",
      metadata: { mode: "brand_match", answerCount: 3 },
      targetUserId: " 507f1f77bcf86cd799439011 ",
    });

    expect(normalized.metadata).toEqual({ mode: "brand_match", answerCount: 3 });
    expect(normalized.targetUserId).toBe("507f1f77bcf86cd799439011");
  });

  it("accepts saved pauta discarded event", () => {
    const normalized = normalizePostCreationEventBody({
      eventName: "post_creation_saved_pauta_discarded",
      stage: "idea",
      step: "pauta",
    });

    expect(normalized.eventName).toBe("post_creation_saved_pauta_discarded");
    expect(normalized.step).toBe("pauta");
  });
});
