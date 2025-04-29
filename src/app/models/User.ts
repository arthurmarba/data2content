// @/app/models/User.ts - v1.5 (Adicionado isInstagramConnected)

import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface que descreve um documento de usuário.
 */
export interface IUser extends Document {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  image?: string;
  googleId?: string;
  provider?: string;
  providerAccountId?: string;
  // --- CAMPOS ADICIONADOS PARA INTEGRAÇÃO INSTAGRAM ---
  instagramAccessToken?: string; // Token de Longa Duração (LLAT)
  instagramAccountId?: string; // ID da Conta Profissional do Instagram
  isInstagramConnected?: boolean; // <<< ADICIONADO AQUI >>> Flag de status da conexão
  // ---------------------------------------------------
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
    // --- CAMPOS ADICIONADOS PARA INTEGRAÇÃO INSTAGRAM ---
    instagramAccessToken: { type: String }, // Armazena o LLAT
    instagramAccountId: { type: String, index: true }, // ID da conta IG vinculada
    isInstagramConnected: { type: Boolean, default: false }, // <<< ADICIONADO AQUI >>>
    // ---------------------------------------------------
    role: { type: String, default: "user" },
    planStatus: { type: String, default: "inactive" },
    planExpiresAt: { type: Date, default: null },
    whatsappVerificationCode: { type: String, default: null, index: true },
    whatsappPhone: { type: String, default: null, index: true },
    whatsappVerified: { type: Boolean, default: false },
    profileTone: { type: String, default: 'informal e prestativo' },
    hobbies: { type: [String], default: [] },
    // Campos de Afiliado
    affiliateRank: { type: Number, default: 1 },
    affiliateInvites: { type: Number, default: 0 },
    affiliateCode: { type: String, unique: true, sparse: true },
    affiliateUsed: { type: String, default: null },
    affiliateBalance: { type: Number, default: 0 },
    // Dados de Pagamento do Afiliado
    paymentInfo: {
      pixKey: { type: String, default: "" },
      bankName: { type: String, default: "" },
      bankAgency: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
    },
    // Controle de Webhook
    lastProcessedPaymentId: { type: String, default: null, index: true },
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save hook para gerar affiliateCode se ainda não existir
 */
userSchema.pre<IUser>("save", function (next) {
  if (this.isNew && !this.affiliateCode) {
    this.affiliateCode = generateAffiliateCode();
  }
  // <<< ADICIONADO >>> Garante que isInstagramConnected seja definido com base no accountId se for indefinido
  if (this.isInstagramConnected === undefined) {
      this.isInstagramConnected = !!this.instagramAccountId;
  }
  next();
});

/**
 * Exporta o modelo 'User', evitando recriação em dev/hot reload
 */
const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;
