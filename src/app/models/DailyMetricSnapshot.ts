// src/app/models/DailyMetricSnapshot.ts - v1.2.0 (Adiciona dayNumber e Métricas de Reels)
// - Adicionados campos para métricas específicas de Reels (v1.1.0).
// - ADICIONADO: Campo `dayNumber` para indicar o dia do snapshot em relação ao post.

import { Schema, model, models, Document, Model, Types } from "mongoose";
import { IMetric } from "./Metric"; // Importa a interface IMetric para referência

/**
 * Interface que define a estrutura de um snapshot diário de métricas.
 * ATUALIZADO v1.2.0: Adicionado dayNumber.
 */
export interface IDailyMetricSnapshot extends Document {
  /**
   * Referência ao documento Metric original ao qual este snapshot pertence.
   */
  metric: Types.ObjectId | IMetric;

  /**
   * A data específica para a qual este snapshot se refere.
   * A hora, minutos, segundos e milissegundos devem ser zerados (representando o dia inteiro).
   */
  date: Date;

  /**
   * O número do dia do snapshot em relação à data de criação do post original.
   * Ex: Dia 1, Dia 2, etc. Começa em 1.
   * Este campo deve ser calculado e salvo no momento da criação do snapshot.
   */
  dayNumber?: number; // NOVO CAMPO

  // --- Métricas DELTA (Variação *NAQUELE DIA*) ---
  /** Visualizações ocorridas apenas neste dia. */
  dailyViews?: number;
  /** Curtidas recebidas apenas neste dia. */
  dailyLikes?: number;
  /** Comentários recebidos apenas neste dia. */
  dailyComments?: number;
  /** Compartilhamentos ocorridos apenas neste dia. */
  dailyShares?: number;
  /** Vezes que o post foi salvo apenas neste dia. */
  dailySaved?: number;
  /** Alcance obtido apenas neste dia. */
  dailyReach?: number;
  /** Novos seguidores obtidos através deste post apenas neste dia. */
  dailyFollows?: number;
  /** Visitas ao perfil originadas deste post apenas neste dia. */
  dailyProfileVisits?: number;
  /** Delta diário do tempo total de visualização de Reels (em milissegundos ou segundos, conforme API). */
  dailyReelsVideoViewTotalTime?: number;

  // --- Métricas CUMULATIVAS (Total *ATÉ O FINAL* daquele dia) ---
  /** Total de visualizações acumuladas até o final deste dia. */
  cumulativeViews?: number;
  /** Total de curtidas acumuladas até o final deste dia. */
  cumulativeLikes?: number;
  /** Total de comentários acumulados até o final deste dia. */
  cumulativeComments?: number;
  /** Total de compartilhamentos acumulados até o final deste dia. */
  cumulativeShares?: number;
  /** Total de vezes que o post foi salvo acumulado até o final deste dia. */
  cumulativeSaved?: number;
  /** Total de alcance acumulado até o final deste dia. */
  cumulativeReach?: number;
  /** Total de novos seguidores acumulados através deste post até o final deste dia. */
  cumulativeFollows?: number;
  /** Total de visitas ao perfil acumuladas originadas deste post até o final deste dia. */
  cumulativeProfileVisits?: number;
  /** Total de interações acumuladas (soma principal da API) até o final deste dia. */
  cumulativeTotalInteractions?: number;
  /** Tempo total de visualização de Reels acumulado até o final deste dia. */
  cumulativeReelsVideoViewTotalTime?: number;

  // --- Métricas PONTUAIS/MÉDIAS (Valor do dia) ---
  /** Tempo médio de visualização de Reels (valor mais recente no dia do snapshot). */
  currentReelsAvgWatchTime?: number;
}

/**
 * Schema Mongoose para o modelo DailyMetricSnapshot.
 * ATUALIZADO v1.2.0: Adicionado dayNumber.
 */
const dailyMetricSnapshotSchema = new Schema<IDailyMetricSnapshot>(
  {
    metric: {
      type: Schema.Types.ObjectId,
      ref: "Metric",
      required: [true, "A referência à métrica original (metric) é obrigatória."],
      index: true,
    },
    date: {
      type: Date,
      required: [true, "A data do snapshot é obrigatória."],
      index: true,
    },
    dayNumber: { type: Number, index: true }, // NOVO CAMPO
    // Deltas Diários
    dailyViews: { type: Number, default: 0 },
    dailyLikes: { type: Number, default: 0 },
    dailyComments: { type: Number, default: 0 },
    dailyShares: { type: Number, default: 0 },
    dailySaved: { type: Number, default: 0 },
    dailyReach: { type: Number, default: 0 },
    dailyFollows: { type: Number, default: 0 },
    dailyProfileVisits: { type: Number, default: 0 },
    dailyReelsVideoViewTotalTime: { type: Number, default: 0 },

    // Métricas Cumulativas
    cumulativeViews: { type: Number, default: 0 },
    cumulativeLikes: { type: Number, default: 0 },
    cumulativeComments: { type: Number, default: 0 },
    cumulativeShares: { type: Number, default: 0 },
    cumulativeSaved: { type: Number, default: 0 },
    cumulativeReach: { type: Number, default: 0 },
    cumulativeFollows: { type: Number, default: 0 },
    cumulativeProfileVisits: { type: Number, default: 0 },
    cumulativeTotalInteractions: { type: Number, default: 0 },
    cumulativeReelsVideoViewTotalTime: { type: Number, default: 0 },

    // Métricas Pontuais/Médias
    currentReelsAvgWatchTime: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "daily_metric_snapshots",
  }
);

dailyMetricSnapshotSchema.index(
  { metric: 1, date: 1 },
  { unique: true, name: "idx_metric_date_unique" }
);
dailyMetricSnapshotSchema.index(
  { metric: 1, date: -1 },
  { name: "idx_metric_history" }
);
// Novo índice para consultas que podem usar dayNumber
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
