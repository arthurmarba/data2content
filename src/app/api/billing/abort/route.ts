import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";

export const runtime = "nodejs";

// 🔧 Tipo mínimo para evitar o erro de TS
type SessionWithUserId = { user?: { id?: string | null } } | null;

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId } = (await req.json().catch(() => ({}))) as {
      subscriptionId?: string;
    };

    const session = (await getServerSession(authOptions as any)) as SessionWithUserId;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

    const customerId = (user as any).stripeCustomerId;
    if (!customerId) {
      (user as any).planStatus = "inactive";
      await user.save();
      return NextResponse.json({ ok: true, cleaned: [], status: "no_customer" });
    }

    const cleaned: string[] = [];

    // Se veio um subscriptionId explícito, cancelá-lo se for pendência
    if (subscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (sub && (sub.status === "incomplete" || sub.status === "incomplete_expired")) {
          await stripe.subscriptions.cancel(sub.id);
          cleaned.push(sub.id);
        }
      } catch {
        // ignore id inválido/inesperado
      }
    }

    // Limpeza geral de pendências
    const res = await cancelBlockingIncompleteSubs(customerId);
    cleaned.push(...res.canceled);

    // Reset local
    (user as any).planStatus = "inactive";
    if ((user as any).stripeSubscriptionId && cleaned.includes((user as any).stripeSubscriptionId)) {
      (user as any).stripeSubscriptionId = null;
    }
    await user.save();

    return NextResponse.json({ ok: true, cleaned });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "abort_failed" }, { status: 500 });
  }
}