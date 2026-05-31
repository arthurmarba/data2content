// src/app/models/MapaSeed.ts
// Modelo que armazena o mapa seed gerado pelo onboarding declarativo
// e enriquecido progressivamente por Instagram e vídeos.

import mongoose, { Schema, Document, Model, Types } from "mongoose";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type MapaMaturidade =
  | "seed"               // apenas onboarding declarativo
  | "instagram_enriched" // enriquecido com Instagram
  | "video_enriched";    // enriquecido com pelo menos 1 vídeo published

export type MapaFonte = "onboarding_declarativo" | "instagram" | "video";

export type AmostragemInstagram = "suficiente" | "baixa" | "insuficiente";

// ─── Respostas do Onboarding ──────────────────────────────────────────────────

export interface IOnboardingAnswers {
  /** "Como você se apresentaria para alguém que nunca te viu criar?" */
  apresentacao: string;
  /** "Por que você cria conteúdo? O que te move a fazer isso?" */
  motivacao: string;
  /** "Se seu conteúdo tivesse um fio condutor, qual seria?" */
  fioConductor: string;
  /** "Sobre quais assuntos você se sente legítimo para falar?" */
  territorios: string;
  /** "O que mais na sua vida poderia se conectar com o que você cria?" */
  adjacencias: string;
  /** "Como você quer falar com quem te acompanha?" */
  tom: string;
  /** "Em quais formatos você se sente mais à vontade para criar?" */
  formatos: string;
}

// ─── Estrutura do Mapa ────────────────────────────────────────────────────────

export interface IMapaData {
  narrativa_central: string;
  territorios: string[];
  narrativas_adjacentes: string[];
  assets: string[];
  tom: string;
  formatos: string[];
  maturidade: MapaMaturidade;
  fonte: MapaFonte[];
  observacoes?: string[];
  amostragem_instagram?: AmostragemInstagram;
}

// ─── Leitura Inaugural ───────────────────────────────────────────────────────

export interface ILeituraInaugural {
  narrativa_central: string;
  territorios: string;
  nao_aparece: string;
  como_fala: string;
  geradaEm: Date;
}

// ─── Document interface ───────────────────────────────────────────────────────

export interface IMapaSeed extends Document {
  userId: Types.ObjectId;
  onboardingAnswers: IOnboardingAnswers;
  mapa: IMapaData;
  leituraInaugural?: ILeituraInaugural;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const OnboardingAnswersSchema = new Schema<IOnboardingAnswers>(
  {
    apresentacao:  { type: String, required: true },
    motivacao:     { type: String, required: true },
    fioConductor:  { type: String, required: true },
    territorios:   { type: String, required: true },
    adjacencias:   { type: String, required: true },
    tom:           { type: String, required: true },
    formatos:      { type: String, required: true },
  },
  { _id: false }
);

const MapaDataSchema = new Schema<IMapaData>(
  {
    narrativa_central:      { type: String, required: true },
    territorios:            { type: [String], default: [] },
    narrativas_adjacentes:  { type: [String], default: [] },
    assets:                 { type: [String], default: [] },
    tom:                    { type: String, required: true },
    formatos:               { type: [String], default: [] },
    maturidade: {
      type: String,
      enum: ["seed", "instagram_enriched", "video_enriched"],
      default: "seed",
    },
    fonte: {
      type: [String],
      enum: ["onboarding_declarativo", "instagram", "video"],
      default: ["onboarding_declarativo"],
    },
    observacoes:           { type: [String], default: [] },
    amostragem_instagram: {
      type: String,
      enum: ["suficiente", "baixa", "insuficiente", null],
      default: null,
    },
  },
  { _id: false }
);

const LeituraInauguralSchema = new Schema<ILeituraInaugural>(
  {
    narrativa_central: { type: String, required: true },
    territorios:       { type: String, required: true },
    nao_aparece:       { type: String, required: true },
    como_fala:         { type: String, required: true },
    geradaEm:          { type: Date, default: () => new Date() },
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const MapaSeedSchema = new Schema<IMapaSeed>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    onboardingAnswers: {
      type: OnboardingAnswersSchema,
      required: true,
    },
    mapa: {
      type: MapaDataSchema,
      required: true,
    },
    leituraInaugural: {
      type: LeituraInauguralSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "mapasseed",
  }
);

// ─── Model export ─────────────────────────────────────────────────────────────

const MapaSeed: Model<IMapaSeed> =
  (mongoose.models.MapaSeed as Model<IMapaSeed>) ||
  mongoose.model<IMapaSeed>("MapaSeed", MapaSeedSchema);

export default MapaSeed;
