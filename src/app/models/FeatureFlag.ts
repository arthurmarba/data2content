import mongoose, { Schema, Document, Model, models } from 'mongoose';

export interface IFeatureFlag extends Document {
  key: string;
  description?: string;
  defaultValue: boolean;
  environments: {
    development?: boolean;
    staging?: boolean;
    production?: boolean;
    [key: string]: boolean | undefined;
  };
  updatedBy?: Schema.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    key: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    defaultValue: { type: Boolean, default: false },
    environments: {
      development: { type: Boolean, default: undefined },
      staging: { type: Boolean, default: undefined },
      production: { type: Boolean, default: undefined },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

FeatureFlagSchema.statics.getValue = async function getValue(
  this: Model<IFeatureFlag>,
  key: string,
  env: string,
) {
  const flag = await this.findOne({ key }).lean().exec();
  if (!flag) return null;
  const envValue = flag.environments?.[env as keyof typeof flag.environments];
  if (typeof envValue === 'boolean') return envValue;
  return flag.defaultValue ?? false;
};

const FeatureFlag =
  (models.FeatureFlag as mongoose.Model<IFeatureFlag>) ||
  mongoose.model<IFeatureFlag>('FeatureFlag', FeatureFlagSchema);

export default FeatureFlag;
