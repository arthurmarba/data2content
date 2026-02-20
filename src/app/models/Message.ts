import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMessage extends Document {
    _id: Types.ObjectId;
    threadId: Types.ObjectId;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokens?: number;
    metadata?: any;
    createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
    {
        threadId: { type: Schema.Types.ObjectId, ref: 'Thread', required: true, index: true },
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        tokens: { type: Number },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ threadId: 1, createdAt: 1 });

const MessageModel: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>("Message", messageSchema);

export default MessageModel;
