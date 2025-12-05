import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISharedLink extends Document {
    token: string;
    metricId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    config: {
        expiresAt?: Date;
        liveUpdate: boolean;
    };
    revokedAt?: Date;
    clicks: number;
    createdAt: Date;
    updatedAt: Date;
}

const SharedLinkSchema = new Schema<ISharedLink>({
    token: { type: String, unique: true, required: true, index: true },
    metricId: { type: Schema.Types.ObjectId, ref: 'Metric', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    config: {
        expiresAt: { type: Date },
        liveUpdate: { type: Boolean, default: false },
    },
    revokedAt: { type: Date },
    clicks: { type: Number, default: 0 }
}, { timestamps: true });

const SharedLinkModel: Model<ISharedLink> = mongoose.models.SharedLink || mongoose.model<ISharedLink>('SharedLink', SharedLinkSchema);

export default SharedLinkModel;
