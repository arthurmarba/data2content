import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IThread extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    title: string;
    isFavorite: boolean;
    lastActivityAt: Date;
    summary?: string;
    metadata?: {
        tokenCount?: number;
        platform?: string;
        [key: string]: any;
    };
    createdAt: Date;
    updatedAt: Date;
}

const threadSchema = new Schema<IThread>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true, default: 'Nova Conversa' },
        isFavorite: { type: Boolean, default: false, index: true },
        lastActivityAt: { type: Date, default: Date.now, index: true },
        summary: { type: String },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

// Índices para listagem rápida
threadSchema.index({ userId: 1, lastActivityAt: -1 });

// Retention Policy: Auto-delete non-favorite threads after 90 days of inactivity
threadSchema.index(
    { lastActivityAt: 1 },
    {
        expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days 
        partialFilterExpression: { isFavorite: false } // Only apply to non-favorites
    }
);

const ThreadModel: Model<IThread> = mongoose.models.Thread || mongoose.model<IThread>("Thread", threadSchema);

export default ThreadModel;
