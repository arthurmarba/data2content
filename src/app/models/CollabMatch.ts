import mongoose, { Schema, Types, type Document, models } from "mongoose";

export interface ICollabMatch extends Document {
  pairKey: string;
  userA: Types.ObjectId;
  userB: Types.ObjectId;
  territoryNorm: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollabMatchSchema = new Schema<ICollabMatch>(
  {
    // IDs ordenados dos dois documentos de interesse que formaram o match.
    // Assim retries/concorrência não duplicam o evento, mas uma collab futura
    // entre as mesmas pessoas continua possível.
    pairKey: { type: String, required: true, unique: true },
    userA: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userB: { type: Schema.Types.ObjectId, ref: "User", required: true },
    territoryNorm: { type: String, required: true },
  },
  { timestamps: true, collection: "collabmatches" },
);

CollabMatchSchema.index({ userA: 1, userB: 1, territoryNorm: 1 });

const CollabMatch =
  (models.CollabMatch as mongoose.Model<ICollabMatch>) ||
  mongoose.model<ICollabMatch>("CollabMatch", CollabMatchSchema);

export default CollabMatch;
