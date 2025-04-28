// @/app/models/User.ts - v1.2 (com lastProcessedPaymentId)

import { Schema, model, models, Document, Model, Types } from "mongoose"; // Importar Types

/**
 * Interface que descreve um documento de usuário.
 */
export interface IUser extends Document {
  _id: Types.ObjectId; // Adicionar _id para clareza
  name?: string;
  email: string;
  image?: string;
  googleId?: string;
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
  lastProcessedPaymentId?: string; // <<< NOVO CAMPO ADICIONADO AQUI
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
    email: { type: String, required: true, unique: true },
    image: { type: String },
    googleId: { type: String },
    role: { type: String, default: "user" }, // Ex: 'user', 'affiliate', 'admin'
    planStatus: { type: String, default: "inactive" }, // Ex: 'inactive', 'pending', 'active', 'expired'
    planExpiresAt: { type: Date, default: null },
    whatsappVerificationCode: { type: String, default: null, index: true },
    whatsappPhone: { type: String, default: null, index: true },
    whatsappVerified: { type: Boolean, default: false },
    profileTone: { type: String, default: 'informal e prestativo' },
    hobbies: { type: [String], default: [] },
    // Campos de Afiliado
    affiliateRank: { type: Number, default: 1 },
    affiliateInvites: { type: Number, default: 0 },
    affiliateCode: { type: String, unique: true, sparse: true }, // sparse: true permite múltiplos nulos/undefined
    affiliateUsed: { type: String, default: null }, // Código que este usuário usou para se inscrever
    affiliateBalance: { type: Number, default: 0 },
    // Dados de Pagamento do Afiliado
    paymentInfo: {
      pixKey: { type: String, default: "" },
      bankName: { type: String, default: "" },
      bankAgency: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
    },
    // Controle de Webhook
    lastProcessedPaymentId: { type: String, default: null, index: true }, // <<< NOVO CAMPO ADICIONADO AQUI (index opcional, mas pode ajudar)
  },
  {
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  }
);

/**
 * Pre-save hook para gerar affiliateCode se ainda não existir
 */
userSchema.pre<IUser>("save", function (next) {
  if (this.isNew && !this.affiliateCode) { // Gera apenas para novos usuários sem código
    this.affiliateCode = generateAffiliateCode();
    // TODO: Adicionar lógica para garantir unicidade em caso de colisão (raro)
  }
  next();
});

// Índices
userSchema.index({ email: 1 }); // Garante índice no email

/**
 * Exporta o modelo 'User', evitando recriação em dev/hot reload
 */
const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;

