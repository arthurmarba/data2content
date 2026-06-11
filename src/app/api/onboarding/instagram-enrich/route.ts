// src/app/api/onboarding/instagram-enrich/route.ts
// POST /api/onboarding/instagram-enrich
//
// Fluxo:
//   1. Verifica se o usuário tem mapa seed (Fase 1 deve ter sido feita)
//   2. Busca as credenciais do Instagram do usuário
//   3. Busca até 30 posts recentes via Graph API
//   4. Analisa padrões (gpt-4o · medium)
//   5. Enriquece o mapa seed (gpt-4o · high)
//   6. Salva mapa enriquecido e retorna
//
// Resposta:
//   { mapa: IMapaData, padroes: InstagramPatterns, jaConectado: boolean }

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getInstagramConnectionDetails } from "@/app/lib/instagram/db/userActions";
import { fetchInstagramMedia } from "@/app/lib/instagram/api/fetchers";
import { analyzeInstagramPosts } from "@/app/lib/mapaSeed/analyzeInstagramPosts";
import { enrichMapaWithInstagram } from "@/app/lib/mapaSeed/enrichMapaWithInstagram";
import MapaSeedModel from "@/app/models/MapaSeed";

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST() {
  const TAG = "[API /onboarding/instagram-enrich]";

  // Auth
  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    // ── 1. Verificar mapa seed existente ────────────────────────────────────
    const mapaDoc = await MapaSeedModel.findOne({ userId });

    if (!mapaDoc) {
      return NextResponse.json(
        {
          message:
            "Mapa seed não encontrado. Complete o onboarding antes de conectar o Instagram.",
        },
        { status: 404 }
      );
    }

    // ── 2. Buscar credenciais do Instagram ──────────────────────────────────
    const igConnection = await getInstagramConnectionDetails(userId);

    if (!igConnection?.accessToken || !igConnection?.accountId) {
      logger.warn(`${TAG} Instagram não conectado para userId=${userId}`);
      return NextResponse.json(
        {
          message: "Instagram não conectado.",
          jaConectado: false,
        },
        { status: 422 }
      );
    }

    // ── 3. Buscar posts recentes ────────────────────────────────────────────
    logger.info(`${TAG} Buscando posts do Instagram para userId=${userId}...`);

    const mediaResult = await fetchInstagramMedia(
      igConnection.accountId,
      igConnection.accessToken
    );

    if (!mediaResult.success || !mediaResult.data?.length) {
      logger.warn(
        `${TAG} Sem posts disponíveis para userId=${userId}: ${mediaResult.error ?? "lista vazia"}`
      );
      // Continua com mapa seed sem enriquecimento
      return NextResponse.json(
        {
          message: "Sem posts no Instagram para analisar.",
          mapa: mapaDoc.mapa,
          padroes: null,
          jaConectado: true,
        },
        { status: 200 }
      );
    }

    const posts = mediaResult.data.slice(0, 30);
    logger.info(`${TAG} ${posts.length} posts recuperados.`);

    // ── 4. Analisar padrões — gpt-4o · medium ──────────────────────────────
    const padroes = await analyzeInstagramPosts(posts);

    // ── 5. Enriquecer mapa — gpt-4o · high ─────────────────────────────────
    const mapaEnriquecido = await enrichMapaWithInstagram(mapaDoc.mapa, padroes);

    // ── 6. Salvar mapa enriquecido ──────────────────────────────────────────
    mapaDoc.mapa = mapaEnriquecido;
    await mapaDoc.save();

    logger.info(
      `${TAG} Mapa enriquecido salvo para userId=${userId}. Maturidade: ${mapaEnriquecido.maturidade}`
    );

    return NextResponse.json(
      {
        mapa: mapaEnriquecido,
        padroes,
        jaConectado: true,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`${TAG} Erro ao enriquecer mapa com Instagram para userId=${userId}:`, error);
    return NextResponse.json(
      { message: "Não foi possível analisar o Instagram. Tente novamente." },
      { status: 500 }
    );
  }
}

// Bloquear outros métodos
export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}
