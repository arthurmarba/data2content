import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface para os dados demográficos (usada tanto para seguidores quanto para engajados).
 * A estrutura é um array de objetos contendo o valor (ex: cidade, país, faixa etária/gênero) e a contagem.
 */
interface IDemographicBreakdown {
  value: string; // Ex: 'Rio de Janeiro, State of Rio de Janeiro', 'BR', 'F.25-34'
  count: number;
}

/**
 * Interface para o subdocumento 'audienceDemographics'.
 * ATUALIZADO v1.2: Separa 'follower_demographics' de 'engaged_audience_demographics'.
 */
interface IAudienceDemographics {
  // Demografia dos SEGUIDORES
  follower_demographics?: {
    city?: IDemographicBreakdown[];
    country?: IDemographicBreakdown[];
    age?: IDemographicBreakdown[]; // <<< NOVO breakdown 'age' >>>
    gender?: IDemographicBreakdown[]; // <<< NOVO breakdown 'gender' >>>
    // gender_age?: IDemographicBreakdown[]; // Removido em favor de age/gender separados
  };
  // Demografia do PÚBLICO ENGAJADO
  engaged_audience_demographics?: { // <<< NOVO >>>
    city?: IDemographicBreakdown[];
    country?: IDemographicBreakdown[];
    age?: IDemographicBreakdown[];
    gender?: IDemographicBreakdown[];
  };
}

/**
 * Interface para o subdocumento 'accountInsightsPeriod'.
 * ATUALIZADO v1.2: Reflete as métricas de nível de conta da API v19.0+.
 */
interface IAccountInsightsPeriod {
  period: string; // Período dos insights (ex: 'day', 'week', 'days_28', 'last_30_days') - Obrigatório

  // --- Métricas Principais (API v19.0+) ---
  views?: number;                     // <<< NOVO (substitui impressions/profileViews) >>> Visualizações totais da conta/perfil
  reach?: number;                     // Alcance da conta (mantido)
  accounts_engaged?: number;          // <<< NOVO >>> Contas engajadas
  total_interactions?: number;        // <<< NOVO >>> Interações totais na conta (likes, comments, etc.)
  comments?: number;                  // <<< NOVO >>> Comentários recebidos na conta
  likes?: number;                     // <<< NOVO >>> Likes recebidos na conta
  saved?: number;                     // <<< NOVO >>> Posts salvos da conta
  shares?: number;                    // <<< NOVO >>> Compartilhamentos de posts da conta
  replies?: number;                   // <<< NOVO >>> Respostas recebidas (ex: a stories)

  // --- Métricas com Breakdown (API v19.0+) ---
  profile_links_taps?: { [contact_button_type: string]: number }; // <<< NOVO >>> Toques em links/botões (ex: email_contacts, phone_call_clicks) - chave é 'contact_button_type'
  follows_and_unfollows?: { [follow_type: string]: number };      // <<< NOVO >>> Seguidores ganhos/perdidos (ex: follower_gains, unfollows) - chave é 'follow_type'

  // --- Métricas Removidas (v1.2) ---
  // impressions?: number; // Substituído por 'views'
  // profileViews?: number; // Substituído por 'views'
  // websiteClicks?: number; // Agora parte de 'profile_links_taps' com breakdown

  // Permite outros campos caso a API adicione novas métricas no futuro
  [key: string]: unknown;
}


/**
 * Interface que define a estrutura de um documento AccountInsight.
 * ATUALIZADO v1.2: Reflete as novas estruturas em 'accountInsightsPeriod' e 'audienceDemographics'.
 */
export interface IAccountInsight extends Document {
  user: Types.ObjectId;                   // Referência ao usuário
  instagramAccountId: string;             // ID da conta do Instagram
  fetchDate: Date;                        // Data da coleta dos dados
  // Métricas básicas da conta (mantidas)
  followersCount?: number;
  followsCount?: number;
  mediaCount?: number;
  // Subdocumentos atualizados
  accountInsightsPeriod?: IAccountInsightsPeriod; // <<< USA NOVA INTERFACE >>>
  audienceDemographics?: IAudienceDemographics;   // <<< USA NOVA INTERFACE >>>
  createdAt: Date;
}

/**
 * Schema para o modelo AccountInsight.
 * ATUALIZADO v1.2: Reflete as novas estruturas.
 */
const accountInsightSchema = new Schema<IAccountInsight>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, 'A referência ao usuário é obrigatória.'],
      index: true,
    },
    instagramAccountId: {
      type: String,
      required: [true, 'O ID da conta do Instagram é obrigatório.'],
      index: true,
    },
    fetchDate: {
      type: Date,
      required: [true, 'A data da coleta (fetchDate) é obrigatória.'],
      index: true,
    },
    // Métricas básicas (mantidas)
    followersCount: { type: Number },
    followsCount: { type: Number },
    mediaCount: { type: Number },

    // Subdocumento para insights de período (atualizado)
    accountInsightsPeriod: {
      type: Schema.Types.Mixed, // Mixed para flexibilidade
      default: null,
      // Definições explícitas para clareza (baseado em IAccountInsightsPeriod)
      period: { type: String }, // Obrigatório na interface, mas opcional no schema Mixed
      views: { type: Number },
      reach: { type: Number },
      accounts_engaged: { type: Number },
      total_interactions: { type: Number },
      comments: { type: Number },
      likes: { type: Number },
      saved: { type: Number },
      shares: { type: Number },
      replies: { type: Number },
      profile_links_taps: { type: Schema.Types.Mixed }, // Objeto chave/valor
      follows_and_unfollows: { type: Schema.Types.Mixed }, // Objeto chave/valor
      _id: false
    },

    // Subdocumento para dados demográficos (atualizado)
    audienceDemographics: {
      type: { // Schema aninhado explícito
        follower_demographics: {
          type: {
            city: [{ value: String, count: Number, _id: false }],
            country: [{ value: String, count: Number, _id: false }],
            age: [{ value: String, count: Number, _id: false }], // <<< NOVO >>>
            gender: [{ value: String, count: Number, _id: false }], // <<< NOVO >>>
            // gender_age: [{ value: String, count: Number, _id: false }], // Removido
          },
          default: null,
          _id: false
        },
        engaged_audience_demographics: { // <<< NOVO >>>
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
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
);

/**
 * Índices (Mantidos da versão anterior)
 */
accountInsightSchema.index({ user: 1, instagramAccountId: 1, fetchDate: -1 });
accountInsightSchema.index({ instagramAccountId: 1, fetchDate: -1 });


const AccountInsightModel = models.AccountInsight
  ? (models.AccountInsight as Model<IAccountInsight>)
  : model<IAccountInsight>("AccountInsight", accountInsightSchema);

export default AccountInsightModel;
// Exporta as interfaces para referência externa
export type { IAccountInsightsPeriod, IAudienceDemographics, IDemographicBreakdown };
