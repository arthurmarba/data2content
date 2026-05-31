import mongoose, { Schema, Types, Document, model } from "mongoose";

// ─── Subdocument types ────────────────────────────────────────────────────────

export type MapDimensionConfirmationResponse = "yes" | "almost" | "no";
export type MapDimensionConfirmationState = "pending" | "confirmed" | "dismissed";

export type AdjacentNarrativeResponse = "yes" | "almost" | "no";
export type AdjacentNarrativeSource = "detected" | "manual";

export interface IAdjacentNarrativeConfirmation {
  label: string;
  /** "pending" — detected by AI, awaiting creator response. "confirmed" / "dismissed" — creator responded. */
  state: MapDimensionConfirmationState;
  source: AdjacentNarrativeSource;
  response: AdjacentNarrativeResponse | null;
  confirmedAt: Date | null;
}

export interface IMapDimensionConfirmation {
  state: MapDimensionConfirmationState;
  /** The raw creator response — preserved for AI context (almost ≠ yes in intent). */
  response: MapDimensionConfirmationResponse | null;
  confirmedAt: Date | null;
  /** Set when a re-propose occurs: the label that was previously confirmed. */
  previousLabel?: string | null;
}

export type AssetConfirmationResponse = "yes" | "occasional" | "no";

export interface IAssetConfirmation {
  label: string;
  state: MapDimensionConfirmationState;
  response: AssetConfirmationResponse | null;
  confirmedAt: Date | null;
}

// ─── Document interface ───────────────────────────────────────────────────────

export interface ICreatorMapConfirmations extends Document {
  userId: Types.ObjectId;
  narrative: IMapDimensionConfirmation;
  territories: IMapDimensionConfirmation;
  tone: IMapDimensionConfirmation;
  assets: IAssetConfirmation[];
  /**
   * Labels of hypotheses the creator has endorsed ("Faz sentido para mim").
   * Used as a signal by future AI prompts — not yet surfaced in synthesis.
   */
  endorsedHypotheses: string[];
  /**
   * Formats the creator explicitly confirmed as their preferred content formats.
   * Subset of ["Reels", "Carrossel", "Story", "Foto", "Vídeo longo"].
   */
  confirmedFormats: string[];
  /**
   * Etapa 4 — Adjacent narratives detected by AI and validated by creator.
   * Items can be AI-detected ("detected") or creator-added ("manual").
   * State lifecycle: "pending" → "confirmed" | "dismissed".
   */
  adjacentNarratives: IAdjacentNarrativeConfirmation[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Subdocument schemas ──────────────────────────────────────────────────────

const MapDimensionConfirmationSchema = new Schema<IMapDimensionConfirmation>(
  {
    state: {
      type: String,
      enum: ["pending", "confirmed", "dismissed"],
      default: "pending",
      required: true,
    },
    response: {
      type: String,
      enum: ["yes", "almost", "no", null],
      default: null,
    },
    confirmedAt: { type: Date, default: null },
    previousLabel: { type: String, default: null },
  },
  { _id: false },
);

const AssetConfirmationSchema = new Schema<IAssetConfirmation>(
  {
    label: { type: String, required: true },
    state: {
      type: String,
      enum: ["pending", "confirmed", "dismissed"],
      default: "pending",
      required: true,
    },
    response: {
      type: String,
      enum: ["yes", "occasional", "no", null],
      default: null,
    },
    confirmedAt: { type: Date, default: null },
  },
  { _id: false },
);

const AdjacentNarrativeConfirmationSchema = new Schema<IAdjacentNarrativeConfirmation>(
  {
    label: { type: String, required: true },
    state: {
      type: String,
      enum: ["pending", "confirmed", "dismissed"],
      default: "pending",
      required: true,
    },
    source: {
      type: String,
      enum: ["detected", "manual"],
      required: true,
    },
    response: {
      type: String,
      enum: ["yes", "almost", "no", null],
      default: null,
    },
    confirmedAt: { type: Date, default: null },
  },
  { _id: false },
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const CreatorMapConfirmationsSchema = new Schema<ICreatorMapConfirmations>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    narrative: {
      type: MapDimensionConfirmationSchema,
      default: () => ({ state: "pending", response: null, confirmedAt: null }),
    },
    territories: {
      type: MapDimensionConfirmationSchema,
      default: () => ({ state: "pending", response: null, confirmedAt: null }),
    },
    tone: {
      type: MapDimensionConfirmationSchema,
      default: () => ({ state: "pending", response: null, confirmedAt: null }),
    },
    assets: {
      type: [AssetConfirmationSchema],
      default: [],
    },
    endorsedHypotheses: {
      type: [String],
      default: [],
    },
    confirmedFormats: {
      type: [String],
      default: [],
    },
    adjacentNarratives: {
      type: [AdjacentNarrativeConfirmationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "creatormapconfirmations",
  },
);

const CreatorMapConfirmations =
  (mongoose.models.CreatorMapConfirmations as mongoose.Model<ICreatorMapConfirmations>) ||
  model<ICreatorMapConfirmations>("CreatorMapConfirmations", CreatorMapConfirmationsSchema);

export default CreatorMapConfirmations;
