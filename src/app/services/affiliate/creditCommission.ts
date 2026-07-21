import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { Types } from "mongoose";

export type CreditArgs = {
  affiliateUserId: string;
  amountCents: number;
  currency: string;
  description?: string;
  sourcePaymentId?: string;
  buyerUserId?: string;
};

/**
 * Crédito administrativo/legado. Exige uma origem financeira estável e usa
 * uma única atualização atômica para saldo + ledger.
 */
export async function creditAffiliateCommission(args: CreditArgs) {
  const {
    affiliateUserId,
    amountCents,
    currency,
    description,
    sourcePaymentId,
    buyerUserId,
  } = args;

  if (!Types.ObjectId.isValid(affiliateUserId)) {
    throw new Error("Invalid affiliateUserId");
  }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive safe integer");
  }
  const lowerCurrency = String(currency || "").trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(lowerCurrency)) {
    throw new Error("Invalid currency");
  }
  if (!sourcePaymentId?.trim()) {
    throw new Error("sourcePaymentId is required for idempotency");
  }
  if (buyerUserId && !Types.ObjectId.isValid(buyerUserId)) {
    throw new Error("Invalid buyerUserId");
  }

  await connectToDatabase();
  const now = new Date();
  const affiliateObjectId = new Types.ObjectId(affiliateUserId);
  const invoiceId = sourcePaymentId.trim();
  const result = await User.updateOne(
    {
      _id: affiliateObjectId,
      $or: [{ affiliateStatus: "active" }, { affiliateStatus: null }],
      commissionLog: {
        $not: { $elemMatch: { type: "commission", invoiceId } },
      },
    },
    {
      $push: {
        commissionLog: {
          type: "commission",
          status: "available",
          affiliateUserId: affiliateObjectId,
          buyerUserId: buyerUserId ? new Types.ObjectId(buyerUserId) : undefined,
          currency: lowerCurrency,
          amountCents,
          invoiceId,
          note: description,
          availableAt: now,
          maturedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      },
      $inc: { [`affiliateBalances.${lowerCurrency}`]: amountCents },
    },
  );

  if (result.modifiedCount === 1) return { ok: true, duplicate: false };

  const duplicate = await User.exists({
    _id: affiliateObjectId,
    commissionLog: { $elemMatch: { type: "commission", invoiceId } },
  });
  if (duplicate) return { ok: true, duplicate: true };
  throw new Error("Affiliate user not found or inactive");
}
