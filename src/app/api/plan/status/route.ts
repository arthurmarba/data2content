import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  // Se já temos estado persistido, devolve direto (fast-path)
  if (user.planInterval) {
    return NextResponse.json({
      ok: true,
      status: user.planStatus,
      interval: user.planInterval,
      priceId: user.stripePriceId,
      planExpiresAt: user.planExpiresAt,
    });
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json({
      ok: true,
      status: user.planStatus ?? null,
      interval: user.planInterval ?? null,
      priceId: user.stripePriceId ?? null,
      planExpiresAt: user.planExpiresAt ?? null,
    });
  }

  // Busca a assinatura mais “ativa” (prioriza a que NÃO está marcada para não renovar)
  const listed = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "all",
    limit: 1,
  });

  const sub = listed.data.find((s) => !(s as any).cancel_at_period_end) ?? listed.data[0];

  // Pode não haver assinatura
  if (!sub) {
    return NextResponse.json({
      ok: true,
      status: null,
      interval: null,
      priceId: null,
      planExpiresAt: user.planExpiresAt ?? null,
    });
  }

  const status: string | null = (sub as any).cancel_at_period_end ? "non_renewing" : sub.status;
  const item = sub.items.data[0];
  const interval: string | null = item?.price?.recurring?.interval ?? null;

  // Em basil, o fim do período fica por item (current_period_end), e também existe cancel_at.
  // 1) Se houver cancel_at, é a melhor estimativa de “expira em”.
  // 2) Senão, usamos o MENOR current_period_end entre os items.
  let planExpiresAt: Date | null = user.planExpiresAt ?? null;

  const cancelAtSec = typeof (sub as any).cancel_at === "number" ? (sub as any).cancel_at : null;

  if (typeof cancelAtSec === "number") {
    planExpiresAt = new Date(cancelAtSec * 1000);
  } else {
    const ends = sub.items.data
      .map((it) => (it as any)?.current_period_end)
      .filter((n: any): n is number => typeof n === "number");
    if (ends.length > 0) {
      const minEnd = Math.min(...ends);
      planExpiresAt = new Date(minEnd * 1000);
    }
  }

  // Persiste no usuário
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        planStatus: status,
        stripeSubscriptionId: sub.id,
        stripePriceId: item?.price?.id,
        planInterval: interval,
        planExpiresAt: planExpiresAt ?? user.planExpiresAt ?? null,
      },
    }
  );

  return NextResponse.json({
    ok: true,
    status,
    interval,
    priceId: item?.price?.id ?? null,
    planExpiresAt: planExpiresAt ?? user.planExpiresAt ?? null,
  });
}
