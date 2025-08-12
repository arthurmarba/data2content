import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export type CreditArgs = {
  affiliateUserId: string;
  amountCents: number;
  currency: string;
  description: string;
  sourcePaymentId?: string;
  referredUserId?: string;
};

export async function creditAffiliateCommission(args: CreditArgs) {
  const { affiliateUserId, amountCents, currency, description, sourcePaymentId, referredUserId } = args;
  await connectToDatabase();

  const user = await User.findById(affiliateUserId);
  if (!user) throw new Error("Affiliate user not found");

  user.commissionLog ||= [];
  user.commissionLog.push({
    date: new Date(),
    description,
    sourcePaymentId,
    referredUserId,
    currency: currency.toLowerCase(),
    amountCents,
    status: "accrued",
  });

  user.affiliateBalances ||= new Map();
  const cur = currency.toLowerCase();
  const prev = user.affiliateBalances.get(cur) ?? 0;
  user.affiliateBalances.set(cur, prev + amountCents);

  user.markModified("commissionLog");
  user.markModified("affiliateBalances");
  await user.save();

  return { ok: true };
}
