// src/app/models/VideoAsset.ts
// Representa um vídeo submetido para análise de coerência.
// Inclui o resultado da análise e o estado do Stream A.
//
// Stream A:
//   pending   → analisado, aguarda declaração do criador
//   published → criador confirmou que vai publicar → alimenta o mapa
//   discarded → criador decidiu não publicar → sinal descartado

import mongoose, { Schema, Document, Model, Types } from "mongoose";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type StreamAEstado = "pending" | "published" | "discarded";

export interface ICoerenciaResult {
  /** O vídeo conecta com a narrativa central do mapa? */
  conecta: boolean;
  /** Justificativa em linguagem natural (max ~100 palavras) */
  justificativa: string;
  /** O que no vídeo ressoa com o mapa */
  pontos_de_conexao: string[];
  /** O que no vídeo diverge do mapa (pode ser vazio) */
  pontos_de_divergencia: string[];
}

export interface IStreamA {
  estado: StreamAEstado;
  respondidoEm: Date | null;
}

// ─── Document interface ───────────────────────────────────────────────────────

export interface IVideoAsset extends Document {
  userId: Types.ObjectId;
  /** URL do vídeo (YouTube, Instagram, etc.) — opcional */
  videoUrl: string | null;
  titulo: string;
  descricao: string | null;
  /** Resultado da análise de coerência */
  coerencia: ICoerenciaResult;
  /** Estado do Stream A */
  streamA: IStreamA;
  /** true = teste gratuito (não exige assinatura) */
  isFreeTrial: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CoerenciaResultSchema = new Schema<ICoerenciaResult>(
  {
    conecta:                { type: Boolean, required: true },
    justificativa:          { type: String,  required: true },
    pontos_de_conexao:      { type: [String], default: [] },
    pontos_de_divergencia:  { type: [String], default: [] },
  },
  { _id: false }
);

const StreamASchema = new Schema<IStreamA>(
  {
    estado: {
      type: String,
      enum: ["pending", "published", "discarded"],
      default: "pending",
      required: true,
    },
    respondidoEm: { type: Date, default: null },
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const VideoAssetSchema = new Schema<IVideoAsset>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    videoUrl:    { type: String, default: null },
    titulo:      { type: String, required: true },
    descricao:   { type: String, default: null },
    coerencia: {
      type: CoerenciaResultSchema,
      required: true,
    },
    streamA: {
      type: StreamASchema,
      default: () => ({ estado: "pending", respondidoEm: null }),
    },
    isFreeTrial: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "videoassets",
  }
);

// ─── Model export ─────────────────────────────────────────────────────────────

const VideoAsset: Model<IVideoAsset> =
  (mongoose.models.VideoAsset as Model<IVideoAsset>) ||
  mongoose.model<IVideoAsset>("VideoAsset", VideoAssetSchema);

export default VideoAsset;
