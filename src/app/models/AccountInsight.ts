// src/app/models/AccountInsight.ts (v1.4 - Otimização de Índices)
// - CONSOLIDAÇÃO: Os índices foram revisados e consolidados para otimizar as consultas principais do dashboard.
// - LIMPEZA: Removido índice do campo `fetchDate` que está sendo depreciado em favor de `recordedAt`.
import { Schema, model, models, Document, Model, Types } from "mongoose";

// --- INTERFACES (sem alterações) ---
interface IDemographicBreakdown {
  value: string;
  count: number;
}
interface IAudienceDemographics {
  follower_demographics?: {
    city?: IDemographicBreakdown[];
    country?: IDemographicBreakdown[];
    age?: IDemographicBreakdown[];
    gender?: IDemographicBreakdown[];
  };
  engaged_audience_demographics?: {
    city?: IDemographicBreakdown[];
    country?: IDemographicBreakdown[];
    age?: IDemographicBreakdown[];
    gender?: IDemographicBreakdown[];
  };
}
interface IAccountInsightsPeriod {
  period: string;
  views?: number;
  reach?: number;
  accounts_engaged?: number;
  total_interactions?: number;
  comments?: number;
  likes?: number;
  saved?: number;
  shares?: number;
  replies?: number;
  profile_links_taps?: { [contact_button_type: string]: number };
  follows_and_unfollows?: { [follow_type: string]: number };
  [key: string]: unknown;
}
export interface IAccountInsight extends Document {
  user: Types.ObjectId;
  instagramAccountId: string;
  fetchDate?: Date;
  recordedAt: Date;
  followersCount?: number;
  followsCount?: number;
  mediaCount?: number;
  accountInsightsPeriod?: IAccountInsightsPeriod;
  audienceDemographics?: IAudienceDemographics;
  accountDetails?: {
      username?: string;
      name?: string;
      biography?: string;
      website?: string;
      profile_picture_url?: string;
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
  };
  createdAt?: Date;
}
// --- FIM DAS INTERFACES ---

const accountInsightSchema = new Schema<IAccountInsight>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, 'A referência ao usuário é obrigatória.'],
    },
    instagramAccountId: {
      type: String,
      required: [true, 'O ID da conta do Instagram é obrigatório.'],
    },
    fetchDate: { // Mantido por compatibilidade, mas não é mais o campo principal para consultas de data.
      type: Date,
    },
    recordedAt: {
      type: Date,
      required: [true, 'A data de registro (recordedAt) é obrigatória.'],
      default: Date.now,
    },
    followersCount: { type: Number },
    // ... (restante da definição do schema sem alterações) ...
    followsCount: { type: Number },
    mediaCount: { type: Number },
    accountInsightsPeriod: {
      type: Schema.Types.Mixed,
      default: null,
      period: { type: String },
      views: { type: Number },
      reach: { type: Number },
      accounts_engaged: { type: Number },
      total_interactions: { type: Number },
      comments: { type: Number },
      likes: { type: Number },
      saved: { type: Number },
      shares: { type: Number },
      replies: { type: Number },
      profile_links_taps: { type: Schema.Types.Mixed },
      follows_and_unfollows: { type: Schema.Types.Mixed },
      _id: false
    },
    audienceDemographics: {
      type: {
        follower_demographics: {
          type: {
            city: [{ value: String, count: Number, _id: false }],
            country: [{ value: String, count: Number, _id: false }],
            age: [{ value: String, count: Number, _id: false }],
            gender: [{ value: String, count: Number, _id: false }],
          },
          default: null,
          _id: false
        },
        engaged_audience_demographics: {
          type: {
            city: [{ value: String, count: Number, _id: false }],
            country: [{ value: String, count: Number, _id: false }],
            age: [{ value: String, count: Number, _id: false }],
            gender: [{ value: String, count: Number, _id: false }],
          },
          default: null,
          _id: false
        }
      },
      default: null,
      _id: false
    },
     accountDetails: {
         type: {
             username: { type: String },
             name: { type: String },
             biography: { type: String },
             website: { type: String },
             profile_picture_url: { type: String },
             followers_count: { type: Number },
             follows_count: { type: Number },
             media_count: { type: Number },
         },
         default: null,
         _id: false,
     },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
);


/**
 * OTTIMIZAÇÃO: Índices revisados e consolidados.
 * O índice principal { user: 1, recordedAt: -1 } é o mais importante para as consultas do dashboard,
 * como o gráfico de tendência de seguidores, que filtra por usuário e ordena por data.
 */
accountInsightSchema.index({ user: 1, recordedAt: -1 });
accountInsightSchema.index({ instagramAccountId: 1, recordedAt: -1 }); // Útil para buscas em toda a plataforma.


const AccountInsightModel = models.AccountInsight
  ? (models.AccountInsight as Model<IAccountInsight>)
  : model<IAccountInsight>("AccountInsight", accountInsightSchema);

export default AccountInsightModel;
export type { IAccountInsightsPeriod, IAudienceDemographics, IDemographicBreakdown };
