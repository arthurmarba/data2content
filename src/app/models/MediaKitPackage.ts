import mongoose, { Schema, Types, Document, models, model } from 'mongoose';

export interface IMediaKitPackage extends Document {
    userId: Types.ObjectId;
    name: string;
    price: number;
    currency: string;
    deliverables: string[];
    description?: string;
    order: number;
    type: 'manual' | 'ai_generated';
    createdAt: Date;
    updatedAt: Date;
}

const MediaKitPackageSchema = new Schema<IMediaKitPackage>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            required: true,
            default: 'BRL',
            enum: ['BRL', 'USD', 'EUR'],
        },
        deliverables: {
            type: [String],
            required: true,
            validate: {
                validator: (v: string[]) => Array.isArray(v) && v.length > 0,
                message: 'O pacote deve ter pelo menos um entregável.',
            },
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        order: {
            type: Number,
            required: true,
            default: 0,
        },
        type: {
            type: String,
            enum: ['manual', 'ai_generated'],
            default: 'manual',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
MediaKitPackageSchema.index({ userId: 1, order: 1 });

const MediaKitPackage =
    (models.MediaKitPackage as mongoose.Model<IMediaKitPackage>) ||
    model<IMediaKitPackage>('MediaKitPackage', MediaKitPackageSchema);

export default MediaKitPackage;
