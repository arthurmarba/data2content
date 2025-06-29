// src/app/models/Redemption.ts

import mongoose, { Schema, model, models, Document, Model, Types } from "mongoose";

// A 'type' RedemptionStatus é importada apenas para verificação de tipos em tempo de compilação.
import { RedemptionStatus } from '@/types/admin/redemptions';

/**
 * Interface que descreve um documento de Redemption (saque).
 * Esta interface usa a 'type' e garante que seu código TypeScript esteja correto.
 */
export interface IRedemption extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  currency: string;
  status: RedemptionStatus; // <-- Uso correto da 'type' para tipagem
  requestedAt: Date;
  updatedAt: Date;
  paymentMethod?: string;
  paymentDetails?: Record<string, any>;
  adminNotes?: string;
  transactionId?: string;
}

/**
 * Schema do Mongoose.
 * Define a estrutura e as validações que existem em tempo de execução no banco de dados.
 */
const redemptionSchema = new Schema<IRedemption>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'BRL',
    },
    status: {
      type: String,
      // CORRIGIDO: Array de strings para a validação do Mongoose em tempo de execução.
      enum: ['pending', 'approved', 'rejected', 'processing', 'paid', 'failed', 'cancelled'],
      required: true,
      // CORRIGIDO: String literal para o valor default.
      default: 'pending',
    },
    paymentMethod: String,
    paymentDetails: Schema.Types.Mixed,
    adminNotes: String,
    transactionId: String,
  },
  {
    timestamps: { createdAt: 'requestedAt', updatedAt: 'updatedAt' },
  }
);

/**
 * Exporta o modelo 'Redemption' usando o padrão para evitar recriação.
 */
const RedemptionModel = models.Redemption as Model<IRedemption> || model<IRedemption>("Redemption", redemptionSchema);

export default RedemptionModel;