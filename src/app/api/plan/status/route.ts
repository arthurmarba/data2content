import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  if (user.planInterval) {
    return NextResponse.json({
      ok: true,
      status: user.planStatus,
      interval: user.planInterval,
      priceId: user.stripePriceId,
      planExpiresAt: user.planExpiresAt,
    });
  }

  const subs = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "active",
    limit: 1,
  });
  const sub = subs.data.find((s) => !s.cancel_at_period_end) ?? subs.data[0];
  const item = sub?.items.data[0];
  const interval = item?.price.recurring?.interval ?? null;

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        planStatus: sub?.status,
        stripeSubscriptionId: sub?.id,
        stripePriceId: item?.price.id,
        planInterval: interval,
        planExpiresAt: sub?.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : user.planExpiresAt,
      },
    }
  );

  return NextResponse.json({
    ok: true,
    status: sub?.status,
    interval,
    priceId: item?.price.id,
    planExpiresAt: sub?.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : user.planExpiresAt,
  });
}
