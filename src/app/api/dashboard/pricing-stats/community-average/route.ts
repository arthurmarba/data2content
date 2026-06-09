import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { safeFetchCommunityPricingStats } from "@/app/lib/pricing/communityPricingStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache curto na borda — o número muda lentamente, não precisa ser real-time.
const CACHE_CONTROL =
  "private, max-age=300, stale-while-revalidate=3600";

/**
 * GET /api/dashboard/pricing-stats/community-average
 *
 * Fase 3 — média real do preço "justo" cobrado por criadores Pro que usaram a
 * calculadora. Alimenta o social proof do paywall do onboarding.
 *
 * Resposta:
 *   { averageJusto: number | null; sample: number; source: "dynamic" | "insufficient" }
 *
 * Quando `averageJusto` é null (amostra insuficiente), o frontend mantém o valor
 * estático de fallback. O dado é agregado e anônimo — não expõe nenhum criador.
 */
export async function GET() {
  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const stats = await safeFetchCommunityPricingStats();

  return NextResponse.json(stats, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
