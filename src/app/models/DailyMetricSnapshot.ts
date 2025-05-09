// src/app/models/DailyMetricSnapshot.ts - v1.1.0 (Adiciona Métricas de Reels)
// - Adicionados campos para métricas específicas de Reels:
//   - currentReelsAvgWatchTime (valor mais recente do tempo médio de visualização)
//   - dailyReelsVideoViewTotalTime (delta diário do tempo total de visualização)
//   - cumulativeReelsVideoViewTotalTime (cumulativo do tempo total de visualização)

import { Schema, model, models, Document, Model, Types } from "mongoose";
import { IMetric } from "./Metric"; // Importa a interface IMetric para referência

/**
 * Interface que define a estrutura de um snapshot diário de métricas.
 * ATUALIZADO v1.1.0: Adiciona campos para métricas específicas de Reels.
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
 * ATUALIZADO v1.1.0: Adiciona campos para métricas de Reels.
 */
const dailyMetricSnapshotSchema = new Schema<IDailyMetricSnapshot>(
  {
    metric: {
      type: Schema.Types.ObjectId,
      ref: "Metric", // Referencia o Modelo Metric
      required: [true, "A referência à métrica original (metric) é obrigatória."],
      index: true, // Indexado para buscas por métrica
    },
    date: {
      type: Date,
      required: [true, "A data do snapshot é obrigatória."],
      index: true, // Indexado para buscas por data
    },
    // Deltas Diários
    dailyViews: { type: Number, default: 0 },
    dailyLikes: { type: Number, default: 0 },
    dailyComments: { type: Number, default: 0 },
    dailyShares: { type: Number, default: 0 },
    dailySaved: { type: Number, default: 0 },
    dailyReach: { type: Number, default: 0 },
    dailyFollows: { type: Number, default: 0 },
    dailyProfileVisits: { type: Number, default: 0 },
    dailyReelsVideoViewTotalTime: { type: Number, default: 0 }, // Novo

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
    cumulativeReelsVideoViewTotalTime: { type: Number, default: 0 }, // Novo

    // Métricas Pontuais/Médias
    currentReelsAvgWatchTime: { type: Number, default: 0 }, // Novo
  },
  {
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
    collection: "daily_metric_snapshots", // Define explicitamente o nome da coleção
  }
);

/**
 * Índices Essenciais para performance e consistência.
 */
// Garante que só existe um snapshot por métrica por dia.
dailyMetricSnapshotSchema.index(
  { metric: 1, date: 1 },
  { unique: true, name: "idx_metric_date_unique" }
);
// Otimiza a busca do histórico de um post e a busca pelo último snapshot.
dailyMetricSnapshotSchema.index(
  { metric: 1, date: -1 },
  { name: "idx_metric_history" }
);

/**
 * Modelo Mongoose para DailyMetricSnapshot.
 * Utiliza o padrão para evitar recompilação do modelo em ambientes como Next.js.
 */
const DailyMetricSnapshotModel =
  (models.DailyMetricSnapshot as Model<IDailyMetricSnapshot>) ||
  model<IDailyMetricSnapshot>(
    "DailyMetricSnapshot",
    dailyMetricSnapshotSchema
  );

export default DailyMetricSnapshotModel;
