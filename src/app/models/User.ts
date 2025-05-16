// @/app/models/User.ts - v1.9.7 (Adicionado availableIgAccounts)
// - ADICIONADO: Campo 'availableIgAccounts' para armazenar contas IG disponíveis após vinculação com Facebook.
// - ADICIONADO: Schema e Interface para 'IAvailableInstagramAccount'.
// - Mantém funcionalidades da v1.9.6 (logs de diagnóstico para affiliateCode).

import { Schema, model, models, Document, Model, Types } from "mongoose";
import { logger } from "@/app/lib/logger"; // Importar o logger

/**
 * Interface para uma conta do Instagram disponível.
 * Esta interface deve ser estruturalmente compatível com o tipo
 * 'AvailableInstagramAccount' retornado pela função 'fetchAvailableInstagramAccounts'
 * no seu 'instagramService.ts'.
 */
export interface IAvailableInstagramAccount {
  igAccountId: string;
  pageId: string; // ID da Página do Facebook associada
  pageName: string; // Nome da Página do Facebook associada
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
 * ATUALIZADO v1.9.7: Adicionado 'availableIgAccounts'.
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
  instagramAccessToken?: string; // Armazena o LLAT do Instagram do usuário
  instagramAccountId?: string | null; // ID da conta IG específica que foi conectada
  isInstagramConnected?: boolean;
  lastInstagramSyncAttempt?: Date | null;
  lastInstagramSyncSuccess?: boolean | null;
  instagramSyncErrorMsg?: string | null;
  username?: string | null; // Username da conta IG específica conectada
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  is_published?: boolean;
  shopping_product_tag_eligibility?: boolean;

  // >>> NOVO CAMPO: Lista de contas IG disponíveis após vincular Facebook <<<
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
  affiliateCode?: string; // Campo para o código de afiliado
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

// >>> NOVO SCHEMA PARA O SUBDOCUMENTO DE CONTAS IG DISPONÍVEIS <<<
const AvailableInstagramAccountSchema = new Schema<IAvailableInstagramAccount>({
  igAccountId: { type: String, required: true },
  pageId: { type: String, required: true },
  pageName: { type: String, required: true },
}, { _id: false }); // _id: false porque é um subdocumento em um array


/**
 * Definição do Schema para o User
 * ATUALIZADO v1.9.7: Adicionado campo e schema para availableIgAccounts.
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
    instagramAccessToken: { type: String }, // LLAT do Instagram do usuário
    instagramAccountId: { type: String, index: true, default: null }, // ID da conta IG específica conectada
    isInstagramConnected: { type: Boolean, default: false },
    lastInstagramSyncAttempt: { type: Date, default: null },
    lastInstagramSyncSuccess: { type: Boolean, default: null },
    instagramSyncErrorMsg: { type: String, default: null },
    username: { type: String, sparse: true, default: null }, // Username da conta IG específica conectada
    biography: { type: String },
    website: { type: String },
    profile_picture_url: { type: String },
    followers_count: { type: Number },
    follows_count: { type: Number },
    media_count: { type: Number },
    is_published: { type: Boolean },
    shopping_product_tag_eligibility: { type: Boolean },

    // >>> NOVO CAMPO NO SCHEMA <<<
    availableIgAccounts: { type: [AvailableInstagramAccountSchema], default: null }, // Array de contas disponíveis

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
    affiliateCode: { type: String, unique: true, sparse: true }, // Sem default aqui para o hook funcionar
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
  const TAG_PRE_SAVE = '[User.ts pre-save]';
  // Adicionados logs para depuração da geração do affiliateCode
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

  // Lógica para isInstagramConnected:
  // Esta lógica pode precisar ser reavaliada.
  // Normalmente, isInstagramConnected só deve ser true após a seleção explícita de uma conta IG
  // e a chamada bem-sucedida a connectInstagramAccount.
  // O processo de signIn com Facebook agora definirá isInstagramConnected = false inicialmente,
  // e availableIgAccounts será populado.
  // Manter esta lógica aqui pode causar isInstagramConnected = true prematuramente se um instagramAccountId
  // antigo existir, mesmo que o usuário precise selecionar uma conta novamente.
  // Considere remover ou ajustar esta lógica específica de isInstagramConnected no pre-save.
  if (this.isModified('instagramAccountId') || this.isNew) { // Apenas se instagramAccountId estiver sendo modificado ou for novo usuário
    if (this.instagramAccountId && this.instagramAccountId.trim() !== '') {
        // this.isInstagramConnected = true; // Comentado - deve ser definido por connectInstagramAccount
    } else {
        // this.isInstagramConnected = false; // Comentado - deve ser definido por connectInstagramAccount ou no signIn
    }
  }


  // Garante que se onboardingCompletedAt estiver preenchido, isNewUserForOnboarding seja false
  if (this.onboardingCompletedAt && this.isNewUserForOnboarding) {
    logger.debug(`${TAG_PRE_SAVE} Usuário completou onboarding. Setando isNewUserForOnboarding para false. Email: ${this.email}`);
    this.isNewUserForOnboarding = false;
  }
  logger.debug(`${TAG_PRE_SAVE} affiliateCode (depois da lógica): '${this.affiliateCode}'`);
  next();
});

// Tenta obter o modelo existente ou cria um novo se não existir.
const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;
