import { Schema, model, models, Document, Model, Types } from "mongoose";

/**
 * Interface que descreve um documento de Redemption (saque).
 */
export interface IRedemption extends Document {
  user: Types.ObjectId;
  amount: number;
  status: "pending" | "paid" | "canceled";
  paymentMethod?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const redemptionSchema = new Schema<IRedemption>(
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
    paymentMethod: {
      type: String,
      default: "",
      // Ex.: "pix", "transferencia", "paypal" etc.
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

/**
 * Exporta o modelo 'Redemption', evitando recriação em dev/hot reload
 */
const Redemption = models.Redemption
  ? (models.Redemption as Model<IRedemption>)
  : model<IRedemption>("Redemption", redemptionSchema);

export default Redemption;
