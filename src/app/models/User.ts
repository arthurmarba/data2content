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
  profileTone?: string; // <-- ADICIONADO: Tom de perfil para o serviço
  hobbies?: string[];   // <-- ADICIONADO: Hobbies/Interesses para o serviço
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
  // Adicionados para refletir timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Gera um código de afiliado aleatório (6 caracteres maiúsculos).
 */
function generateAffiliateCode(): string {
  // Mantida a sua implementação original
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
    googleId: { type: String }, // Mantido como está
    role: { type: String, default: "user" },
    planStatus: { type: String, default: "inactive" },
    planExpiresAt: { type: Date, default: null },
    whatsappVerificationCode: { type: String, default: null },
    whatsappPhone: { type: String, default: null },
    profileTone: { type: String, default: 'informal e prestativo' }, // <-- ADICIONADO: Com valor padrão
    hobbies: { type: [String], default: [] }, // <-- ADICIONADO: Com array vazio como padrão
    affiliateRank: { type: Number, default: 1 },
    affiliateInvites: { type: Number, default: 0 },
    affiliateCode: { type: String, unique: true }, // Mantido como está (sem sparse)
    affiliateUsed: { type: String, default: "" }, // Mantido como está
    affiliateBalance: { type: Number, default: 0 },
    paymentInfo: {
      pixKey: { type: String, default: "" },
      bankName: { type: String, default: "" },
      bankAgency: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
    },
  },
  {
    timestamps: true, // Mantido
  }
);

/**
 * Pre-save hook para gerar affiliateCode se ainda não existir
 */
userSchema.pre<IUser>("save", function (next) {
  // Mantido como está (sem checar isNew)
  if (!this.affiliateCode) {
    this.affiliateCode = generateAffiliateCode();
  }
  next();
});

// Índices para buscas mais eficientes (Mantidos como estavam)
userSchema.index({ whatsappPhone: 1 });
userSchema.index({ planStatus: 1 });
// Considerar adicionar: userSchema.index({ email: 1 });

/**
 * Exporta o modelo 'User', evitando recriação em dev/hot reload
 */
// Garante que o tipo exportado seja Model<IUser>
const UserModel: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default UserModel;