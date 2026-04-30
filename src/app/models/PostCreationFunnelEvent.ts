import mongoose, { Schema, model, models, Types, Document } from "mongoose";

const POST_CREATION_FUNNEL_EVENT_NAMES = [
  "post_creation_checkpoint_selected",
  "post_creation_idea_selected",
  "post_creation_blueprint_activated",
  "post_creation_blueprint_adjusted",
  "post_creation_blueprint_script_opened",
  "post_creation_blueprint_script_started",
  "post_creation_blueprint_script_succeeded",
  "post_creation_blueprint_script_failed",
  "post_creation_slot_saved",
  "post_creation_script_opened",
  "post_creation_script_saved",
  "post_creation_content_linked",
  "post_creation_published_step_reopened",
  "post_creation_legal_consent_missing",
  "post_creation_trial_connect_clicked",
  "post_creation_trial_started",
  "post_creation_instagram_connect_started",
  "post_creation_instagram_connect_failed",
  "post_creation_instagram_connected",
  "post_creation_trial_already_used",
  "post_creation_trial_analysis_generated",
  "post_creation_trial_pauta_generated",
  "post_creation_account_gate_opened",
  "post_creation_paywall_opened",
] as const;

const POST_CREATION_FUNNEL_STAGES = ["path", "idea", "blueprint", "script", "published"] as const;
const POST_CREATION_FUNNEL_STEPS = ["window", "proposal", "context", "tone", "theme"] as const;
const POST_CREATION_IDEA_LANES = ["recommended", "safe", "bold", "practical"] as const;
const POST_CREATION_SCRIPT_STATUSES = ["generated", "linked", "published"] as const;

export type PostCreationFunnelEventName = (typeof POST_CREATION_FUNNEL_EVENT_NAMES)[number];
export type PostCreationFunnelStageName = (typeof POST_CREATION_FUNNEL_STAGES)[number];
export type PostCreationFunnelStepName = (typeof POST_CREATION_FUNNEL_STEPS)[number];
export type PostCreationIdeaLane = (typeof POST_CREATION_IDEA_LANES)[number];
export type PostCreationScriptStatus = (typeof POST_CREATION_SCRIPT_STATUSES)[number];

export interface IPostCreationFunnelEvent extends Document {
  userId: Types.ObjectId;
  draftId?: Types.ObjectId | null;
  eventName: PostCreationFunnelEventName;
  stage: PostCreationFunnelStageName;
  step?: PostCreationFunnelStepName | null;
  slotId?: string | null;
  scriptId?: string | null;
  ideaId?: string | null;
  contentId?: string | null;
  source?: string | null;
  lane?: PostCreationIdeaLane | null;
  scriptStatus?: PostCreationScriptStatus | null;
  recommendedSelected?: boolean | null;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PostCreationFunnelEventSchema = new Schema<IPostCreationFunnelEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    draftId: { type: Schema.Types.ObjectId, ref: "PostCreationDraft", default: null, index: true },
    eventName: { type: String, enum: POST_CREATION_FUNNEL_EVENT_NAMES, required: true, index: true },
    stage: { type: String, enum: POST_CREATION_FUNNEL_STAGES, required: true, index: true },
    step: { type: String, enum: POST_CREATION_FUNNEL_STEPS, default: undefined, index: true },
    slotId: { type: String, trim: true, maxlength: 120, default: null, index: true },
    scriptId: { type: String, trim: true, maxlength: 120, default: null, index: true },
    ideaId: { type: String, trim: true, maxlength: 160, default: null },
    contentId: { type: String, trim: true, maxlength: 120, default: null },
    source: { type: String, trim: true, maxlength: 120, default: null },
    lane: { type: String, enum: POST_CREATION_IDEA_LANES, default: undefined },
    scriptStatus: { type: String, enum: POST_CREATION_SCRIPT_STATUSES, default: undefined },
    recommendedSelected: { type: Boolean, default: null },
    confidence: { type: Number, min: 0, max: 1, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "post_creation_funnel_events",
  }
);

PostCreationFunnelEventSchema.index(
  { userId: 1, createdAt: -1 },
  { name: "post_creation_funnel_events_user_created_at" }
);

PostCreationFunnelEventSchema.index(
  { eventName: 1, createdAt: -1 },
  { name: "post_creation_funnel_events_event_created_at" }
);

const existingPostCreationFunnelEventModel =
  models.PostCreationFunnelEvent as mongoose.Model<IPostCreationFunnelEvent> | undefined;

const shouldRefreshPostCreationFunnelEventModel =
  process.env.NODE_ENV !== "production" &&
  existingPostCreationFunnelEventModel &&
  (
    existingPostCreationFunnelEventModel.schema.path("step")?.options?.default !== undefined ||
    existingPostCreationFunnelEventModel.schema.path("lane")?.options?.default !== undefined ||
    existingPostCreationFunnelEventModel.schema.path("scriptStatus")?.options?.default !== undefined ||
    !(
      existingPostCreationFunnelEventModel.schema.path("eventName")?.options?.enum as string[] | undefined
    )?.includes("post_creation_trial_started")
  );

if (shouldRefreshPostCreationFunnelEventModel) {
  mongoose.deleteModel("PostCreationFunnelEvent");
}

const PostCreationFunnelEventModel =
  (models.PostCreationFunnelEvent as mongoose.Model<IPostCreationFunnelEvent>) ||
  model<IPostCreationFunnelEvent>("PostCreationFunnelEvent", PostCreationFunnelEventSchema);

export default PostCreationFunnelEventModel;
export {
  POST_CREATION_FUNNEL_EVENT_NAMES,
  POST_CREATION_FUNNEL_STAGES,
  POST_CREATION_FUNNEL_STEPS,
  POST_CREATION_IDEA_LANES,
  POST_CREATION_SCRIPT_STATUSES,
};
