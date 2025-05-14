// @/app/models/User.ts - v1.9.5 (Sincronização - Campo de Erro)
// - ADICIONADO: Campo 'instagramSyncErrorMsg' para armazenar erros de sincronização do Instagram.
// - Mantém funcionalidades da v1.9.4.

import { Schema, model, models, Document, Model, Types } from "mongoose";

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
 * Interface que descreve um documento de usuário.
 * ATUALIZADO v1.9.5: Adicionado 'instagramSyncErrorMsg'.
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

  // --- CAMPOS DA INTEGRAÇÃO INSTAGRAM ---
  instagramAccessToken?: string;
  instagramAccountId?: string;
  isInstagramConnected?: boolean;
  lastInstagramSyncAttempt?: Date | null;
  lastInstagramSyncSuccess?: boolean | null;
  instagramSyncErrorMsg?: string | null; // << NOVO CAMPO (Tarefa 3.1)
  username?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  is_published?: boolean;
  shopping_product_tag_eligibility?: boolean;

  // --- CAMPOS DE VINCULAÇÃO TEMPORÁRIA ---
  linkToken?: string;
  linkTokenExpiresAt?: Date;

  // --- Outros Campos ---
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

  // --- Campos para Comunidade de Inspiração ---
  communityInspirationOptIn?: boolean;
  communityInspirationOptInDate?: Date | null;
  communityInspirationTermsVersion?: string | null;
  lastCommunityInspirationShown_Daily?: ILastCommunityInspirationShown | null;

  // --- CAMPOS PARA CONTROLE DE ONBOARDING ---
  isNewUserForOnboarding?: boolean;
  onboardingCompletedAt?: Date | null;

  // --- CAMPO PARA PERSONALIZAÇÃO DA IA ---
  inferredExpertiseLevel?: UserExpertiseLevel;

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Gera um código de afiliado aleatório (6 caracteres maiúsculos).
 */
function generateAffiliateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Schema para uma entrada no log de comissões.
 */
const commissionLogEntrySchema = new Schema<ICommissionLogEntry>({
  date: { type: Date, required: true, default: Date.now },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  sourcePaymentId: { type: String },
  referredUserId: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

/**
 * Schema para o subdocumento 'lastCommunityInspirationShown_Daily'.
 */
const lastCommunityInspirationShownSchema = new Schema<ILastCommunityInspirationShown>({
  date: { type: Date, required: true },
  inspirationIds: [{ type: Schema.Types.ObjectId, ref: 'CommunityInspiration' }]
}, { _id: false });


/**
 * Definição do Schema para o User
 * ATUALIZADO v1.9.5: Adicionado 'instagramSyncErrorMsg'.
 */
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

    // --- CAMPOS DA INTEGRAÇÃO INSTAGRAM ---
    instagramAccessToken: { type: String },
    instagramAccountId: { type: String, index: true },
    isInstagramConnected: { type: Boolean, default: false },
    lastInstagramSyncAttempt: { type: Date, default: null },
    lastInstagramSyncSuccess: { type: Boolean, default: null },
    instagramSyncErrorMsg: { type: String, default: null }, // << NOVO CAMPO (Tarefa 3.1)
    username: { type: String, sparse: true }, // Username do Instagram
    biography: { type: String },
    website: { type: String },
    profile_picture_url: { type: String },
    followers_count: { type: Number },
    follows_count: { type: Number },
    media_count: { type: Number },
    is_published: { type: Boolean }, // Campo do IG User (se aplicável)
    shopping_product_tag_eligibility: { type: Boolean }, // Campo do IG User (se aplicável)

    // --- CAMPOS DE VINCULAÇÃO TEMPORÁRIA ---
    linkToken: { type: String, index: true, sparse: true },
    linkTokenExpiresAt: { type: Date },

    // --- Outros Campos ---
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

    // --- Campos para Comunidade de Inspiração ---
    communityInspirationOptIn: { type: Boolean, default: false },
    communityInspirationOptInDate: { type: Date, default: null },
    communityInspirationTermsVersion: { type: String, default: null },
    lastCommunityInspirationShown_Daily: { type: lastCommunityInspirationShownSchema, default: null },

    // --- CAMPOS PARA CONTROLE DE ONBOARDING ---
    isNewUserForOnboarding: { type: Boolean, default: true },
    onboardingCompletedAt: { type: Date, default: null },

    // --- CAMPO PARA PERSONALIZAÇÃO DA IA ---
    inferredExpertiseLevel: {
        type: String,
        enum: ['iniciante', 'intermediario', 'avancado'],
        default: 'iniciante'
    },

  },
  {
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  }
);

userSchema.pre<IUser>("save", function (next) {
  if (this.isNew && !this.affiliateCode) {
    this.affiliateCode = generateAffiliateCode();
  }
  // Lógica para isInstagramConnected mantida
  if (this.isInstagramConnected === undefined && this.instagramAccountId !== undefined && this.instagramAccountId !== null && this.instagramAccountId !== '') {
      this.isInstagramConnected = true;
  } else if (this.isInstagramConnected === undefined) {
      this.isInstagramConnected = false;
  }

  // Garante que se onboardingCompletedAt estiver preenchido, isNewUserForOnboarding seja false
  if (this.onboardingCompletedAt && this.isNewUserForOnboarding) {
    this.isNewUserForOnboarding = false;
  }

  next();
});

// Utiliza models.User se já existir (importante para Next.js com HMR)
const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;
