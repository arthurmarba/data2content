// src/app/api/onboarding/video-analyze/route.ts
// POST /api/onboarding/video-analyze
//
// Recebe título + descrição de um vídeo, analisa coerência com o mapa do criador
// e salva o asset com estado Stream A = "pending".
//
// Regra de acesso:
//   - 1 análise gratuita por usuário (isFreeTrial = true)
//   - Análises adicionais exigem assinatura (verificado via planGuard)
//
// Body: { titulo: string, descricao?: string, videoUrl?: string }
// Resposta: { assetId, coerencia, streamA }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { analyzeVideoCoherence } from "@/app/lib/mapaSeed/analyzeVideoCoherence";
import MapaSeedModel from "@/app/models/MapaSeed";
import VideoAssetModel from "@/app/models/VideoAsset";
import DbUser from "@/app/models/User";
import { evaluateMapaAccess, buildPaywallResponse } from "@/app/lib/mapaSeed/mapaAccessGuard";
import type { VideoInput } from "@/app/lib/mapaSeed/analyzeVideoCoherence";

// ─── Validação ────────────────────────────────────────────────────────────────

function parseBody(
  body: unknown
): { ok: true; video: VideoInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.titulo !== "string" || !b.titulo.trim()) {
    return { ok: false, error: "Campo 'titulo' é obrigatório." };
  }

  return {
    ok: true,
    video: {
      titulo:   b.titulo.trim().slice(0, 300),
      descricao: typeof b.descricao === "string" ? b.descricao.trim().slice(0, 1000) : null,
      videoUrl:  typeof b.videoUrl  === "string" ? b.videoUrl.trim().slice(0, 500)   : null,
    },
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const TAG = "[API /onboarding/video-analyze]";

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: "Body inválido." }, { status: 400 });
  }

  const parsed = parseBody(rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  try {
    await connectToDatabase();

    // ── 1. Verificar mapa seed existente ────────────────────────────────────
    const mapaDoc = await MapaSeedModel.findOne({ userId }).lean();

    if (!mapaDoc) {
      return NextResponse.json(
        { message: "Mapa seed não encontrado. Complete o onboarding primeiro." },
        { status: 404 }
      );
    }

    // ── 2. Verificar acesso via mapaAccessGuard ──────────────────────────────
    const [userDoc, existingAssetsCount] = await Promise.all([
      DbUser.findById(userId).select("planStatus").lean(),
      VideoAssetModel.countDocuments({ userId }),
    ]);

    const isFreeTrial = existingAssetsCount === 0;

    const acesso = evaluateMapaAccess({
      planStatus: userDoc?.planStatus ?? null,
      mapaDoc: mapaDoc as Parameters<typeof evaluateMapaAccess>[0]["mapaDoc"],
      freeTrialUsado: existingAssetsCount > 0,
    });

    if (!acesso.podeAnalisarVideo) {
      return NextResponse.json(
        buildPaywallResponse("free_trial_usado"),
        { status: 403 }
      );
    }

    // ── 3. Analisar coerência — gpt-4o · medium ──────────────────────────────
    const coerencia = await analyzeVideoCoherence(mapaDoc.mapa, parsed.video);

    // ── 4. Salvar asset com Stream A = pending ───────────────────────────────
    const asset = await VideoAssetModel.create({
      userId,
      videoUrl:    parsed.video.videoUrl,
      titulo:      parsed.video.titulo,
      descricao:   parsed.video.descricao,
      coerencia,
      streamA: { estado: "pending", respondidoEm: null },
      isFreeTrial,
    });

    logger.info(
      `${TAG} Asset criado _id=${asset._id} | conecta=${coerencia.conecta} | freeTrial=${isFreeTrial}`
    );

    return NextResponse.json(
      {
        assetId:  asset._id,
        coerencia,
        streamA:  asset.streamA,
        isFreeTrial,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`${TAG} Erro ao analisar vídeo para userId=${userId}:`, error);
    return NextResponse.json(
      { message: "Não foi possível analisar o vídeo. Tente novamente." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}
