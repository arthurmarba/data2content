import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export interface IMediaKitSlugAlias extends Document {
  slug: string;
  user: Types.ObjectId;
  canonicalSlug: string;
  createdAt: Date;
  updatedAt: Date;
}

const MediaKitSlugAliasSchema = new Schema<IMediaKitSlugAlias>(
  {
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    canonicalSlug: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

const MediaKitSlugAlias =
  (models.MediaKitSlugAlias as mongoose.Model<IMediaKitSlugAlias>) ||
  model<IMediaKitSlugAlias>('MediaKitSlugAlias', MediaKitSlugAliasSchema);

export default MediaKitSlugAlias;
