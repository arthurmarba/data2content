import { Schema, model, models, Document, Model, Types } from "mongoose";
import { IMetric } from "./Metric"; // Importa a interface IMetric para referência

/**
 * Interface que define a estrutura de um snapshot diário de métricas.
 * Armazena tanto as métricas calculadas para um dia específico (deltas)
 * quanto as métricas cumulativas totais até o final daquele dia, conforme
 * obtidas da API ou outra fonte.
 */
export interface IDailyMetricSnapshot extends Document {
  /**
   * Referência ao documento Metric original ao qual este snapshot pertence.
   */
  metric: Types.ObjectId | IMetric; // Permite popular a referência

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
  // Adicionar outros deltas relevantes se necessário no futuro

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
  // Adicionar outras métricas cumulativas importantes da IMetricStats se necessário
}

/**
 * Schema Mongoose para o modelo DailyMetricSnapshot.
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
// Otimiza buscas gerais por data (ex: snapshots recentes, pruning).
// O índice em 'date' já foi criado na definição do campo, mas podemos reafirmar ou criar um composto se necessário.
// dailyMetricSnapshotSchema.index({ date: -1 }, { name: 'idx_recent_snapshots' }); // Redundante se já indexado acima

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

