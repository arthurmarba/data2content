// @/app/models/User.ts - v1.9.24
// - Adiciona campo whatsappVerificationCodeExpiresAt para expiração de código de verificação do WhatsApp
// - Índice composto em (whatsappVerificationCode, whatsappVerificationCodeExpiresAt)
// - Sanitiza campos de verificação quando whatsappVerified=true

import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { logger } from "@/app/lib/logger";
import {
  USER_ROLES,
  PLAN_STATUSES, // mantém import; o schema abaixo define a validação efetiva
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

export interface ICommissionEntry {
  _id: Types.ObjectId;
  type: 'commission' | 'adjustment' | 'redeem';
  status: 'pending' | 'available' | 'paid' | 'canceled' | 'reversed';
  invoiceId?: string;
  subscriptionId?: string;
  affiliateUserId: Types.ObjectId;
  buyerUserId?: Types.ObjectId;
  currency: string;
  amountCents: number;
  availableAt?: Date;
  transactionId?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
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
  instagramSyncErrorCode?: string | null;
  instagramReconnectNotifiedAt?: Date | null;
  instagramAccessTokenExpiresAt?: Date | null;
  instagramDisconnectCount?: number;
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
  planType?: 'monthly' | 'annual' | 'annual_one_time';
  paymentGatewaySubscriptionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  planInterval?: 'month' | 'year';
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  currency?: string;
  lastProcessedEventId?: string;
  planExpiresAt?: Date | null;
  autoRenewConsentAt?: Date | null;

  whatsappVerificationCode?: string | null;
  whatsappVerificationCodeExpiresAt?: Date | null; // <<< NOVO
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
  affiliateUsed: string | null;
  affiliateBalances?: Map<string, number>;
  affiliateDebtByCurrency?: Map<string, number>;
  affiliateBalance?: number;
  affiliateBalanceCents?: number;
  commissionLog?: ICommissionEntry[];
  paymentInfo?: {
    pixKey?: string;
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
    stripeAccountId?: string | null;
    stripeAccountStatus?: 'pending' | 'verified' | 'disabled';
    stripeAccountDefaultCurrency?: string;
    stripeAccountPayoutsEnabled?: boolean;
    stripeAccountChargesEnabled?: boolean;
    stripeAccountDisabledReason?: string | null;
    stripeAccountCapabilities?: {
      card_payments?: 'active' | 'pending' | 'inactive';
      transfers?: 'active' | 'pending' | 'inactive';
    };
    stripeAccountNeedsOnboarding?: boolean;
    stripeAccountCountry?: string | null;
  };
  affiliatePayoutMode?: 'connect' | 'manual';
  commissionPaidInvoiceIds?: string[];
  hasAffiliateCommissionPaid?: boolean;
  lastPaymentError?: {
    at: Date;
    paymentId: string;
    status: string;
    statusDetail: string;
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
  totalMessages?: number;
  alertHistory?: IAlertHistoryEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}
// --- FIM DAS INTERFACES ---

function generateAffiliateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// --- SCHEMAS ANINHADOS ---
const commissionLogEntrySchema = new Schema<ICommissionEntry>(
  {
    type: {
      type: String,
      enum: ['commission', 'adjustment', 'redeem'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'available', 'paid', 'canceled', 'reversed'],
      required: true,
    },
    invoiceId: { type: String },
    subscriptionId: { type: String },
    affiliateUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    buyerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    currency: { type: String, lowercase: true, required: true },
    amountCents: { type: Number, required: true },
    availableAt: { type: Date },
    transactionId: { type: String },
    note: { type: String },
  },
  { timestamps: true }
);

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

const UserPreferencesSchema = new Schema<IUserPreferences>({/*...*/}, {/*...*/});
const UserLongTermGoalSchema = new Schema<IUserLongTermGoal>({/*...*/}, {/*...*/});
const UserKeyFactSchema = new Schema<IUserKeyFact>({/*...*/}, {/*...*/});

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

// --- SCHEMA PRINCIPAL DO USUÁRIO ---
const userSchema = new Schema<IUser>(
  {
    name: { type: String, trim: true, text: true },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      match: [/.+\@.+\..+/, 'Please fill a valid email address'],
      index: true,
    },
    password: { type: String, select: false },

    planStatus: {
      type: String,
      enum: [
        'pending',
        'active',
        'inactive',
        'canceled',
        'trial',
        'trialing',
        'expired',
        'past_due',
        'incomplete',
        'incomplete_expired',
        'unpaid',
        'non_renewing',
      ],
      default: "inactive",
      index: true
    },

    planType: { type: String, enum: ['monthly', 'annual', 'annual_one_time'], default: 'monthly' },
    paymentGatewaySubscriptionId: { type: String },
    stripeCustomerId: { type: String, index: true },
    stripeSubscriptionId: { type: String, default: null },
    stripePriceId: { type: String, default: null },

    planInterval: {
      type: String,
      enum: ['month', 'year', null],
      default: undefined
    },

    cancelAtPeriodEnd: { type: Boolean, default: false },
    currentPeriodEnd: { type: Date, default: null },
    currency: { type: String, default: 'BRL' },
    lastProcessedEventId: { type: String },
    
    inferredExpertiseLevel: {
      type: String,
      enum: ['iniciante', 'intermediario', 'avancado'],
      default: 'iniciante',
      index: true
    },
    
    image: { type: String },
    googleId: { type: String },
    provider: { type: String, index: true },
    providerAccountId: { type: String, index: true },
    facebookProviderAccountId: { type: String, index: true, sparse: true },
    instagramAccessToken: { type: String },
    instagramAccessTokenExpiresAt: { type: Date, default: null },
    instagramAccountId: { type: String, index: true, default: null },
    isInstagramConnected: { type: Boolean, default: false },
    lastInstagramSyncAttempt: { type: Date, default: null },
    lastInstagramSyncSuccess: { type: Boolean, default: null },
    instagramSyncErrorMsg: { type: String, default: null },
    instagramSyncErrorCode: { type: String, default: null },
    instagramReconnectNotifiedAt: { type: Date, default: null },
    instagramDisconnectCount: { type: Number, default: 0 },
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
    autoRenewConsentAt: { type: Date, default: null },

    whatsappVerificationCode: { type: String, default: null, index: true },
    whatsappVerificationCodeExpiresAt: { type: Date, default: null }, // <<< NOVO
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
    affiliateBalances: { type: Map, of: Number, default: {} },
    affiliateDebtByCurrency: { type: Map, of: Number, default: {} },
    affiliateBalanceCents: { type: Number, default: 0 },
    affiliateBalance: { type: Number },
    commissionLog: { type: [commissionLogEntrySchema], default: [] },
    affiliatePayoutMode: { type: String, enum: ['connect', 'manual'], default: 'manual' },
    commissionPaidInvoiceIds: { type: [String], default: [] },
    hasAffiliateCommissionPaid: { type: Boolean, default: false },
    paymentInfo: {
      pixKey: { type: String, default: "" },
      bankName: { type: String, default: "" },
      bankAgency: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
      stripeAccountId: { type: String, default: null },
      stripeAccountStatus: { type: String, enum: ['pending', 'verified', 'disabled'], default: undefined },
      stripeAccountDefaultCurrency: { type: String, default: undefined },
      stripeAccountPayoutsEnabled: { type: Boolean, default: undefined },
      stripeAccountChargesEnabled: { type: Boolean, default: undefined },
      stripeAccountDisabledReason: { type: String, default: undefined },
      stripeAccountCapabilities: { type: Map, of: String, default: {} },
      stripeAccountNeedsOnboarding: { type: Boolean, default: undefined },
      stripeAccountCountry: { type: String, default: undefined },
    },
    lastPaymentError: {
      at: { type: Date },
      paymentId: { type: String },
      status: { type: String },
      statusDetail: { type: String },
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
  { timestamps: true }
);

// --- ÍNDICES E HOOKS ---
userSchema.index(
  { 'commissionLog.status': 1, 'commissionLog.availableAt': 1 },
  { name: 'idx_commission_pending_due' }
);
userSchema.index(
  { 'affiliateDebtByCurrency.brl': 1, 'affiliateDebtByCurrency.usd': 1 },
  { name: 'idx_affiliate_debt_by_currency' }
);

// Índice composto para lookup de código + avaliação rápida de expiração
userSchema.index(
  { whatsappVerificationCode: 1, whatsappVerificationCodeExpiresAt: 1 },
  { name: 'idx_whatsapp_code_and_exp' }
);

userSchema.pre<IUser>("save", function (next) {
  const TAG_PRE_SAVE = '[User.ts pre-save v1.9.24]';
  if (this.isNew && !this.affiliateCode) {
    const newCode = generateAffiliateCode();
    logger.info(`${TAG_PRE_SAVE} Gerando novo affiliateCode: '${newCode}' para User Email: ${this.email}`);
    this.affiliateCode = newCode;
  }
  if (this.onboardingCompletedAt && this.isNewUserForOnboarding) {
    this.isNewUserForOnboarding = false;
  }
  // Se o usuário já está verificado no WhatsApp, não faz sentido manter código/expiração
  if (this.whatsappVerified) {
    if (this.whatsappVerificationCode || this.whatsappVerificationCodeExpiresAt) {
      logger.debug(`${TAG_PRE_SAVE} Limpando campos de verificação de WhatsApp por conta verificada.`);
      this.whatsappVerificationCode = null;
      this.whatsappVerificationCodeExpiresAt = null;
    }
  }
  next();
});

const UserModel: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", userSchema);

if (!mongoose.models.User) {
  UserModel.createIndexes().catch((err) => {
    logger.error(`[User.ts] Erro ao criar índices: ${err}`);
  });
}

export default UserModel;
