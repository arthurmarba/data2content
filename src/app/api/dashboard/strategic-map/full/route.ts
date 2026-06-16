/**
 * GET /api/dashboard/strategic-map/full
 *
 * Dados completos do mapa para o board "Seu Mapa" do desktop renderizar o MESMO
 * MapaCard do mobile (com edição). Espelha gate de feature + auth das rotas
 * mobile-strategic-profile.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { loadStrategicMapFull } from "@/app/lib/strategicMap/loadStrategicMapFull";

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

  const full = await loadStrategicMapFull(userId);
  return NextResponse.json({ ok: true, full });
}
