import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { safeFetchNarrativePubliStats } from "@/app/lib/pricing/narrativePubliStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache curto na borda — a coorte muda lentamente, não precisa ser real-time.
const CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=3600";

/**
 * GET /api/dashboard/pricing-stats/narrative-range?narrative=<whyYouCreate>
 *
 * Faixa real de publi (p25–p75) para o entregável "1 Reels + combo de Stories",
 * calculada sobre a coorte de criadores da MESMA narrativa com seguidores
 * conhecidos. Alimenta o social proof do onboarding.
 *
 * Resposta: NarrativePubliStats
 *   { min, max, avgFollowers, label, sample, source: "dynamic" | "insufficient" }
 *
 * Quando `source === "insufficient"`, o frontend cai no fallback determinístico.
 * O dado é agregado e anônimo — não expõe nenhum criador.
 */
export async function GET(request: Request) {
  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const narrative = new URL(request.url).searchParams.get("narrative")?.trim() ?? "";
  const stats = await safeFetchNarrativePubliStats(narrative);

  return NextResponse.json(stats, { headers: { "Cache-Control": CACHE_CONTROL } });
}
