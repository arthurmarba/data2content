import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface que descreve um documento de usuário.
 */
export interface IUser extends Document {
  // ========================
  // Dados básicos
  // ========================
  name?: string;
  email: string;
  image?: string; // Propriedade adicionada para armazenar a imagem do usuário
  googleId?: string;
  role: string;

  // ========================
  // Plano
  // ========================
  planStatus?: string;
  planExpiresAt?: Date | null;

  // ========================
  // WhatsApp
  // ========================
  whatsappVerificationCode?: string | null;
  whatsappPhone?: string | null;

  // ========================
  // Gamificação (Ex.: rank de afiliado)
  // ========================
  affiliateRank?: number;
  affiliateInvites?: number;

  // ========================
  // Afiliado
  // ========================
  affiliateCode?: string;
  affiliateUsed?: string;
  affiliateBalance?: number;

  // ========================
  // Dados de pagamento (Pix, conta bancária, etc.)
  // ========================
  paymentInfo?: {
    pixKey?: string;
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
  };
}

/**
 * Gera um código de afiliado aleatório (6 caracteres maiúsculos).
 * Ajuste se quiser códigos mais longos ou formato diferente.
 */
function generateAffiliateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * User Schema:
 * - Armazena dados básicos, plano, WhatsApp, programa de afiliados e dados de pagamento.
 * - timestamps: true => cria createdAt e updatedAt automaticamente.
 */
const userSchema = new Schema<IUser>(
  {
    // ========================
    // Dados básicos
    // ========================
    name: { type: String },
    email: { type: String, required: true, unique: true },
    image: { type: String }, // Campo para a imagem do usuário
    googleId: { type: String },
    role: { type: String, default: "user" },

    // ========================
    // Plano
    // ========================
    planStatus: { type: String, default: "inactive" },
    planExpiresAt: { type: Date, default: null },

    // ========================
    // WhatsApp
    // ========================
    whatsappVerificationCode: { type: String, default: null },
    whatsappPhone: { type: String, default: null },

    // ========================
    // Gamificação (Ex.: rank de afiliado)
    // ========================
    affiliateRank: { type: Number, default: 1 },
    affiliateInvites: { type: Number, default: 0 },

    // ========================
    // Afiliado
    // ========================
    affiliateCode: { type: String, unique: true },
    affiliateUsed: { type: String, default: "" },
    affiliateBalance: { type: Number, default: 0 },

    // ========================
    // Dados de pagamento (Pix, conta bancária, etc.)
    // ========================
    paymentInfo: {
      pixKey: { type: String, default: "" },
      bankName: { type: String, default: "" },
      bankAgency: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
    },
  },
  {
    timestamps: true, // Cria createdAt e updatedAt automaticamente
  }
);

/**
 * Pre-save:
 * Se não existir affiliateCode, gera automaticamente.
 */
userSchema.pre<IUser>("save", function (next) {
  if (!this.affiliateCode) {
    this.affiliateCode = generateAffiliateCode();
  }
  next();
});

// ========================
// ÍNDICES EXTRAS
// ========================

// Índice para whatsappPhone (busca rápida)
userSchema.index({ whatsappPhone: 1 });

// Índice para planStatus (caso precise filtrar por status)
userSchema.index({ planStatus: 1 });

// Exporta o modelo já tipado. Se o modelo já existir (ex.: hot-reloading), utiliza-o; caso contrário, cria um novo.
export default models.User
  ? (models.User as Model<IUser>)
  : model<IUser>("User", userSchema);
