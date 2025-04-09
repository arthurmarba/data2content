import { Schema, model, models, Document, Model, Types } from "mongoose";

// VALID_FORMATS - Definidos aqui para referência no Schema, mas a lista canônica está em classification.ts
const DEFAULT_FORMAT = 'Desconhecido';

/**
 * Interface que define a estrutura de um documento Metric
 * <<< MODIFICADO v3.2: Adicionado format, proposal e context >>>
 */
export interface IMetric extends Document {
  user: Types.ObjectId;
  postLink: string;
  description: string;
  postDate: Date;
  // <<< CAMPOS DE CLASSIFICAÇÃO >>>
  format?: string;                    // <<< NOVO >>> Ex: Reel, Foto, Carrossel, Story, Live, Desconhecido
  proposal?: string;                  // Ex: Dica, Tutorial, Notícia, Venda, Pessoal, Outro
  context?: string;                   // Ex: Marketing Digital, Fitness, Viagem, Culinária, Geral, Outro
  // <<< FIM CAMPOS DE CLASSIFICAÇÃO >>>
  rawData: unknown[];
  stats: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Metric:
 * Representa um registro de métricas extraídas (...)
 * <<< MODIFICADO v3.2: Inclui descrição de format, proposal e context >>>
 * (...)
 */
const metricSchema = new Schema<IMetric>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    postLink: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    postDate: {
      type: Date,
      required: true,
      index: true,
    },

    // <<< NOVO >>> Definição do campo format no schema
    format: {
      type: String,
      default: DEFAULT_FORMAT, // Valor padrão
      index: true,        // Indexar para performance
      trim: true,
    },
    proposal: {
      type: String,
      default: "Outro",
      index: true,
      trim: true,
    },
    context: {
      type: String,
      default: "Geral",
      index: true,
      trim: true,
    },
    // <<< FIM CAMPOS DE CLASSIFICAÇÃO >>>

    rawData: {
      type: Array,
      default: [],
    },
    stats: {
      type: Object,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  // { timestamps: true } // Alternativa
);

/**
 * Índices para facilitar buscas:
 */
metricSchema.index({ user: 1, createdAt: -1 });
metricSchema.index({ user: 1, postDate: -1 });
// <<< NOVO >>> Índice composto otimizado para agregações por Formato/Proposta/Contexto
metricSchema.index({ user: 1, format: 1, proposal: 1, context: 1, postDate: -1 });


const MetricModel = models.Metric
  ? (models.Metric as Model<IMetric>)
  : model<IMetric>("Metric", metricSchema);

export default MetricModel;
export { MetricModel as Metric };