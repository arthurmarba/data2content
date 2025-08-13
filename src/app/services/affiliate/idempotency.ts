import { connectToDatabase } from "@/app/lib/mongoose";
import AffiliateInvoiceIndex from "@/app/models/AffiliateInvoiceIndex";
import AffiliateSubscriptionIndex from "@/app/models/AffiliateSubscriptionIndex";
import { Types } from "mongoose";

export async function ensureInvoiceIdempotent(
  invoiceId: string,
  affiliateUserId: Types.ObjectId | string
): Promise<{ ok: boolean; reason?: "duplicate" }> {
  await connectToDatabase();
  try {
    await AffiliateInvoiceIndex.create({
      invoiceId,
      affiliateUserId,
      createdAt: new Date(),
    });
    return { ok: true };
  } catch (e: any) {
    if (e?.code === 11000) {
      return { ok: false, reason: "duplicate" };
    }
    throw e;
  }
}

export async function ensureSubscriptionFirstTime(
  subscriptionId: string,
  affiliateUserId: Types.ObjectId | string
): Promise<{ ok: boolean; reason?: "already-had-commission" }> {
  await connectToDatabase();
  try {
    await AffiliateSubscriptionIndex.create({
      subscriptionId,
      affiliateUserId,
      createdAt: new Date(),
    });
    return { ok: true };
  } catch (e: any) {
    if (e?.code === 11000) {
      return { ok: false, reason: "already-had-commission" };
    }
    throw e;
  }
}
