import mongoose, { Document, Model, Schema, Types, model } from "mongoose";

import type {
  CarouselCaseDeck,
  CarouselCaseSource,
  CarouselCaseVisualPreset,
} from "@/types/admin/carouselCase";

export interface ICarouselCaseDraft extends Document {
  creatorId: Types.ObjectId;
  creatorName: string;
  visualPreset: CarouselCaseVisualPreset;
  source: CarouselCaseSource;
  deck: CarouselCaseDeck;
  createdBy?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CarouselCaseDraftSchema = new Schema<ICarouselCaseDraft>(
  {
    creatorId: { type: Schema.Types.ObjectId, required: true, index: true },
    creatorName: { type: String, required: true, trim: true },
    visualPreset: {
      type: String,
      enum: ["signature", "spotlight", "editorial"],
      default: "signature",
      index: true,
    },
    source: { type: Schema.Types.Mixed, required: true },
    deck: { type: Schema.Types.Mixed, required: true },
    createdBy: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      email: { type: String, default: null },
    },
  },
  { timestamps: true },
);

CarouselCaseDraftSchema.index({ updatedAt: -1 });
CarouselCaseDraftSchema.index({ creatorId: 1, updatedAt: -1 });

const CarouselCaseDraftModel: Model<ICarouselCaseDraft> =
  (mongoose.models.CarouselCaseDraft as Model<ICarouselCaseDraft>) ||
  model<ICarouselCaseDraft>("CarouselCaseDraft", CarouselCaseDraftSchema);

export default CarouselCaseDraftModel;
