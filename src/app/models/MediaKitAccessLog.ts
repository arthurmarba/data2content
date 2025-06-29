import { Schema, model, models, Document, Types, Model } from "mongoose";

export interface IMediaKitAccessLog extends Document {
  user: Types.ObjectId;
  ip: string;
  referer?: string;
  timestamp: Date;
}

const mediaKitAccessLogSchema = new Schema<IMediaKitAccessLog>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  ip: { type: String, required: true },
  referer: { type: String },
  timestamp: { type: Date, required: true, default: Date.now },
});

// Índices para consultas por usuário e ordenação por data
mediaKitAccessLogSchema.index({ user: 1 });
mediaKitAccessLogSchema.index({ timestamp: -1 });

const MediaKitAccessLogModel: Model<IMediaKitAccessLog> =
  models.MediaKitAccessLog ||
  model<IMediaKitAccessLog>("MediaKitAccessLog", mediaKitAccessLogSchema);

export default MediaKitAccessLogModel;

