import { Schema, model, models, Document, Model } from "mongoose";

/**
 * Interface que descreve um documento de usuário.
 */
export interface IUser extends Document {
  name?: string;
  email: string;
  image?: string;
  googleId?: string;
  role: string;
  planStatus?: string;
  planExpiresAt?: Date | null;
  whatsappVerificationCode?: string | null;
  whatsappPhone?: string | null;
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
    whatsappVerificationCode: { type: String, default: null },
    whatsappPhone: { type: String, default: null },
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

// Índices para buscas mais eficientes
userSchema.index({ whatsappPhone: 1 });
userSchema.index({ planStatus: 1 });

/**
 * Exporta o modelo 'User', evitando recriação em dev/hot reload
 */
const UserModel = models.User
  ? (models.User as Model<IUser>)
  : model<IUser>("User", userSchema);

export default UserModel;
