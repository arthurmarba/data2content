// src/app/models/DailyMetricSnapshot.ts - v1.2.0
// OTTIMIZAÇÃO: A análise confirmou que os índices existentes neste modelo
// já são ideais para as funcionalidades planejadas, como o "Top Movers".
// O índice `{ metric: 1, date: -1 }` é perfeito para buscar o histórico de
// um post específico em diferentes períodos. Nenhuma alteração é necessária.

import { Schema, model, models, Document, Model, Types } from "mongoose";
import { IMetric } from "./Metric";

export interface IDailyMetricSnapshot extends Document {
  metric: Types.ObjectId | IMetric;
  date: Date;
  dayNumber?: number;
  dailyViews?: number;
  dailyLikes?: number;
  dailyComments?: number;
  dailyShares?: number;
  dailySaved?: number;
  dailyReach?: number;
  dailyFollows?: number;
  dailyProfileVisits?: number;
  dailyReelsVideoViewTotalTime?: number;
  dailyImpressions?: number;
  cumulativeViews?: number;
  cumulativeLikes?: number;
  cumulativeComments?: number;
  cumulativeShares?: number;
  cumulativeSaved?: number;
  cumulativeReach?: number;
  cumulativeImpressions?: number;
  cumulativeFollows?: number;
  cumulativeProfileVisits?: number;
  cumulativeTotalInteractions?: number;
  cumulativeReelsVideoViewTotalTime?: number;
  currentReelsAvgWatchTime?: number;
}

const dailyMetricSnapshotSchema = new Schema<IDailyMetricSnapshot>(
  {
    metric: {
      type: Schema.Types.ObjectId,
      ref: "Metric",
      required: [true, "A referência à métrica original (metric) é obrigatória."],
    },
    date: {
      type: Date,
      required: [true, "A data do snapshot é obrigatória."],
    },
    dayNumber: { type: Number },
    // ... (demais campos do schema sem alterações)
    dailyViews: { type: Number, default: 0 },
    dailyLikes: { type: Number, default: 0 },
    dailyComments: { type: Number, default: 0 },
    dailyShares: { type: Number, default: 0 },
    dailySaved: { type: Number, default: 0 },
    dailyReach: { type: Number, default: 0 },
    dailyFollows: { type: Number, default: 0 },
    dailyProfileVisits: { type: Number, default: 0 },
    dailyReelsVideoViewTotalTime: { type: Number, default: 0 },
    dailyImpressions: { type: Number, default: 0 },
    cumulativeViews: { type: Number, default: 0 },
    cumulativeLikes: { type: Number, default: 0 },
    cumulativeComments: { type: Number, default: 0 },
    cumulativeShares: { type: Number, default: 0 },
    cumulativeSaved: { type: Number, default: 0 },
    cumulativeReach: { type: Number, default: 0 },
    cumulativeImpressions: { type: Number, default: 0 },
    cumulativeFollows: { type: Number, default: 0 },
    cumulativeProfileVisits: { type: Number, default: 0 },
    cumulativeTotalInteractions: { type: Number, default: 0 },
    cumulativeReelsVideoViewTotalTime: { type: Number, default: 0 },
    currentReelsAvgWatchTime: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "daily_metric_snapshots",
  }
);

// Índices existentes já são ótimos.
dailyMetricSnapshotSchema.index(
  { metric: 1, date: 1 },
  { unique: true, name: "idx_metric_date_unique" }
);
dailyMetricSnapshotSchema.index(
  { metric: 1, date: -1 },
  { name: "idx_metric_history" }
);
dailyMetricSnapshotSchema.index(
    { metric: 1, dayNumber: 1 },
    { name: "idx_metric_dayNumber" }
);

const DailyMetricSnapshotModel =
  (models.DailyMetricSnapshot as Model<IDailyMetricSnapshot>) ||
  model<IDailyMetricSnapshot>(
    "DailyMetricSnapshot",
    dailyMetricSnapshotSchema
  );

export default DailyMetricSnapshotModel;
