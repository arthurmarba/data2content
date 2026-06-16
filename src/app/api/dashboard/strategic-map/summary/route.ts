/**
 * GET /api/dashboard/strategic-map/summary
 *
 * Resumo do mapa do criador para o board "Seu Mapa" no desktop (vitrine,
 * leitura). Espelha o gate de feature + auth das rotas mobile-strategic-profile.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { loadStrategicMapSummary } from "@/app/lib/strategicMap/loadStrategicMapSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId: string | undefined = (session as any)?.user?.id;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const summary = await loadStrategicMapSummary(userId);
  return NextResponse.json({ ok: true, summary });
}
