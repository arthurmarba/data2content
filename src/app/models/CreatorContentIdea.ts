/**
 * CreatorContentIdea
 *
 * Pautas (content ideas) generated from the creator's confirmed narrative map.
 * Each idea is derived from: narrativa central + território + asset + tom + formato.
 *
 * Lifecycle:
 *   active     → freshly generated, awaiting creator review
 *   saved      → creator marked as "want to develop"
 *   dismissed  → creator marked as "doesn't fit my map"
 *   superseded → rotated out by a newer generation batch (not a creator signal)
 *
 * Dismissals inform future generations (Phase 3b — feedback loop).
 * Superseded ideas are hidden from the card but kept for history/debugging.
 * Saved/posted ideas are deliberate keeps and are never superseded.
 */
import mongoose, { Schema, Types, Document, model } from "mongoose";
import type { ContentIdeaScriptBlueprint } from "@/app/dashboard/boards/videoUpload/contentIdeaBlueprint";
import type { ContentIdeaMapAnchor } from "@/app/dashboard/boards/videoUpload/contentIdeaMapAnchors";

export type CreatorContentIdeaStatus =
  | "active"
  | "saved"
  | "dismissed"
  | "posted"
  | "superseded";
export type CreatorContentIdeaSource = "gemini_v1" | "manual_seed" | "gpt4o_v1";

export interface ICreatorContentIdea extends Document {
  userId: Types.ObjectId;
  status: CreatorContentIdeaStatus;
  source: CreatorContentIdeaSource;

  // ── Idea content (derived from map) ────────────────────────────────────────
  title: string;
  /** Why this angle is specific to THIS creator's map (1-2 sentences) */
  angle: string;
  /** Opening hook for the video (1 sentence) */
  hook: string;
  /** Confirmed territory this idea connects to */
  territory: string;
  /** Life-asset labels this idea involves */
  assets: string[];
  /** Suggested format (Reels, Carousel, Static, Story) */
  suggestedFormat: string;
  /** Tone signal injected from the map */
  tone: string | null;
  /** Why this fits the creator's specific map */
  whyItFits: string;
  /** Dimensões confirmadas do "Seu mapa" que originaram a pauta. */
  mapAnchors: ContentIdeaMapAnchor[];

  // ── Script directional (Fase 3a) ───────────────────────────────────────────
  /** 2-3 ordered scene/moment points for the video — directional, not a full script */
  scriptPoints: string[];
  /** Suggested video closing — a question, invitation, or final insight (1 short phrase) */
  scriptClosing: string | null;
  /** Storyboard visual estruturado. Null em pautas antigas, resolvido por fallback na leitura. */
  scriptBlueprint: ContentIdeaScriptBlueprint | null;

  // ── Audience match (Etapa 9 × Audiência) ───────────────────────────────────
  /**
   * Metade-audiência do "match": por que esta pauta é justamente o que as pessoas
   * mais guardam do criador. Null quando a pauta não toca num sinal de reconhecimento.
   */
  resonanceNote: string | null;

  // ── Scheduling (OS Diário) ─────────────────────────────────────────────────
  /** Date the creator scheduled this idea to publish. Null when unscheduled. */
  scheduledFor: Date | null;
  /** Date the creator marked this idea as posted (status="posted"). */
  postedAt: Date | null;

  // ── Generation context (for debugging + future feedback loop) ─────────────
  mapContextHash: string; // hash of the map state at generation time
  modelVersion: string;
  generatedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const CreatorContentIdeaSchema = new Schema<ICreatorContentIdea>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "saved", "dismissed", "posted", "superseded"],
      default: "active",
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["gemini_v1", "manual_seed", "gpt4o_v1"],
      default: "gemini_v1",
      required: true,
    },
    title: { type: String, required: true, maxlength: 160 },
    angle: { type: String, required: true, maxlength: 400 },
    hook: { type: String, required: true, maxlength: 220 },
    territory: { type: String, required: true, maxlength: 120 },
    assets: { type: [String], default: [] },
    suggestedFormat: { type: String, required: true, maxlength: 60 },
    tone: { type: String, default: null, maxlength: 80 },
    whyItFits: { type: String, required: true, maxlength: 400 },
    mapAnchors: {
      type: [
        new Schema<ContentIdeaMapAnchor>(
          {
            kind: { type: String, enum: ["subject", "situation", "scene", "voice"], required: true },
            source: { type: String, enum: ["territories", "themes", "assets", "tone"], required: true },
            label: { type: String, required: true, maxlength: 120 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    scriptPoints: { type: [String], default: [] },
    scriptClosing: { type: String, default: null, maxlength: 160 },
    scriptBlueprint: { type: Schema.Types.Mixed, default: null },
    resonanceNote: { type: String, default: null, maxlength: 200 },
    scheduledFor: { type: Date, default: null },
    postedAt: { type: Date, default: null },
    mapContextHash: { type: String, required: true, maxlength: 64 },
    modelVersion: { type: String, required: true, default: "gemini_v1" },
    generatedAt: { type: Date, default: Date.now, required: true },
  },
  {
    timestamps: true,
    collection: "creatorcontentideas",
  },
);

CreatorContentIdeaSchema.index({ userId: 1, status: 1, generatedAt: -1 });
CreatorContentIdeaSchema.index({ userId: 1, generatedAt: -1 });

const CreatorContentIdea =
  (mongoose.models.CreatorContentIdea as mongoose.Model<ICreatorContentIdea>) ||
  model<ICreatorContentIdea>("CreatorContentIdea", CreatorContentIdeaSchema);

export default CreatorContentIdea;
