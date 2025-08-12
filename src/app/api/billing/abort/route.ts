import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId } = await req.json().catch(() => ({}));

    const session = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user)
      return NextResponse.json({ error: "user not found" }, { status: 404 });

    const customerId = (user as any).stripeCustomerId;
    if (!customerId) {
      (user as any).planStatus = "inactive";
      await user.save();
      return NextResponse.json({ ok: true, cleaned: [], status: "no_customer" });
    }

    const cleaned: string[] = [];

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      if (
        sub &&
        (sub.status === "incomplete" || sub.status === "incomplete_expired")
      ) {
        await stripe.subscriptions.cancel(sub.id);
        cleaned.push(sub.id);
      }
    }

    const res = await cancelBlockingIncompleteSubs(customerId);
    cleaned.push(...res.canceled);

    (user as any).planStatus = "inactive";
    if (
      (user as any).stripeSubscriptionId &&
      cleaned.includes((user as any).stripeSubscriptionId)
    ) {
      (user as any).stripeSubscriptionId = null;
    }
    await user.save();

    return NextResponse.json({ ok: true, cleaned });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "abort_failed" },
      { status: 500 }
    );
  }
}

