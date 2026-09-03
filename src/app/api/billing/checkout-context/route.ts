import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { checkoutJourneyFromMetadata } from "@/app/lib/billing/checkoutJourney";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadAuthOptions() {
  if (process.env.NODE_ENV === "test") return {} as any;
  const mod = await import("@/app/api/auth/[...nextauth]/route");
  return mod.authOptions as any;
}

export async function GET(request: NextRequest) {
  const authOptions = await loadAuthOptions();
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const attemptId = request.nextUrl.searchParams.get("attempt_id")?.trim() ?? "";
  if (!/^(cs_|sub_)[A-Za-z0-9_]+$/.test(attemptId)) {
    return NextResponse.json({ error: "Tentativa inválida" }, { status: 400 });
  }

  try {
    if (attemptId.startsWith("cs_")) {
      const checkoutSession = await stripe.checkout.sessions.retrieve(attemptId);
      const ownerId = checkoutSession.client_reference_id
        ?? checkoutSession.metadata?.userId
        ?? null;
      if (ownerId !== String(userId)) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
      }
      return NextResponse.json({
        ok: true,
        journey: checkoutJourneyFromMetadata(checkoutSession.metadata),
      });
    }

    const subscription = await stripe.subscriptions.retrieve(attemptId);
    if (subscription.metadata?.userId !== String(userId)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    return NextResponse.json({
      ok: true,
      journey: checkoutJourneyFromMetadata(subscription.metadata),
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível recuperar o contexto do pagamento" },
      { status: 404 },
    );
  }
}
