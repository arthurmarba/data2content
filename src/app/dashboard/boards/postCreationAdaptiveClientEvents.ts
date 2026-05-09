export type PostCreationAdaptiveClientEventName =
  | "post_creation_adaptive_intent_started"
  | "post_creation_adaptive_quiz_started"
  | "post_creation_adaptive_answer_selected"
  | "post_creation_adaptive_plan_generated"
  | "post_creation_adaptive_plan_failed"
  | "post_creation_adaptive_plan_used"
  | "post_creation_adaptive_flow_reset";

export type PostCreationAdaptiveClientEventStage = "path" | "blueprint";

export type PostCreationAdaptiveClientEventParams = {
  eventName: PostCreationAdaptiveClientEventName;
  stage: PostCreationAdaptiveClientEventStage;
  step: string;
  draftId?: string | null;
  source?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
};

const DEFAULT_ADAPTIVE_EVENT_SOURCE = "post_creation_adaptive_flow";

export function postPostCreationAdaptiveEvent({
  eventName,
  stage,
  step,
  draftId = null,
  source = DEFAULT_ADAPTIVE_EVENT_SOURCE,
  targetUserId = null,
  metadata = {},
}: PostCreationAdaptiveClientEventParams) {
  try {
    void fetch("/api/post-creation/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({
        eventName,
        stage,
        step,
        draftId,
        source: source || DEFAULT_ADAPTIVE_EVENT_SOURCE,
        targetUserId: targetUserId || "",
        metadata,
      }),
    }).catch(() => undefined);
  } catch {
    // Tracking must never interrupt the adaptive creation flow.
  }
}
