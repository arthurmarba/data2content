import mongoose, { Schema, model, models, Types, Document } from "mongoose";

export interface IPostCreationDraft extends Document {
  userId: Types.ObjectId;
  titleSnapshot?: string | null;
  stage: "path" | "idea" | "blueprint" | "script" | "published";
  state: Record<string, unknown>;
  selectedSlotId?: string | null;
  selectedScriptId?: string | null;
  linkedContentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PostCreationDraftSchema = new Schema<IPostCreationDraft>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    titleSnapshot: { type: String, trim: true, maxlength: 240, default: null },
    stage: {
      type: String,
      enum: ["path", "idea", "blueprint", "script", "published"],
      default: "path",
      required: true,
      index: true,
    },
    state: { type: Schema.Types.Mixed, required: true, default: {} },
    selectedSlotId: { type: String, trim: true, maxlength: 120, default: null },
    selectedScriptId: { type: String, trim: true, maxlength: 120, default: null },
    linkedContentId: { type: String, trim: true, maxlength: 120, default: null },
  },
  {
    timestamps: true,
    collection: "post_creation_drafts",
  }
);

PostCreationDraftSchema.index(
  { userId: 1, updatedAt: -1 },
  { name: "post_creation_drafts_user_updated_at" }
);

const PostCreationDraftModel =
  (models.PostCreationDraft as mongoose.Model<IPostCreationDraft>) ||
  model<IPostCreationDraft>("PostCreationDraft", PostCreationDraftSchema);

export default PostCreationDraftModel;
export { PostCreationDraftModel };
