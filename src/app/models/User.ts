// @/app/models/User.ts - v1.9.16 (Adiciona platformPostId aos detalhes de alertas relevantes)
// - ADICIONADO: Campo platformPostId? ou similar às interfaces de detalhes de alerta que se referem a um post específico.
// - Mantém funcionalidades da v1.9.15.

import { Schema, model, models, Document, Model, Types } from "mongoose";
import { logger } from "@/app/lib/logger";

// --- INTERFACES DE DETALHES PARA CADA TIPO DE ALERTA DO RADAR TUCA ---

export interface IPeakSharesDetails {
    postId: string; // ID interno da métrica/post
    platformPostId?: string; // NOVO: ID do post na plataforma (ex: Instagram)
    postDescriptionExcerpt?: string;
    peakShares: number;
    peakDay: number;
    averageSharesFirst3Days: number;
    format?: string;
    proposal?: string;
    context?: string;
}

export interface IDropWatchTimeDetails {
    currentAvg: number;
    historicalAvg: number;
    reelsAnalyzedIds: string[];
}

export interface IForgottenFormatDetails {
    format: string;
    avgMetricValue: number;
    overallAvgPerformance: number;
    metricUsed: string;
    daysSinceLastUsed: number;
    percentageSuperior: number;
}

export interface IUntappedPotentialTopicDetails {
    postId: string; // ID interno da métrica/post
    platformPostId?: string; // NOVO: ID do post na plataforma
    postDescriptionExcerpt?: string;
    performanceMetric: string;
    performanceValue: number;
    referenceAverage: number;
    daysSincePosted: number;
    postType?: string;
    format?: string;
    proposal?: string;
    context?: string;
}

export interface IEngagementPeakNotCapitalizedDetails {
    postId: string; // ID interno da métrica/post
    platformPostId?: string; // NOVO: ID do post na plataforma
    postDescriptionExcerpt?: string;
    comments: number;
    averageComments: number;
    postType?: string;
    format?: string;
    proposal?: string;
    context?: string;
}

export interface INoEventDetails {
    reason: string;
}

export interface IFollowerStagnationDetails {
    currentGrowthRate: number;
    previousGrowthRate: number;
    currentGrowthAbs: number;
    previousGrowthAbs: number;
    periodAnalyzed: string;
}

export interface IBestDayFormatDetails {
    format: string;
    dayOfWeek: string;
    avgEngRate?: number;
    metricUsed: string;
    referenceAvgEngRate?: number;
    daysSinceLastUsedInSlot: number;
}

export interface IPostingConsistencyDetails {
    previousAverageFrequencyDays?: number;
    currentAverageFrequencyDays?: number;
    daysSinceLastPost?: number;
    breakInPattern?: boolean;
}

export interface IEvergreenRepurposeDetails {
    originalPostId: string; // ID interno da métrica/post original
    originalPlatformPostId?: string; // NOVO: ID do post original na plataforma
    originalPostDate: Date;
    originalPostDescriptionExcerpt?: string;
    originalPostMetricValue: number;
    originalPostMetricName: string;
    suggestionType: 'tbt' | 'new_angle' | 'story_series' | 'other';
}

export interface INewFormatPerformanceDetails {
    formatName: string;
    avgPerformanceNewFormat: number;
    referenceAvgPerformance: number;
    metricUsed: string;
    numberOfPostsInNewFormat: number;
    isPositiveAlert: boolean;
}

export interface IMediaTypePerformance {
    type: string;
    avgMetricValue: number;
    postCount: number;
    metricUsed: string;
}
export interface IMediaTypeComparisonDetails {
    performanceByMediaType: IMediaTypePerformance[];
    bestPerformingType?: { type: string; avgMetricValue: number; };
    worstPerformingType?: { type: string; avgMetricValue: number; };
    overallAverage?: number;
    metricUsed: string;
}

// Union Type para todos os detalhes de alerta (não precisa de alteração aqui,
// pois as interfaces individuais foram atualizadas)
export type AlertDetails =
    | IPeakSharesDetails
    | IDropWatchTimeDetails
    | IForgottenFormatDetails
    | IUntappedPotentialTopicDetails
    | IEngagementPeakNotCapitalizedDetails
    | INoEventDetails
    | IFollowerStagnationDetails
    | IBestDayFormatDetails
    | IPostingConsistencyDetails
    | IEvergreenRepurposeDetails
    | INewFormatPerformanceDetails
    | IMediaTypeComparisonDetails
    | { [key: string]: any };


/**
 * Interface para uma conta do Instagram disponível.
 */
export interface IAvailableInstagramAccount {
  igAccountId: string;
  pageId: string;
  pageName: string;
  username?: string;
  profile_picture_url?: string;
}

/**
 * Interface para uma entrada no log de comissões.
 */
export interface ICommissionLogEntry {
  date: Date;
  amount: number;
  description: string;
  sourcePaymentId?: string;
  referredUserId?: Types.ObjectId;
}

