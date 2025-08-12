import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { Types } from "mongoose";

export type CreditArgs = {
  affiliateUserId: string;
  amountCents: number;
  currency: string;
  description: string;
  sourcePaymentId?: string;
  referredUserId?: string; // chega como string
};

export async function creditAffiliateCommission(args: CreditArgs) {
  const {
    affiliateUserId,
    amountCents,
    currency,
    description,
    sourcePaymentId,
    referredUserId,
  } = args;

  await connectToDatabase();

  if (!Types.ObjectId.isValid(affiliateUserId)) {
    throw new Error("Invalid affiliateUserId");
  }

  const user = await User.findById(affiliateUserId);
  if (!user) throw new Error("Affiliate user not found");

  // normaliza moeda e valida o referredUserId (se vier)
  const lowerCurrency = (currency || "BRL").toLowerCase();
  const referredObjId =
    referredUserId && Types.ObjectId.isValid(referredUserId)
      ? new Types.ObjectId(referredUserId)
      : undefined;

  user.commissionLog ||= [];
  user.commissionLog.push({
    date: new Date(),
    description,
    sourcePaymentId,
    referredUserId: referredObjId, // agora é ObjectId | undefined
    currency: lowerCurrency,
    amountCents,
    status: "accrued",
  });

  // Garante que affiliateBalances seja um Map-like válido (cobre legado objeto plano)
  // @ts-ignore (MongooseMap possui get/set em runtime)
  if (!user.affiliateBalances) {
    // @ts-ignore
    user.affiliateBalances = new Map<string, number>();
  }
  // @ts-ignore
  if (typeof (user.affiliateBalances as any).get !== "function") {
    const asObj = user.affiliateBalances as unknown as Record<string, number>;
    // @ts-ignore
    user.affiliateBalances = new Map<string, number>(Object.entries(asObj || {}));
  }

  // @ts-ignore
  const prev = user.affiliateBalances.get(lowerCurrency) ?? 0;
  // @ts-ignore
  user.affiliateBalances.set(lowerCurrency, prev + amountCents);

  user.markModified("commissionLog");
  user.markModified("affiliateBalances");
  await user.save();

  return { ok: true };
}
