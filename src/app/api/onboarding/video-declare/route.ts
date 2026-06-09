// src/app/api/onboarding/video-declare/route.ts
// POST /api/onboarding/video-declare
//
// Stream A — declaração de publicação do criador após análise de coerência.
//
// Body: { assetId: string, decisao: "published" | "discarded" | "pending" }
//
// Resultado por decisão:
//   published → mapa atualizado com maturidade "video_enriched", fonte inclui "video"
//   discarded → asset marcado, sinal descartado, mapa não alterado
//   pending   → mantém estado pendente (criador ainda não decidiu)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import VideoAssetModel from "@/app/models/VideoAsset";
import MapaSeedModel from "@/app/models/MapaSeed";
import type { StreamAEstado } from "@/app/models/VideoAsset";
import type { MapaFonte } from "@/app/models/MapaSeed";

// ─── Validação ────────────────────────────────────────────────────────────────

const DECISOES_VALIDAS: StreamAEstado[] = ["published", "discarded", "pending"];

function parseBody(
  body: unknown
): { ok: true; assetId: string; decisao: StreamAEstado } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.assetId !== "string" || !Types.ObjectId.isValid(b.assetId)) {
    return { ok: false, error: "Campo 'assetId' inválido." };
  }

  if (!DECISOES_VALIDAS.includes(b.decisao as StreamAEstado)) {
    return {
      ok: false,
      error: `Campo 'decisao' inválido. Use: ${DECISOES_VALIDAS.join(", ")}.`,
    };
  }

  return { ok: true, assetId: b.assetId, decisao: b.decisao as StreamAEstado };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const TAG = "[API /onboarding/video-declare]";

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

  const { assetId, decisao } = parsed;

  try {
    await connectToDatabase();

    // ── 1. Verificar ownership do asset ──────────────────────────────────────
    const asset = await VideoAssetModel.findOne({ _id: assetId, userId });

    if (!asset) {
      return NextResponse.json(
        { message: "Asset não encontrado." },
        { status: 404 }
      );
    }

    // ── 2. Atualizar Stream A ────────────────────────────────────────────────
    asset.streamA.estado = decisao;
    asset.streamA.respondidoEm = decisao !== "pending" ? new Date() : null;
    await asset.save();

    logger.info(`${TAG} Stream A: asset=${assetId} → ${decisao}`);

    // ── 3. Se "published": enriquecer o mapa ─────────────────────────────────
    if (decisao === "published") {
      const mapaDoc = await MapaSeedModel.findOne({ userId });

      if (mapaDoc) {
        const novaFonte = [
          ...new Set([...mapaDoc.mapa.fonte, "video"]),
        ] as MapaFonte[];

        mapaDoc.mapa.maturidade = "video_enriched";
        mapaDoc.mapa.fonte = novaFonte;

        // Incorporar assets identificados no vídeo (se conecta)
        if (asset.coerencia.conecta && asset.coerencia.pontos_de_conexao.length > 0) {
          const novosAssets = asset.coerencia.pontos_de_conexao.filter(
            (p) => !mapaDoc.mapa.assets.includes(p)
          );
          if (novosAssets.length > 0) {
            mapaDoc.mapa.assets = [...mapaDoc.mapa.assets, ...novosAssets].slice(0, 6);
          }
        }

        // Marcar como modificado (campo aninhado)
        mapaDoc.markModified("mapa");
        await mapaDoc.save();

        logger.info(
          `${TAG} Mapa atualizado para maturidade "video_enriched". userId=${userId}`
        );
      }
    }

    // ── 4. Resposta ──────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        assetId,
        decisao,
        mapaAtualizado: decisao === "published",
        mensagem: {
          published: "Mapa atualizado com o seu vídeo.",
          discarded: "Entendido. O vídeo não foi registrado no seu mapa.",
          pending:   "Deixado como pendente. Você pode decidir depois.",
        }[decisao],
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`${TAG} Erro ao registrar declaração para userId=${userId}:`, error);
    return NextResponse.json(
      { message: "Não foi possível registrar a decisão. Tente novamente." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}
