// @/app/models/User.ts - v1.7 (Adicionado Campos de Link Token)

import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface que descreve um documento de usuário.
 */
export interface IUser extends Document {
  _id: Types.ObjectId;
  name?: string;
  email: string; // Email principal (pode ser do Google ou do primeiro login)
  image?: string;
  googleId?: string; // Mantido se necessário para referência específica
  provider?: string; // Provider do PRIMEIRO login ou o principal
  providerAccountId?: string; // ID da conta do provider principal
  facebookProviderAccountId?: string; // ID específico da conta do Facebook
  // --- CAMPOS ADICIONADOS PARA INTEGRAÇÃO INSTAGRAM ---
  instagramAccessToken?: string;
  instagramAccountId?: string;
  isInstagramConnected?: boolean;
  // --- CAMPOS ADICIONADOS PARA VINCULAÇÃO TEMPORÁRIA --- // <<< ADICIONADOS AQUI >>>
  linkToken?: string;
  linkTokenExpiresAt?: Date;
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
    provider: { type: String, index: true }, // Provider do primeiro login
    providerAccountId: { type: String, index: true }, // ID do provider principal
    facebookProviderAccountId: { type: String, index: true, sparse: true }, // ID do Facebook
    // --- CAMPOS ADICIONADOS PARA INTEGRAÇÃO INSTAGRAM ---
    instagramAccessToken: { type: String },
    instagramAccountId: { type: String, index: true },
    isInstagramConnected: { type: Boolean, default: false },
    // --- CAMPOS ADICIONADOS PARA VINCULAÇÃO TEMPORÁRIA --- // <<< ADICIONADOS AQUI >>>
    linkToken: { type: String, index: true, sparse: true }, // Token temporário para vincular contas
    linkTokenExpiresAt: { type: Date }, // Data de expiração do linkToken
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
  // Garante que isInstagramConnected reflita o estado de instagramAccountId se não definido
  if (this.isInstagramConnected === undefined && this.instagramAccountId !== undefined) {
      this.isInstagramConnected = !!this.instagramAccountId;
  } else if (this.isInstagramConnected === undefined) {
      this.isInstagramConnected = false; // Garante um valor padrão se instagramAccountId também for undefined
  }
  next();
});

/**
 * Exporta o modelo 'User', evitando recriação em dev/hot reload
 */
const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;
