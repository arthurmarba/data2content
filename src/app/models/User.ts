import { Schema, model, models } from "mongoose";

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
const userSchema = new Schema(
  {
    // ========================
    // Dados básicos
    // ========================
    name: { type: String },
    email: { type: String, required: true, unique: true },
    googleId: { type: String },
    role: { type: String, default: "user" },

    // ========================
    // Plano
    // ========================
    planStatus: { type: String, default: "inactive" }, // "inactive", "active", "pending", "expired" etc.
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
    timestamps: true, // cria createdAt e updatedAt automaticamente
  }
);

/**
 * pre-save:
 * Se não existir affiliateCode, gera automaticamente.
 */
userSchema.pre("save", function (next) {
  if (!this.affiliateCode) {
    this.affiliateCode = generateAffiliateCode();
  }
  next();
});

// ========================
// ÍNDICES EXTRAS (SEM DUPLICAR OS 'unique')
// ========================

// Removemos os índices duplicados de email e affiliateCode,
// pois já estão definidos como unique nos campos acima.

// Índice para whatsappPhone (busca rápida)
userSchema.index({ whatsappPhone: 1 });

// Índice para planStatus (se precisar filtrar por status)
userSchema.index({ planStatus: 1 });

export default models.User || model("User", userSchema);