/**
 * Interface para rastrear a última inspiração diária mostrada.
 */
export interface ILastCommunityInspirationShown {
  date: Date;
  inspirationIds: Types.ObjectId[];
}

/**
 * Define os possíveis níveis de expertise do usuário.
 */
export type UserExpertiseLevel = 'iniciante' | 'intermediario' | 'avancado';

/**
 * Interface para as preferências do usuário.
 */
export interface IUserPreferences {
  preferredFormats?: string[]; // Poderia usar FormatType[]
  dislikedTopics?: string[];
  preferredAiTone?: 'mais_formal' | 'direto_ao_ponto' | 'super_descontraido' | string;
}

/**
 * Interface para um objetivo de longo prazo do usuário.
 */
export interface IUserLongTermGoal {
  goal: string;
  addedAt?: Date;
  status?: 'ativo' | 'em_progresso' | 'concluido' | 'pausado';
}

/**
 * Interface para um fato chave sobre o usuário/negócio.
 */
export interface IUserKeyFact {
  fact: string;
  mentionedAt?: Date;
}

/**
 * Interface para uma entrada no histórico de alertas do Radar Tuca.
 * ATUALIZADO v1.9.16: `AlertDetails` agora reflete as mudanças internas.
 */
export interface IAlertHistoryEntry {
  _id?: Types.ObjectId;
  type: string;
  date: Date;
  messageForAI: string;
  finalUserMessage: string;
  details: AlertDetails;
  userInteraction?: {
    type: 'explored_further' | 'dismissed' | 'not_interacted' | 'error_sending' | 'pending_interaction' | 'not_applicable' | 'viewed' | 'clicked_suggestion' | 'provided_feedback';
    feedback?: string;
    interactedAt?: Date;
  };
}

/**
 * Interface que descreve um documento de usuário.
 * ATUALIZADO v1.9.16
 */
export interface IUser extends Document {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  image?: string;
  googleId?: string;
  provider?: string;
  providerAccountId?: string;
  facebookProviderAccountId?: string;
  instagramAccessToken?: string;
  instagramAccountId?: string | null;
  isInstagramConnected?: boolean;
  lastInstagramSyncAttempt?: Date | null;
  lastInstagramSyncSuccess?: boolean | null;
  instagramSyncErrorMsg?: string | null;
  username?: string | null;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  is_published?: boolean;
  shopping_product_tag_eligibility?: boolean;
  availableIgAccounts?: IAvailableInstagramAccount[] | null;
  linkToken?: string;
  linkTokenExpiresAt?: Date;
  role: string;
  planStatus?: string;
  planExpiresAt?: Date | null;
  whatsappVerificationCode?: string | null;
  whatsappPhone?: string | null;
  whatsappVerified?: boolean;
  profileTone?: string;
  hobbies?: string[];
  goal?: string;
  affiliateRank?: number;
  affiliateInvites?: number;
  affiliateCode?: string;
  affiliateUsed?: string;
  affiliateBalance?: number;
  commissionLog?: ICommissionLogEntry[];
  paymentInfo?: {
    pixKey?: string;
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
  };
  lastProcessedPaymentId?: string;
  communityInspirationOptIn?: boolean;
  communityInspirationOptInDate?: Date | null;
  communityInspirationTermsVersion?: string | null;
  lastCommunityInspirationShown_Daily?: ILastCommunityInspirationShown | null;
  isNewUserForOnboarding?: boolean;
  onboardingCompletedAt?: Date | null;
  inferredExpertiseLevel?: UserExpertiseLevel;
  userPreferences?: IUserPreferences;
  userLongTermGoals?: IUserLongTermGoal[];
  userKeyFacts?: IUserKeyFact[];
  alertHistory?: IAlertHistoryEntry[]; // Usa a IAlertHistoryEntry atualizada
  createdAt?: Date;
  updatedAt?: Date;
}

function generateAffiliateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const commissionLogEntrySchema = new Schema<ICommissionLogEntry>({
  date: { type: Date, required: true, default: Date.now },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  sourcePaymentId: { type: String },
  referredUserId: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const lastCommunityInspirationShownSchema = new Schema<ILastCommunityInspirationShown>({
  date: { type: Date, required: true },
  inspirationIds: [{ type: Schema.Types.ObjectId, ref: 'CommunityInspiration' }]
}, { _id: false });

const AvailableInstagramAccountSchema = new Schema<IAvailableInstagramAccount>({
  igAccountId: { type: String, required: true },
  pageId: { type: String, required: true },
  pageName: { type: String, required: true },
  username: { type: String },
  profile_picture_url: { type: String },
}, { _id: false });

const UserPreferencesSchema = new Schema<IUserPreferences>({
  preferredFormats: { type: [String], default: [] }, // Considerar usar [FormatType] se alinhado com os enums
  dislikedTopics: { type: [String], default: [] },
  preferredAiTone: { type: String, default: null },
}, { _id: false });

const UserLongTermGoalSchema = new Schema<IUserLongTermGoal>({
  goal: { type: String, required: true },
  addedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['ativo', 'em_progresso', 'concluido', 'pausado'], default: 'ativo' },
}, { _id: false });

const UserKeyFactSchema = new Schema<IUserKeyFact>({
  fact: { type: String, required: true },
  mentionedAt: { type: Date, default: Date.now },
}, { _id: false });

// O schema AlertHistoryEntrySchema não precisa mudar, pois 'details' é Schema.Types.Mixed.
// A tipagem via interface AlertDetails já garante a segurança no código TypeScript.
const AlertHistoryEntrySchema = new Schema<IAlertHistoryEntry>({
  type: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
  messageForAI: { type: String, default: "" },
  finalUserMessage: { type: String, default: "" },
  details: { type: Schema.Types.Mixed, required: true },
  userInteraction: {
    type: {
        type: String,
        enum: ['explored_further', 'dismissed', 'not_interacted', 'error_sending', 'pending_interaction', 'not_applicable', 'viewed', 'clicked_suggestion', 'provided_feedback'],
        default: 'pending_interaction'
    },
    feedback: { type: String },
    interactedAt: { type: Date }
  },
}, { _id: true });

const userSchema = new Schema<IUser>(
  {
    name: { type: String },
    email: {
        type: String,
        required: [true, 'Email is required.'],
        unique: true,
        match: [/.+\@.+\..+/, 'Please fill a valid email address'],
        index: true,
    },
    image: { type: String },
    googleId: { type: String },
    provider: { type: String, index: true },
    providerAccountId: { type: String, index: true },
    facebookProviderAccountId: { type: String, index: true, sparse: true },
    instagramAccessToken: { type: String },
    instagramAccountId: { type: String, index: true, default: null },
    isInstagramConnected: { type: Boolean, default: false },
    lastInstagramSyncAttempt: { type: Date, default: null },
    lastInstagramSyncSuccess: { type: Boolean, default: null },
    instagramSyncErrorMsg: { type: String, default: null },
    username: { type: String, sparse: true, default: null },
    biography: { type: String },
    website: { type: String },
    profile_picture_url: { type: String },
    followers_count: { type: Number },
    follows_count: { type: Number },
    media_count: { type: Number },
    is_published: { type: Boolean },
    shopping_product_tag_eligibility: { type: Boolean },
    availableIgAccounts: { type: [AvailableInstagramAccountSchema], default: null },
    linkToken: { type: String, index: true, sparse: true },
    linkTokenExpiresAt: { type: Date },
    role: { type: String, default: "user" },
    planStatus: { type: String, default: "inactive" },
    planExpiresAt: { type: Date, default: null },
    whatsappVerificationCode: { type: String, default: null, index: true },
    whatsappPhone: { type: String, default: null, index: true },
    whatsappVerified: { type: Boolean, default: false },
    profileTone: { type: String, default: 'informal e prestativo' },
    hobbies: { type: [String], default: [] },
    goal: { type: String, default: null },
    affiliateRank: { type: Number, default: 1 },
    affiliateInvites: { type: Number, default: 0 },
    affiliateCode: { type: String, unique: true, sparse: true },
    affiliateUsed: { type: String, default: null },
    affiliateBalance: { type: Number, default: 0 },
    commissionLog: { type: [commissionLogEntrySchema], default: [] },
    paymentInfo: {
      pixKey: { type: String, default: "" },
      bankName: { type: String, default: "" },
      bankAgency: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
    },
    lastProcessedPaymentId: { type: String, default: null, index: true },
    communityInspirationOptIn: { type: Boolean, default: false },
    communityInspirationOptInDate: { type: Date, default: null },
    communityInspirationTermsVersion: { type: String, default: null },
    lastCommunityInspirationShown_Daily: { type: lastCommunityInspirationShownSchema, default: null },
    isNewUserForOnboarding: { type: Boolean, default: true },
    onboardingCompletedAt: { type: Date, default: null },
    inferredExpertiseLevel: {
        type: String,
        enum: ['iniciante', 'intermediario', 'avancado'],
        default: 'iniciante'
    },
    userPreferences: { type: UserPreferencesSchema, default: () => ({}) },
    userLongTermGoals: { type: [UserLongTermGoalSchema], default: [] },
    userKeyFacts: { type: [UserKeyFactSchema], default: [] },
    alertHistory: { type: [AlertHistoryEntrySchema], default: [] },
  },
  {
    timestamps: true,
  }
);

userSchema.pre<IUser>("save", function (next) {
  const TAG_PRE_SAVE = '[User.ts pre-save v1.9.16]';
  
  if (this.isNew && !this.affiliateCode) {
    const newCode = generateAffiliateCode();
    logger.info(`${TAG_PRE_SAVE} Gerando novo affiliateCode: '${newCode}' para User Email: ${this.email}`);
    this.affiliateCode = newCode;
  } 

  if (this.onboardingCompletedAt && this.isNewUserForOnboarding) {
    this.isNewUserForOnboarding = false;
  }
  next();
});

const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;
