import { Schema, model, models } from "mongoose";

const redemptionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // facilita busca por usuário
    },
    amount: {
      type: Number,
      required: true, // valor do saque
      min: 0,         // não pode ser negativo
    },
    status: {
      type: String,
      enum: ["pending", "paid", "canceled"],
      default: "pending",
    },
    // Campos opcionais para fornecer mais contexto
    paymentMethod: {
      type: String,
      default: "",
      // Exemplo de uso: "pix", "transferencia", "paypal" etc.
    },
    notes: {
      type: String,
      default: "",
      // Espaço para anotações do admin ou do usuário
    },
  },
  {
    timestamps: true, // cria automaticamente createdAt e updatedAt
  }
);

export const Redemption = models.Redemption || model("Redemption", redemptionSchema);
