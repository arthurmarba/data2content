import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface IMediaKitPdfCache extends Document {
  cacheKey: string;
  contentType: string;
  data: Buffer;
  size: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MediaKitPdfCacheSchema = new Schema<IMediaKitPdfCache>(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    contentType: { type: String, default: 'application/pdf' },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

MediaKitPdfCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const MediaKitPdfCache =
  (models.MediaKitPdfCache as mongoose.Model<IMediaKitPdfCache>) ||
  model<IMediaKitPdfCache>('MediaKitPdfCache', MediaKitPdfCacheSchema);

export default MediaKitPdfCache;
