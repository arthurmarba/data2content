// src/app/models/WeeklyStatsFreeze.ts
//
// Os NÚMEROS de cada post da semana, do jeito que estavam quando a semana fechou.
//
// POR QUE EXISTE: `Metric.stats` é cumulativo e reescrito a cada sync. O retrato
// (`WeeklyTerritoryReport`) guarda o resultado do cálculo, mas não os números que o
// alimentaram — então refechar uma semana dias depois (para completar assunto e tom
// quando a leitura de cena atrasa) regravava tudo com os números do dia. Com este
// documento, refechar usa os números da segunda e só completa o que faltava.
//
// Regra: o que estava medido fica; o que faltava completa depois. Um post entra aqui
// no primeiro fechamento que o encontra com número e nunca é reescrito. Post sem
// número (a Meta ainda não devolveu alcance) fica de fora e entra no próximo
// fechamento que o encontrar medido, com o próprio `frozenAt`.
//
// Só os campos que `relatorio/postMetrics.ts` lê (ver `FROZEN_STATS_KEYS`): cabe no
// plano gratuito do Atlas (~100 KB por semana).

import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IFrozenPostStats {
  metric: Types.ObjectId;
  stats: Record<string, number>;
  frozenAt: Date;
}

export interface IWeeklyStatsFreeze extends Document {
  /** "2026-W39" — a mesma chave do retrato. */
  weekKey: string;
  weekStartsAt: Date;
  weekEndsAt: Date;
  posts: IFrozenPostStats[];
  createdAt: Date;
  updatedAt: Date;
}

const frozenPostSchema = new Schema<IFrozenPostStats>(
  {
    metric: { type: Schema.Types.ObjectId, ref: "Metric", required: true },
    stats: { type: Schema.Types.Mixed, required: true },
    frozenAt: { type: Date, required: true },
  },
  { _id: false },
);

const weeklyStatsFreezeSchema = new Schema<IWeeklyStatsFreeze>(
  {
    weekKey: { type: String, required: true },
    weekStartsAt: { type: Date, required: true },
    weekEndsAt: { type: Date, required: true },
    posts: { type: [frozenPostSchema], default: [] },
  },
  { timestamps: true, versionKey: false, collection: "weekly_stats_freezes" },
);

// Um documento por semana. Os posts entram por $push, nunca por substituição.
weeklyStatsFreezeSchema.index({ weekKey: 1 }, { unique: true });

const WeeklyStatsFreezeModel: Model<IWeeklyStatsFreeze> =
  (mongoose.models.WeeklyStatsFreeze as Model<IWeeklyStatsFreeze>) ||
  mongoose.model<IWeeklyStatsFreeze>("WeeklyStatsFreeze", weeklyStatsFreezeSchema);

export default WeeklyStatsFreezeModel;
