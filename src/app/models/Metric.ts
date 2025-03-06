// src/app/models/Metric.ts

import { Schema, model, models } from "mongoose";

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
 * Observação: Geralmente é usado como um "log" ou "histórico" de métricas para cada conteúdo.
 */
const metricSchema = new Schema(
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
export const Metric = models.Metric || model("Metric", metricSchema);
