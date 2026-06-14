// src/app/models/MapaSeed.ts
// Modelo que armazena o mapa seed gerado pelo onboarding declarativo
// e enriquecido progressivamente por Instagram e vídeos.

import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { sanitizeChipArray } from "@/app/lib/mapaSeed/normalizeChipLabel";

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

/**
 * Grupo de LEITURA de um asset no card "Seu Mapa". `assets` é um POOL FLAT (a
 * geração de pautas consome a lista crua); este agrupamento é só display. A IA não
 * grava grupo — o card o infere por palavra-chave. Mas um asset ADICIONADO
 * manualmente numa seção específica (ex.: "Feira livre" em Cenários) grava aqui o
 * grupo escolhido, para não ser reclassificado pela heurística e pular de seção.
 */
export type LifeAssetGroupKey = "cenario" | "objeto" | "vida";

export interface AssetGroupOverride {
  label: string;
  group: LifeAssetGroupKey;
}

/**
 * Chip que o criador REMOVEU manualmente de uma seção de array. Tombstone: o
 * enriquecimento (Instagram/vídeo) não ressuscita o que o criador apagou — só o
 * criador controla a deleção. Limpo quando ele re-adiciona o mesmo chip.
 */
export interface DismissedChip {
  section: string;
  label: string;
}

export interface IMapaData {
  narrativa_central: string;
  territorios: string[];
  temas: string[];
  narrativas_adjacentes: string[];
  assets: string[];
  /** Overrides de grupo por asset adicionado manualmente. Ver AssetGroupOverride. */
  assetGroups?: AssetGroupOverride[];
  /** Chips removidos pelo criador — o enriquecimento não os ressuscita. Ver DismissedChip. */
  dismissedChips?: DismissedChip[];
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
  /**
   * Timestamps de enriquecimento por fonte. Desacoplam o throttle de cada stream
   * (Instagram × vídeo) — antes ambos disputavam `mapa.maturidade` + `updatedAt`,
   * fazendo o throttle de um falhar quando o outro rodava.
   */
  instagramEnrichedAt?: Date | null;
  videoEnrichedAt?: Date | null;
  /**
   * Seções de array (territorios/temas/assets) que o criador EDITOU manualmente
   * no card. O enriquecimento (Instagram/vídeo) não sobrescreve estas — quem
   * editou, manda. Ver applyEditedArrayLocks.
   */
  editedSections?: string[];
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
    // Pode nascer vazia quando o MapaSeed é auto-criado no enriquecimento de
    // Instagram (usuário conecta o IG sem ter MapaSeed): a própria análise do
    // Instagram preenche a narrativa logo em seguida. Default "" em vez de required.
    narrativa_central:      { type: String, default: "" },
    territorios:            { type: [String], default: [] },
    temas:                  { type: [String], default: [] },
    narrativas_adjacentes:  { type: [String], default: [] },
    assets:                 { type: [String], default: [] },
    // Override de grupo por asset adicionado manualmente (display do card). Array
    // de {label, group} — não Map/objeto — para o label ser VALOR e não nome de
    // campo (MongoDB proíbe "." em nome de campo; labels têm pontos/acentos).
    assetGroups: {
      type: [
        new Schema<AssetGroupOverride>(
          {
            label: { type: String, required: true },
            group: { type: String, enum: ["cenario", "objeto", "vida"], required: true },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    // Tombstones de chips removidos pelo criador — o enriquecimento não ressuscita.
    dismissedChips: {
      type: [
        new Schema<DismissedChip>(
          {
            section: { type: String, required: true },
            label: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    // tom não é cravado no estágio "seed" (onboarding leve só dá a narrativa).
    // Enriquecimento de Instagram/vídeo preenche depois. Default "" em vez de
    // required para permitir o MapaSeed nascer no onboarding (Fase 2A).
    tom:                    { type: String, default: "" },
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
    // Opcional: o onboarding vivo (mobile) coleta um conjunto de respostas mais
    // enxuto e não preenche os 7 campos ricos deste sub-schema. O MapaSeed pode
    // nascer só com a narrativa-semente (Fase 2A); as respostas vivem em User.
    onboardingAnswers: {
      type: OnboardingAnswersSchema,
      default: null,
    },
    mapa: {
      type: MapaDataSchema,
      required: true,
    },
    leituraInaugural: {
      type: LeituraInauguralSchema,
      default: null,
    },
    // Throttle por fonte — ver IMapaSeed.
    instagramEnrichedAt: { type: Date, default: null },
    videoEnrichedAt:     { type: Date, default: null },
    // Seções editadas manualmente — protegidas do enriquecimento. Ver IMapaSeed.
    editedSections:      { type: [String], default: [] },
  },
  {
    timestamps: true,
    collection: "mapasseed",
  }
);

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Normaliza os rótulos de chip do mapa em TODA escrita via documento (.save() /
// .create()) — cobre os caminhos de IA: criação da seed, enriquecimento de
// Instagram e de vídeo, todos persistem por mapaDoc.save(). Quebra rótulos que a
// IA empacota com exemplos entre parênteses (ex: "Cenários externos (praia,
// metrô)") em vários chips curtos, garantindo que cada chip caiba em uma linha.
//
// Observação: o PATCH manual (/map-seed, $addToSet/$pull) NÃO passa por aqui — e
// é o comportamento desejado: o valor é digitado pelo criador (já curto) e o
// "remover" precisa casar exatamente com o que está gravado.
MapaSeedSchema.pre("save", function (next) {
  const mapa = this.mapa as IMapaData | undefined;
  if (mapa) {
    mapa.territorios = sanitizeChipArray(mapa.territorios);
    mapa.temas = sanitizeChipArray(mapa.temas);
    mapa.assets = sanitizeChipArray(mapa.assets);
    mapa.narrativas_adjacentes = sanitizeChipArray(mapa.narrativas_adjacentes);
  }
  next();
});

// ─── Model export ─────────────────────────────────────────────────────────────

const MapaSeed: Model<IMapaSeed> =
  (mongoose.models.MapaSeed as Model<IMapaSeed>) ||
  mongoose.model<IMapaSeed>("MapaSeed", MapaSeedSchema);

export default MapaSeed;
