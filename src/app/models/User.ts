// @/app/models/User.ts - v1.8 (Adicionado Campos API e Link Token)

import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface que descreve um documento de usuário.
 * ATUALIZADO v1.8: Adicionados campos básicos da API do Instagram.
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
  // Campos básicos da conta IG (obtidos via API)
  username?: string;          // <<< ADICIONADO v1.8 >>>
  biography?: string;         // <<< ADICIONADO v1.8 >>>
  website?: string;           // <<< ADICIONADO v1.8 >>>
  profile_picture_url?: string; // <<< ADICIONADO v1.8 >>>
  followers_count?: number;   // <<< ADICIONADO v1.8 >>>
  follows_count?: number;     // <<< ADICIONADO v1.8 >>>
  media_count?: number;       // <<< ADICIONADO v1.8 >>>
  is_published?: boolean;     // <<< ADICIONADO v1.8 >>>
  shopping_product_tag_eligibility?: boolean; // <<< ADICIONADO v1.8 >>>

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
 * ATUALIZADO v1.8: Adicionados campos básicos da API no Schema (opcionalmente).
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
    // Campos básicos da conta IG (opcional adicionar ao schema se quiser salvar)
    username: { type: String, sparse: true }, // <<< ADICIONADO v1.8 (Opcional no Schema) >>>
    biography: { type: String },              // <<< ADICIONADO v1.8 (Opcional no Schema) >>>
    website: { type: String },                // <<< ADICIONADO v1.8 (Opcional no Schema) >>>
    profile_picture_url: { type: String },    // <<< ADICIONADO v1.8 (Opcional no Schema) >>>
    followers_count: { type: Number },        // <<< ADICIONADO v1.8 (Opcional no Schema) >>>
    follows_count: { type: Number },          // <<< ADICIONADO v1.8 (Opcional no Schema) >>>
    media_count: { type: Number },            // <<< ADICIONADO v1.8 (Opcional no Schema) >>>
    is_published: { type: Boolean },          // <<< ADICIONADO v1.8 (Opcional no Schema) >>>
    shopping_product_tag_eligibility: { type: Boolean }, // <<< ADICIONADO v1.8 (Opcional no Schema) >>>

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

