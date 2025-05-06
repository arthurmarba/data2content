// @/app/models/User.ts - v1.8.1 (Adicionado Campos Sync Status)
// - Adiciona lastInstagramSyncAttempt e lastInstagramSyncSuccess ao Schema e Interface.

import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface que descreve um documento de usuário.
 * ATUALIZADO v1.8.1: Adicionados campos de status de sincronização.
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
  lastInstagramSyncAttempt?: Date | null;   // <<< ADICIONADO v1.8.1 >>>
  lastInstagramSyncSuccess?: boolean | null;// <<< ADICIONADO v1.8.1 >>>
  // Campos básicos da conta IG (obtidos via API)
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
  affiliateRank?: number;
  affiliateInvites?: number;
  affiliateCode?: string;
  affiliateUsed?: string;
  affiliateBalance?: number;
  paymentInfo?: {
    pixKey?: string;
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
  };
  lastProcessedPaymentId?: string;
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
 * Definição do Schema para o User
 * ATUALIZADO v1.8.1: Adicionados campos de status de sincronização.
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
    lastInstagramSyncAttempt: { type: Date, default: null },   // <<< ADICIONADO v1.8.1 >>>
    lastInstagramSyncSuccess: { type: Boolean, default: null },// <<< ADICIONADO v1.8.1 >>>
    // Campos básicos da conta IG (opcional adicionar ao schema se quiser salvar)
    username: { type: String, sparse: true },
    biography: { type: String },
    website: { type: String },
    profile_picture_url: { type: String },
    followers_count: { type: Number },
    follows_count: { type: Number },
    media_count: { type: Number },
    is_published: { type: Boolean },
    shopping_product_tag_eligibility: { type: Boolean },

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
    affiliateRank: { type: Number, default: 1 },
    affiliateInvites: { type: Number, default: 0 },
    affiliateCode: { type: String, unique: true, sparse: true },
    affiliateUsed: { type: String, default: null },
    affiliateBalance: { type: Number, default: 0 },
    paymentInfo: {
      pixKey: { type: String, default: "" },
      bankName: { type: String, default: "" },
      bankAgency: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
    },
    lastProcessedPaymentId: { type: String, default: null, index: true },
  },
  {
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  }
);

/**
 * Pre-save hook para gerar affiliateCode se ainda não existir
 */
userSchema.pre<IUser>("save", function (next) {
  if (this.isNew && !this.affiliateCode) {
    this.affiliateCode = generateAffiliateCode();
  }
  // Garante que isInstagramConnected reflita o estado de instagramAccountId se não definido
  // NOTA: A lógica explícita em connectInstagramAccount / clearInstagramConnection provavelmente
  // tornará esta parte menos crítica, mas é um bom fallback.
  if (this.isInstagramConnected === undefined && this.instagramAccountId !== undefined) {
      this.isInstagramConnected = !!this.instagramAccountId;
  } else if (this.isInstagramConnected === undefined) {
      this.isInstagramConnected = false;
  }
  next();
});

/**
 * Exporta o modelo 'User', evitando recriação em dev/hot reload
 */
const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;