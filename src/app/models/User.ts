// @/app/models/User.ts - v1.1 (com whatsappVerified)

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
  whatsappVerified?: boolean; // <-- ADICIONADO
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
    role: { type: String, default: "user" },
    planStatus: { type: String, default: "inactive" },
    planExpiresAt: { type: Date, default: null },
    whatsappVerificationCode: { type: String, default: null, index: true }, // Adicionado index
    whatsappPhone: { type: String, default: null, index: true }, // Mantido index
    whatsappVerified: { type: Boolean, default: false }, // <-- ADICIONADO
    profileTone: { type: String, default: 'informal e prestativo' },
    hobbies: { type: [String], default: [] },
    affiliateRank: { type: Number, default: 1 },
    affiliateInvites: { type: Number, default: 0 },
    affiliateCode: { type: String, unique: true },
    affiliateUsed: { type: String, default: "" },
    affiliateBalance: { type: Number, default: 0 },
    paymentInfo: {
      pixKey: { type: String, default: "" },
      bankName: { type: String, default: "" },
      bankAgency: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save hook para gerar affiliateCode se ainda não existir
 */
userSchema.pre<IUser>("save", function (next) {
  if (!this.affiliateCode) {
    this.affiliateCode = generateAffiliateCode();
  }
  next();
});

// Índices (mantidos e adicionados)
// userSchema.index({ whatsappPhone: 1 }); // Já definido no schema
userSchema.index({ email: 1 }); // Adicionado explicitamente se não estava
// userSchema.index({ whatsappVerificationCode: 1 }); // Já definido no schema

/**
 * Exporta o modelo 'User', evitando recriação em dev/hot reload
 */
const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;
