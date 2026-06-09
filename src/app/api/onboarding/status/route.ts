// src/app/api/onboarding/status/route.ts
// GET /api/onboarding/status
//
// Endpoint central que o frontend usa para saber em que estado o criador está
// e o que deve mostrar/bloquear. É a fonte de verdade para o estado machine
// do onboarding e das regras de acesso.
//
// Resposta:
// {
//   mapa: IMapaData | null,
//   leituraInaugural: ILeituraInaugural | null,
//   maturidade: MapaMaturidade | null,
//   acesso: MapaAccessResult,
//   proximoPasso: ProximoPasso,
// }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import MapaSeedModel from "@/app/models/MapaSeed";
import VideoAssetModel from "@/app/models/VideoAsset";
import DbUser from "@/app/models/User";
import { evaluateMapaAccess } from "@/app/lib/mapaSeed/mapaAccessGuard";

// ─── Tipo do próximo passo ────────────────────────────────────────────────────

export type ProximoPasso =
  | "completar_onboarding"   // ainda não fez o onboarding
  | "conectar_instagram"     // mapa seed existe, Instagram não conectado
  | "analisar_video"         // sem Instagram, pode usar o teste de vídeo
  | "aguardar_stream_a"      // vídeo analisado, aguarda declaração
  | "ver_mapa"               // mapa enriquecido disponível
  | "assinar_pro";           // free trial usado, sem Pro

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const TAG = "[API GET /onboarding/status]";

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    // ── Buscar dados em paralelo ──────────────────────────────────────────────
    const [mapaDoc, userDoc, videoAssetsCount, freeTrialAsset] = await Promise.all([
      MapaSeedModel.findOne({ userId }).lean(),
      DbUser.findById(userId).select("planStatus instagramAccountId").lean(),
      VideoAssetModel.countDocuments({ userId }),
      VideoAssetModel.findOne({ userId, isFreeTrial: true }).select("streamA").lean(),
    ]);

    const planStatus = userDoc?.planStatus ?? null;
    const temInstagram = !!userDoc?.instagramAccountId;
    const freeTrialUsado = videoAssetsCount > 0;
    const freeTrialPendente =
      freeTrialAsset?.streamA?.estado === "pending";

    // ── Avaliar acesso ────────────────────────────────────────────────────────
    const acesso = evaluateMapaAccess({
      planStatus,
      mapaDoc: mapaDoc as Parameters<typeof evaluateMapaAccess>[0]["mapaDoc"],
      freeTrialUsado,
    });

    // ── Calcular próximo passo ────────────────────────────────────────────────
    let proximoPasso: ProximoPasso;

    if (!mapaDoc) {
      proximoPasso = "completar_onboarding";
    } else if (freeTrialPendente) {
      // Vídeo analisado aguardando declaração Stream A
      proximoPasso = "aguardar_stream_a";
    } else if (
      mapaDoc.mapa.maturidade === "seed" &&
      !temInstagram &&
      !freeTrialUsado
    ) {
      // Tem mapa seed mas sem Instagram e sem vídeo testado
      proximoPasso = "analisar_video";
    } else if (mapaDoc.mapa.maturidade === "seed" && !temInstagram) {
      // Mapa seed, sem Instagram, free trial usado
      proximoPasso = acesso.isPro ? "ver_mapa" : "assinar_pro";
    } else if (mapaDoc.mapa.maturidade === "seed" && temInstagram) {
      // Tem mapa seed e Instagram mas ainda não enriqueceu
      proximoPasso = "conectar_instagram";
    } else {
      // Mapa enriquecido — principal estado operacional
      proximoPasso = "ver_mapa";
    }

    logger.debug(
      `${TAG} userId=${userId} maturidade=${mapaDoc?.mapa?.maturidade ?? "null"} proximoPasso=${proximoPasso}`
    );

    return NextResponse.json(
      {
        mapa:             mapaDoc?.mapa             ?? null,
        leituraInaugural: mapaDoc?.leituraInaugural ?? null,
        maturidade:       mapaDoc?.mapa?.maturidade ?? null,
        acesso,
        proximoPasso,
        meta: {
          temInstagram,
          freeTrialUsado,
          freeTrialPendente,
          videoAssetsCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`${TAG} Erro ao buscar status para userId=${userId}:`, error);
    return NextResponse.json(
      { message: "Erro interno ao buscar status." },
      { status: 500 }
    );
  }
}
