import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface que define a estrutura de um documento Metric
 */
export interface IMetric extends Document {
  user: Types.ObjectId;               // ID do usuário (ObjectId)
  postLink: string;                   // Link do post (Instagram, TikTok, etc.)
  description: string;                // Descrição do conteúdo
  rawData: unknown[];                 // Dados brutos extraídos (ex.: Document AI)
  stats: Record<string, unknown>;     // Objeto de estatísticas consolidadas
  createdAt: Date;                    // Data de criação do registro
}

/**
 * Metric:
 * Representa um registro de métricas extraídas (por Document AI ou outro processo),
 * podendo conter:
 *  - Link do post (postLink)
 *  - Descrição do conteúdo (description)
 *  - Dados brutos extraídos (rawData)
 *  - Objeto de estatísticas consolidadas (stats)
 *  - Data de criação (createdAt)
 *
 * Observação: Geralmente é usado como um "log" ou "histórico" de métricas
 * para cada conteúdo.
 */
const metricSchema = new Schema<IMetric>(
  {
    // Usuário dono das métricas
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Link do conteúdo (Instagram, TikTok, etc.)
    postLink: {
      type: String,
      default: "",
    },

    // Descrição do conteúdo (como inserido pelo usuário)
    description: {
      type: String,
      default: "",
    },

    // Dados brutos extraídos do Document AI ou outro parser
    rawData: {
      type: Array,
      default: [],
    },

    // Objeto com estatísticas consolidadas (ex.: { curtidas: 100, comentarios: 5, ... })
    stats: {
      type: Object,
      default: {},
    },

    // Data de criação do registro (caso não use timestamps nativo)
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Se preferir timestamps automáticos (createdAt/updatedAt),
    // substitua a chave 'createdAt' por timestamps: true e 
    // remova o campo createdAt manual.
    // timestamps: true,
  }
);

/**
 * Índice opcional para facilitar buscas por usuário e data de criação:
 * Exemplo: encontrar os registros de métricas mais recentes de um usuário.
 */
metricSchema.index({ user: 1, createdAt: -1 });

/**
 * Evita recriar o modelo em dev/hot reload:
 * Se já existir "Metric" no models, utiliza-o; caso contrário, cria.
 */
const MetricModel = models.Metric
  ? (models.Metric as Model<IMetric>)
  : model<IMetric>("Metric", metricSchema);

// Exportando tanto como default quanto como named export para compatibilidade
export default MetricModel;
export const Metric = MetricModel;
