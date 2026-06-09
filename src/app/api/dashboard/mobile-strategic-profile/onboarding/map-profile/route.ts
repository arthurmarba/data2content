import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";

/**
 * POST /api/dashboard/mobile-strategic-profile/onboarding/map-profile
 *
 * Fase 1 — salva as 5 perguntas do mapa seed coletadas no final do onboarding.
 * Os dados são salvos em User.creatorProfileExtended para alimentar o Gemini
 * e o aiOrchestrator a partir da primeira leitura.
 *
 * Todos os campos são opcionais — o criador pode pular qualquer pergunta.
 *
 * Body:
 *   {
 *     niches?: string[];          // max 5
 *     brandTerritories?: string;  // texto livre, separado por vírgula
 *     mainGoal3m?: string;        // valor de MAP_GOALS
 *     mainPains?: string[];       // max 2
 *     dreamBrands?: string;       // texto livre
 *   }
 */
export async function POST(request: Request) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Body inválido." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Body deve ser um objeto JSON." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Normalização defensiva — todos os campos são opcionais
  const niches = Array.isArray(b.niches)
    ? b.niches.filter((n): n is string => typeof n === "string").slice(0, 5)
    : [];

  const brandTerritoriesRaw = typeof b.brandTerritories === "string" ? b.brandTerritories.trim() : "";
  const brandTerritories = brandTerritoriesRaw
    ? brandTerritoriesRaw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6)
    : [];

  const mainGoal3m =
    typeof b.mainGoal3m === "string" && b.mainGoal3m.trim() ? b.mainGoal3m.trim() : null;

  const mainPains = Array.isArray(b.mainPains)
    ? b.mainPains.filter((p): p is string => typeof p === "string").slice(0, 2)
    : [];

  const dreamBrandsRaw = typeof b.dreamBrands === "string" ? b.dreamBrands.trim() : "";
  const dreamBrands = dreamBrandsRaw
    ? dreamBrandsRaw.split(",").map((b) => b.trim()).filter(Boolean).slice(0, 3)
    : [];

  // Só atualiza campos que foram de fato preenchidos
  const profileUpdate: Record<string, unknown> = {};
  if (niches.length) profileUpdate["creatorProfileExtended.niches"] = niches;
  if (brandTerritories.length) profileUpdate["creatorProfileExtended.brandTerritories"] = brandTerritories;
  if (mainGoal3m) profileUpdate["creatorProfileExtended.mainGoal3m"] = mainGoal3m;
  if (mainPains.length) profileUpdate["creatorProfileExtended.mainPains"] = mainPains;
  if (dreamBrands.length) profileUpdate["creatorProfileExtended.dreamBrands"] = dreamBrands;

  if (Object.keys(profileUpdate).length === 0) {
    // Nenhum campo preenchido — criador pulou tudo, ok
    return NextResponse.json({ ok: true, saved: 0 });
  }

  try {
    await connectToDatabase();
    const { default: UserModel } = await import("@/app/models/User");

    await UserModel.findByIdAndUpdate(userId, { $set: profileUpdate });

    return NextResponse.json({ ok: true, saved: Object.keys(profileUpdate).length });
  } catch (err) {
    console.error("[onboarding/map-profile] Erro ao salvar perfil do mapa:", err);
    return NextResponse.json({ message: "Não foi possível salvar o perfil." }, { status: 500 });
  }
}
