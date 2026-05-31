// src/app/api/onboarding/pautas/generate/route.ts
// POST /api/onboarding/pautas/generate
//
// Gera pautas a partir do mapa seed do criador.
// Requer plano Pro (verificado via mapaAccessGuard).
//
// Body (opcional):
//   { count?: number, focusTerritory?: string, focusFormat?: string }
//
// Resposta:
//   { pautas: PautaGerada[], maturidade, count }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import MapaSeedModel from "@/app/models/MapaSeed";
import CreatorContentIdea from "@/app/models/CreatorContentIdea";
import DbUser from "@/app/models/User";
import { evaluateMapaAccess, buildPaywallResponse } from "@/app/lib/mapaSeed/mapaAccessGuard";
import { generatePautasFromMapa } from "@/app/lib/mapaSeed/generatePautasFromMapa";
import VideoAssetModel from "@/app/models/VideoAsset";

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const TAG = "[API /onboarding/pautas/generate]";

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  // ── Parse body opcional ───────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    body = {};
  }

  const count = typeof body.count === "number" && body.count >= 1 && body.count <= 6
    ? Math.floor(body.count)
    : 3;
  const focusTerritory = typeof body.focusTerritory === "string" ? body.focusTerritory.trim() : undefined;
  const focusFormat    = typeof body.focusFormat    === "string" ? body.focusFormat.trim()    : undefined;

  try {
    await connectToDatabase();

    // ── Verificar mapa seed ───────────────────────────────────────────────────
    const [mapaDoc, userDoc, freeTrialCount] = await Promise.all([
      MapaSeedModel.findOne({ userId }).lean(),
      DbUser.findById(userId).select("planStatus").lean(),
      VideoAssetModel.countDocuments({ userId }),
    ]);

    if (!mapaDoc) {
      return NextResponse.json(
        { message: "Mapa seed não encontrado. Complete o onboarding primeiro." },
        { status: 404 }
      );
    }

    // ── Verificar acesso Pro ──────────────────────────────────────────────────
    const acesso = evaluateMapaAccess({
      planStatus: userDoc?.planStatus ?? null,
      mapaDoc: mapaDoc as Parameters<typeof evaluateMapaAccess>[0]["mapaDoc"],
      freeTrialUsado: freeTrialCount > 0,
    });

    if (!acesso.podeVerPautas) {
      return NextResponse.json(
        buildPaywallResponse("pautas_bloqueadas"),
        { status: 403 }
      );
    }

    // ── Gerar pautas ──────────────────────────────────────────────────────────
    const pautasGeradas = await generatePautasFromMapa(mapaDoc.mapa, {
      count,
      focusTerritory,
      focusFormat,
    });

    // ── Persistir como CreatorContentIdea (status: active) ───────────────────
    const docsToInsert = pautasGeradas.map((p) => ({
      userId,
      status:          "active",
      source:          "gpt4o_v1",
      title:           p.title,
      angle:           p.angle,
      hook:            p.hook,
      territory:       p.territory,
      assets:          p.assets,
      suggestedFormat: p.suggestedFormat,
      tone:            p.tone,
      whyItFits:       p.whyItFits,
      scheduledFor:    null,
      postedAt:        null,
      mapContextHash:  p.mapContextHash,
      modelVersion:    p.modelVersion,
      generatedAt:     p.generatedAt,
    }));

    const inserted = await CreatorContentIdea.insertMany(docsToInsert, { ordered: false });

    logger.info(`${TAG} ${inserted.length} pautas persistidas para userId=${userId}`);

    return NextResponse.json(
      {
        pautas:     inserted.map((doc) => ({
          id:              doc._id,
          title:           doc.title,
          angle:           doc.angle,
          hook:            doc.hook,
          territory:       doc.territory,
          assets:          doc.assets,
          suggestedFormat: doc.suggestedFormat,
          tone:            doc.tone,
          whyItFits:       doc.whyItFits,
          status:          doc.status,
          generatedAt:     doc.generatedAt,
        })),
        maturidade: mapaDoc.mapa.maturidade,
        count:      inserted.length,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`${TAG} Erro ao gerar pautas para userId=${userId}:`, error);
    return NextResponse.json(
      { message: "Não foi possível gerar as pautas. Tente novamente." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}
