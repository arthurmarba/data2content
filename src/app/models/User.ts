// @/app/models/User.ts - v1.9.8 (Campos adicionais em availableIgAccounts)
// - ATUALIZADO: Adicionados campos opcionais 'username' e 'profile_picture_url'
//   à interface 'IAvailableInstagramAccount' e ao 'AvailableInstagramAccountSchema'
//   para alinhar com os dados retornados por 'fetchAvailableInstagramAccounts v3.0+'.
// - Mantém funcionalidades da v1.9.7.

import { Schema, model, models, Document, Model, Types } from "mongoose";
import { logger } from "@/app/lib/logger"; // Importar o logger

/**
 * Interface para uma conta do Instagram disponível.
 * ATUALIZADO v1.9.8: Adicionados username e profile_picture_url.
 */
export interface IAvailableInstagramAccount {
  igAccountId: string;
  pageId: string; // ID da Página do Facebook associada
  pageName: string; // Nome da Página do Facebook associada
  username?: string; // Username da conta IG (opcional)
  profile_picture_url?: string; // URL da foto de perfil da conta IG (opcional)
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
 * Interface que descreve um documento de usuário.
 * ATUALIZADO v1.9.8: Campos em IAvailableInstagramAccount atualizados.
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
 * Schema para o subdocumento de contas IG disponíveis.
 * ATUALIZADO v1.9.8: Adicionados username e profile_picture_url.
 */
const AvailableInstagramAccountSchema = new Schema<IAvailableInstagramAccount>({
  igAccountId: { type: String, required: true },
  pageId: { type: String, required: true },
  pageName: { type: String, required: true },
  username: { type: String }, // Opcional
  profile_picture_url: { type: String }, // Opcional
}, { _id: false }); 


/**
 * Definição do Schema para o User
 * ATUALIZADO v1.9.8: Campos em AvailableInstagramAccountSchema atualizados.
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
    timestamps: true, 
  }
);

userSchema.pre<IUser>("save", function (next) {
  const TAG_PRE_SAVE = '[User.ts pre-save]';
  logger.debug(`${TAG_PRE_SAVE} Hook acionado. User ID (antes de salvar, pode ser undefined se novo): ${this._id}, Email: ${this.email}`);
  logger.debug(`${TAG_PRE_SAVE} this.isNew: ${this.isNew}, this.affiliateCode (antes): '${this.affiliateCode}' (tipo: ${typeof this.affiliateCode})`);

  if (this.isNew && !this.affiliateCode) {
    const newCode = generateAffiliateCode();
    logger.info(`${TAG_PRE_SAVE} Gerando novo affiliateCode: '${newCode}' para User Email: ${this.email}`);
    this.affiliateCode = newCode;
  } else if (this.isNew && this.affiliateCode) {
    logger.warn(`${TAG_PRE_SAVE} Usuário é novo (isNew=true) mas JÁ POSSUI affiliateCode: '${this.affiliateCode}'. Não será gerado novo código. Email: ${this.email}`);
  } else if (!this.isNew) {
    // logger.debug(`${TAG_PRE_SAVE} Usuário não é novo (isNew=false). Não irá gerar affiliateCode. Email: ${this.email}`);
  } else {
     logger.warn(`${TAG_PRE_SAVE} Condição para gerar affiliateCode não atendida, mas usuário é novo e sem código. isNew: ${this.isNew}, affiliateCode: ${this.affiliateCode}. Email: ${this.email}`);
  }

  if (this.isModified('instagramAccountId') || this.isNew) { 
    if (this.instagramAccountId && this.instagramAccountId.trim() !== '') {
        // this.isInstagramConnected = true; // Comentado - deve ser definido por connectInstagramAccount
    } else {
        // this.isInstagramConnected = false; // Comentado - deve ser definido por connectInstagramAccount ou no signIn
    }
  }

  if (this.onboardingCompletedAt && this.isNewUserForOnboarding) {
    logger.debug(`${TAG_PRE_SAVE} Usuário completou onboarding. Setando isNewUserForOnboarding para false. Email: ${this.email}`);
    this.isNewUserForOnboarding = false;
  }
  logger.debug(`${TAG_PRE_SAVE} affiliateCode (depois da lógica): '${this.affiliateCode}'`);
  next();
});

const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;
