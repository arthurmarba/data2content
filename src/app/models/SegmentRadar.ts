import { Schema, model, models, Document } from 'mongoose';

export interface ISegmentRadar extends Document {
  segmentId: string;
  metrics: Record<string, number | null>;
}

const segmentRadarSchema = new Schema<ISegmentRadar>({
  segmentId: { type: String, required: true, index: true },
  metrics: { type: Schema.Types.Mixed, required: true },
});

export default models.SegmentRadar || model<ISegmentRadar>('SegmentRadar', segmentRadarSchema);
