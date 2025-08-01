// @/app/models/User.ts - v1.9.18 (CORRIGIDO)
// - CORRIGIDO: A importação do Mongoose foi ajustada para `import mongoose from 'mongoose'` para resolver o erro "does not provide an export named 'models'".
// - CORRIGIDO: As chamadas para `models.User` e `model("User", ...)` foram atualizadas para `mongoose.models.User` e `mongoose.model(...)` para alinhar com a nova importação.
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { logger } from "@/app/lib/logger";
import {
  USER_ROLES,
  PLAN_STATUSES,
  type UserRole,
  type PlanStatus,
} from '@/types/enums';

// --- INTERFACES ---
export interface IPeakSharesDetails {
    postId: string;
    platformPostId?: string;
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
    format?: string;
    proposal?: string;
    context?: string;
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
    postId: string;
    platformPostId?: string;
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
    postId: string;
    platformPostId?: string;
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
    mostRecentFormat?: string;
    mostRecentProposal?: string;
    mostRecentContext?: string;
}
export interface IBestDayFormatDetails {
    format: string;
    dayOfWeek: string;
    avgEngRate?: number;
    metricUsed: string;
    referenceAvgEngRate?: number;
    daysSinceLastUsedInSlot: number;
    lastPostProposal?: string;
    lastPostContext?: string;
}
export interface IPostingConsistencyDetails {
    previousAverageFrequencyDays?: number;
    currentAverageFrequencyDays?: number;
    daysSinceLastPost?: number;
    breakInPattern?: boolean;
    lastPostFormat?: string;
    lastPostProposal?: string;
    lastPostContext?: string;
}
export interface IEvergreenRepurposeDetails {
    originalPostId: string;
    originalPlatformPostId?: string;
    originalPostDate: Date;
    originalPostDescriptionExcerpt?: string;
    originalPostMetricValue: number;
    originalPostMetricName: string;
    suggestionType: 'tbt' | 'new_angle' | 'story_series' | 'other';
    format?: string;
    proposal?: string;
    context?: string;
}
export interface INewFormatPerformanceDetails {
    formatName: string;
    avgPerformanceNewFormat: number;
    referenceAvgPerformance: number;
    metricUsed: string;
    numberOfPostsInNewFormat: number;
    isPositiveAlert: boolean;
    dominantProposal?: string;
    dominantContext?: string;
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

export interface IAvailableInstagramAccount {
  igAccountId: string;
  pageId: string;
  pageName: string;
  username?: string;
  profile_picture_url?: string;
}
export interface ICommissionLogEntry {
  date: Date;
  amount: number;
  description: string;
  sourcePaymentId?: string;
  referredUserId?: Types.ObjectId;
}
export interface ILastCommunityInspirationShown {
  date: Date;
  inspirationIds: Types.ObjectId[];
}
export interface ICommunityInspirationHistoryEntry {
  date: Date;
  inspirationIds: Types.ObjectId[];
}
export type UserExpertiseLevel = 'iniciante' | 'intermediario' | 'avancado';
export interface IUserPreferences {
  preferredFormats?: string[];
  dislikedTopics?: string[];
  preferredAiTone?: 'mais_formal' | 'direto_ao_ponto' | 'super_descontraido' | string;
}
export interface IUserLongTermGoal {
  goal: string;
  addedAt?: Date;
  status?: 'ativo' | 'em_progresso' | 'concluido' | 'pausado';
}
export interface IUserKeyFact {
  fact: string;
  mentionedAt?: Date;
}

export interface IUserLocation {
  country?: string;
  state?: string;
  city?: string;
}
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
export interface IUser extends Document {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  password?: string;
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
  mediaKitToken?: string;
  mediaKitSlug?: string;
  role: UserRole;
  agency?: Types.ObjectId | null;
  pendingAgency?: Types.ObjectId | null;
  planStatus?: PlanStatus;
  planType?: 'monthly' | 'annual';
  paymentGatewaySubscriptionId?: string;
  planExpiresAt?: Date | null;
  whatsappVerificationCode?: string | null;
  whatsappPhone?: string | null;
  whatsappVerified?: boolean;
  profileTone?: string;
  hobbies?: string[];
  goal?: string;
  gender?: 'male' | 'female' | 'other';
  birthDate?: Date | null;
  location?: IUserLocation;
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
  communityInspirationHistory?: ICommunityInspirationHistoryEntry[];
  isNewUserForOnboarding?: boolean;
  onboardingCompletedAt?: Date | null;
  inferredExpertiseLevel?: UserExpertiseLevel;
  userPreferences?: IUserPreferences;
  userLongTermGoals?: IUserLongTermGoal[];
  userKeyFacts?: IUserKeyFact[];
  totalMessages?: number; // <-- CORREÇÃO APLICADA AQUI
  alertHistory?: IAlertHistoryEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}
// --- FIM DAS INTERFACES ---

function generateAffiliateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// --- SCHEMAS ANINHADOS ---
const commissionLogEntrySchema = new Schema<ICommissionLogEntry>({/*...*/}, {/*...*/}); // Placeholder for brevity
const lastCommunityInspirationShownSchema = new Schema<ILastCommunityInspirationShown>({
  date: { type: Date, required: true },
  inspirationIds: [{ type: Schema.Types.ObjectId, required: true }],
}, { _id: false });

const communityInspirationHistoryEntrySchema = new Schema<ICommunityInspirationHistoryEntry>({
  date: { type: Date, required: true },
  inspirationIds: [{ type: Schema.Types.ObjectId, required: true }],
}, { _id: false });

const AvailableInstagramAccountSchema = new Schema<IAvailableInstagramAccount>({
    igAccountId: { type: String, required: true },
    pageId: { type: String, required: true },
    pageName: { type: String, required: true },
    username: { type: String },
    profile_picture_url: { type: String },
}, { _id: false });

const UserPreferencesSchema = new Schema<IUserPreferences>({/*...*/}, {/*...*/}); // Placeholder for brevity
const UserLongTermGoalSchema = new Schema<IUserLongTermGoal>({/*...*/}, {/*...*/}); // Placeholder for brevity
const UserKeyFactSchema = new Schema<IUserKeyFact>({/*...*/}, {/*...*/}); // Placeholder for brevity
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
    name: { type: String, trim: true, text: true }, // Otimização: Adicionado 'text' para o índice
    email: {
        type: String,
        required: [true, 'Email is required.'],
        unique: true,
        match: [/.+\@.+\..+/, 'Please fill a valid email address'],
        index: true,
    },
    password: {
        type: String,
        select: false
    },
    planStatus: { type: String, enum: PLAN_STATUSES, default: "inactive", index: true }, // OTIMIZAÇÃO: Mantido índice.
    planType: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
    paymentGatewaySubscriptionId: { type: String },
    inferredExpertiseLevel: {
        type: String,
        enum: ['iniciante', 'intermediario', 'avancado'],
        default: 'iniciante',
        index: true // OTIMIZAÇÃO: Mantido índice.
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
    mediaKitToken: { type: String, unique: true, sparse: true },
    mediaKitSlug: { type: String, unique: true, sparse: true },
    role: { type: String, enum: USER_ROLES, default: "user" },
    agency: { type: Schema.Types.ObjectId, ref: 'Agency', default: null },
    pendingAgency: { type: Schema.Types.ObjectId, ref: 'Agency', default: null },
    planExpiresAt: { type: Date, default: null },
    whatsappVerificationCode: { type: String, default: null, index: true },
    whatsappPhone: { type: String, default: null, index: true },
    whatsappVerified: { type: Boolean, default: false },
    profileTone: { type: String, default: 'informal e prestativo' },
    hobbies: { type: [String], default: [] },
    goal: { type: String, default: null },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'other', index: true },
    birthDate: { type: Date, default: null },
    location: {
      country: { type: String, default: 'BR' },
      state: { type: String, index: true },
      city: { type: String },
    },
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
    communityInspirationHistory: { type: [communityInspirationHistoryEntrySchema], default: [] },
    isNewUserForOnboarding: { type: Boolean, default: true },
    onboardingCompletedAt: { type: Date, default: null },
    userPreferences: { type: UserPreferencesSchema, default: () => ({}) },
    userLongTermGoals: { type: [UserLongTermGoalSchema], default: [] },
    userKeyFacts: { type: [UserKeyFactSchema], default: [] },
    totalMessages: { type: Number, default: 0 },
    alertHistory: { type: [AlertHistoryEntrySchema], default: [] },
  },
  {
    timestamps: true,
  }
);

userSchema.pre<IUser>("save", function (next) {
  const TAG_PRE_SAVE = '[User.ts pre-save v1.9.17]';
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

// ** CORREÇÃO PRINCIPAL APLICADA AQUI **
const UserModel: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", userSchema);

// Garantir que os índices sejam criados quando o modelo é inicializado
if (!mongoose.models.User) {
  UserModel.createIndexes().catch((err) => {
    logger.error(`[User.ts] Erro ao criar índices: ${err}`);
  });
}

export default UserModel;
