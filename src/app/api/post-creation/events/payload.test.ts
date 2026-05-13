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
});
