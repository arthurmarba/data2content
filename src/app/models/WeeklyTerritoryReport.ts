// src/app/models/WeeklyTerritoryReport.ts
//
// O snapshot CONGELADO de uma semana × território. É a memória do relatório.
//
// POR QUE CONGELAR em vez de recalcular: `Metric.stats` é cumulativo e reescrito a
// cada sync do Instagram (ver src/app/lib/instagram/db/metricActions.ts, upsert). Um
// post da semana 27 continua acumulando views hoje. Recalcular o ranking da semana 27
// agora dá um número diferente do que dava naquela semana — a coluna de movimento
// (▲3 / ▼2 / novo) mediria a mudança do passado, não a da semana. Então cada semana é
// gravada uma vez, com o número que ela tinha quando fechou, e nunca reescrita.
//
// Consequência operacional: semana que não roda o job é semana perdida para sempre.
// É por isso que este modelo vem antes de qualquer tela.
//
// Desde 26/09/2026 os NÚMEROS que alimentam o retrato também ficam congelados, em
// `WeeklyStatsFreeze`. Refechar dias depois usa esses números e só completa a leitura
// de cena; `coverage` diz quanto da semana o retrato conseguiu ler.

import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { ElementKind, ReportMetric } from "@/app/lib/relatorio/types";

export interface IWeeklyMetricIndex {
  metric: ReportMetric;
  index: number;
}

/** Uma linha de ranking congelada. */
export interface IWeeklyTerritoryElement {
  kind: ElementKind;
  /** Chave estável entre semanas — é por ela que o movimento é calculado. */
  key: string;
  label: string;
  /** Posição no ranking da semana, 1-based, dentro de (território, kind, sortedBy). */
  rank: number;
  occurrences: number;
  creators: number;
  occurrencesInWindow: number;
  metrics: IWeeklyMetricIndex[];
  fitsCount: number;
  fitsOutOf: number;
  pullsDown: boolean;
  evidence: string;
}

/** Quanto da semana do território o retrato conseguiu ler. */
export interface IWeeklyTerritoryCoverage {
  posts: number;
  /** Com alcance ou visualização. */
  withStats: number;
  /** Com números congelados; os demais entraram com o número do dia. */
  frozen: number;
  classified: number;
  /** Com leitura de cena — a fonte de assunto, tom, asset e gancho. */
  sceneRead: number;
  /** Quando a semana ganhou os primeiros números congelados. null = nunca. */
  statsFrozenAt: Date | null;
}

export interface IWeeklyTerritoryReport extends Document {
  /** "2026-W30". Chave humana e ordenável. */
  weekKey: string;
  isoYear: number;
  isoWeek: number;
  weekStartsAt: Date;
  weekEndsAt: Date;
  territoryId: string;
  territoryLabel: string;
  /** Cabeçalho fixo das telas do território. */
  posts: number;
  creators: number;
  narratives: number;
  /** Média de engajamento do território na semana — o denominador dos índices. */
  engagementMean: number;
  engagementDeltaPct: number | null;
  /** Ordenação declarada por kind: {"asset":"comentarios"}. */
  sortedBy: Record<string, ReportMetric>;
  elements: IWeeklyTerritoryElement[];
  /** Posição do território na visão geral desta semana — movimento da tela 02. */
  overviewRank: number | null;
  /**
   * Quem ganhou destaque nesta semana. O prêmio não repete na semana seguinte, e a
   * regra precisa ser lida do snapshot, não recalculada.
   */
  highlightWinners: string[];
  /** Ausente nos retratos gravados antes de 27/09/2026. */
  coverage?: IWeeklyTerritoryCoverage;
  cutoff: {
    minOccurrences: number;
    minCreators: number;
    minWeekOccurrences: number;
    minWeekCreators: number;
    windowDays: number;
  };
  generatedAt: Date;
  schemaVersion: "weekly_territory_report_v1";
  createdAt: Date;
  updatedAt: Date;
}

const metricIndexSchema = new Schema<IWeeklyMetricIndex>(
  {
    metric: { type: String, required: true },
    index: { type: Number, required: true },
  },
  { _id: false },
);

const elementSchema = new Schema<IWeeklyTerritoryElement>(
  {
    kind: { type: String, required: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    rank: { type: Number, required: true },
    occurrences: { type: Number, required: true, default: 0 },
    creators: { type: Number, required: true, default: 0 },
    occurrencesInWindow: { type: Number, required: true, default: 0 },
    metrics: { type: [metricIndexSchema], default: [] },
    fitsCount: { type: Number, default: 0 },
    fitsOutOf: { type: Number, default: 0 },
    pullsDown: { type: Boolean, default: false },
    evidence: { type: String, default: "indicio" },
  },
  { _id: false },
);

const weeklyTerritoryReportSchema = new Schema<IWeeklyTerritoryReport>(
  {
    weekKey: { type: String, required: true, index: true },
    isoYear: { type: Number, required: true },
    isoWeek: { type: Number, required: true },
    weekStartsAt: { type: Date, required: true },
    weekEndsAt: { type: Date, required: true },
    territoryId: { type: String, required: true, index: true },
    territoryLabel: { type: String, required: true },
    posts: { type: Number, required: true, default: 0 },
    creators: { type: Number, required: true, default: 0 },
    narratives: { type: Number, required: true, default: 0 },
    engagementMean: { type: Number, required: true, default: 0 },
    engagementDeltaPct: { type: Number, default: null },
    sortedBy: { type: Schema.Types.Mixed, default: {} },
    elements: { type: [elementSchema], default: [] },
    overviewRank: { type: Number, default: null },
    highlightWinners: { type: [String], default: [] },
    coverage: {
      type: new Schema<IWeeklyTerritoryCoverage>(
        {
          posts: { type: Number, default: 0 },
          withStats: { type: Number, default: 0 },
          frozen: { type: Number, default: 0 },
          classified: { type: Number, default: 0 },
          sceneRead: { type: Number, default: 0 },
          statsFrozenAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: undefined,
    },
    cutoff: {
      minOccurrences: { type: Number, required: true },
      minCreators: { type: Number, required: true },
      minWeekOccurrences: { type: Number, default: 2 },
      minWeekCreators: { type: Number, default: 2 },
      windowDays: { type: Number, required: true },
    },
    generatedAt: { type: Date, required: true, default: () => new Date() },
    schemaVersion: {
      type: String,
      required: true,
      default: "weekly_territory_report_v1",
      enum: ["weekly_territory_report_v1"],
    },
  },
  { timestamps: true, collection: "weekly_territory_reports" },
);

// Uma linha por semana × território. O job é idempotente por upsert nesta chave.
weeklyTerritoryReportSchema.index({ weekKey: 1, territoryId: 1 }, { unique: true });
// Leitura do movimento: "o mesmo território, N semanas atrás".
weeklyTerritoryReportSchema.index({ territoryId: 1, weekStartsAt: -1 });

const WeeklyTerritoryReportModel: Model<IWeeklyTerritoryReport> =
  (mongoose.models.WeeklyTerritoryReport as Model<IWeeklyTerritoryReport>) ||
  mongoose.model<IWeeklyTerritoryReport>("WeeklyTerritoryReport", weeklyTerritoryReportSchema);

export default WeeklyTerritoryReportModel;
export type { Types };
