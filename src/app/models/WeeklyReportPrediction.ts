// src/app/models/WeeklyReportPrediction.ts
//
// A previsão da semana e o seu resultado (telas 02 e 21).
//
// A previsão só vale se for FALSIFICÁVEL antes de ser medida. Por isso ela não é uma
// frase solta: é uma frase MAIS os elementos estruturados que a semana seguinte vai
// procurar nos posts, MAIS a métrica em que a aposta é decidida. Sem isso, "acertamos
// em 3 territórios" é uma opinião escrita depois do fato.
//
// `tested` = posts da semana seguinte que contêm os elementos previstos.
// `worked`  = quantos desses bateram o limiar na métrica prevista.
// Nenhum dos dois pode ser preenchido à mão.

import mongoose, { Schema, Document, Model } from "mongoose";
import type { ElementKind, ReportMetric } from "@/app/lib/relatorio/types";

export interface IPredictionElement {
  kind: ElementKind;
  key: string;
}

export interface IWeeklyReportPrediction extends Document {
  /** Semana em que a previsão foi FEITA ("2026-W30"). */
  weekKey: string;
  territoryId: string | null;
  /** A frase que vai no slide 21. */
  statement: string;
  /** Onde a gente acha que não vale. Escrito ANTES, não depois. */
  caveat: string | null;
  /** O que a próxima semana vai procurar nos posts. */
  elements: IPredictionElement[];
  /** Métrica em que a aposta é decidida. */
  metric: ReportMetric;
  /** Índice que conta como "funcionou". 1,3 = 30% acima da média do território. */
  successThreshold: number;
  // ── Resolução, escrita pelo job da semana seguinte ──
  resolvedAt: Date | null;
  /** Semana em que foi medida ("2026-W31"). */
  resolvedWeekKey: string | null;
  tested: number | null;
  worked: number | null;
  /** Leitura curta do resultado, gerada na composição. */
  outcomeNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const predictionElementSchema = new Schema<IPredictionElement>(
  {
    kind: { type: String, required: true },
    key: { type: String, required: true },
  },
  { _id: false },
);

const weeklyReportPredictionSchema = new Schema<IWeeklyReportPrediction>(
  {
    weekKey: { type: String, required: true, index: true },
    territoryId: { type: String, default: null, index: true },
    statement: { type: String, required: true, trim: true },
    caveat: { type: String, default: null, trim: true },
    elements: { type: [predictionElementSchema], default: [] },
    metric: { type: String, required: true },
    successThreshold: { type: Number, required: true, default: 1.3 },
    resolvedAt: { type: Date, default: null },
    resolvedWeekKey: { type: String, default: null },
    tested: { type: Number, default: null },
    worked: { type: Number, default: null },
    outcomeNote: { type: String, default: null },
  },
  { timestamps: true, collection: "weekly_report_predictions" },
);

// Uma previsão por semana × território (territoryId null = previsão da plataforma).
weeklyReportPredictionSchema.index({ weekKey: 1, territoryId: 1 }, { unique: true });
// "Quais previsões ainda não foram resolvidas" — a fila do job de composição.
weeklyReportPredictionSchema.index({ resolvedAt: 1, weekKey: 1 });

const WeeklyReportPredictionModel: Model<IWeeklyReportPrediction> =
  (mongoose.models.WeeklyReportPrediction as Model<IWeeklyReportPrediction>) ||
  mongoose.model<IWeeklyReportPrediction>("WeeklyReportPrediction", weeklyReportPredictionSchema);

export default WeeklyReportPredictionModel;
