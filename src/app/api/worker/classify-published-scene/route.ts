/**
 * POST /api/worker/classify-published-scene
 *
 * Confere, contra o post PUBLICADO, quais elementos do mapa daquele criador
 * apareceram — e grava os papéis canônicos em `Metric.sceneElements`.
 *
 * Recebe `{ metricId }` do QStash, no mesmo padrão de /api/worker/classify-content.
 *
 * O caminho: Metric → mapa do criador (MapaSeed, resolvido pelo registro canônico) →
 * Graph API (`media_url` fresca) → Gemini com pergunta FECHADA → papéis canônicos.
 *
 * A pergunta é fechada de propósito: em vez de "classifique este post", o prompt leva
 * os 5–8 itens do mapa daquele criador, com o rótulo que ele mesmo escreveu, e pergunta
 * quais aparecem. Mais barato, mais preciso, e é o que faz o relatório MEDIR o mapa em
 * vez de medir a legenda. Ver src/app/lib/relatorio/sceneEvaluation.ts.
 *
 * A `media_url` salva no Metric é assinada e expira em horas (dá 403), por isso é
 * rebuscada aqui a cada execução.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import { loadMapProfiles, type MapProfile } from "@/app/lib/relatorio/mapProfiles";
import {
  SCENE_EVALUATION_VERSION,
  evaluateImagesAgainstMap,
  evaluateSceneAgainstMap,
  sceneElementsUpdate,
} from "@/app/lib/relatorio/sceneEvaluation";
import { upsertPublishedContentEvidence } from "@/app/lib/scripts/publishedContentEvidence";

export const runtime = "nodejs";
export const maxDuration = 300;

const TAG = "[Worker ClassifyPublishedScene]";

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const receiver =
  currentSigningKey && nextSigningKey
    ? new Receiver({ currentSigningKey, nextSigningKey })
    : null;

const GRAPH_VERSION = process.env.INSTAGRAM_API_VERSION || "v20.0";

/** Rebusca a mídia fresca. A URL salva no Metric expira. */
async function freshMedia(
  mediaId: string,
  token: string,
): Promise<{ mediaType: string | null; mediaUrl: string | null; imageUrls: string[] }> {
  const fields = encodeURIComponent(
    "id,media_type,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}",
  );
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}?fields=${fields}&access_token=${token}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return { mediaType: null, mediaUrl: null, imageUrls: [] };
    const json = (await response.json()) as {
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      children?: { data?: Array<{ media_type?: string; media_url?: string; thumbnail_url?: string }> };
      error?: unknown;
    };
    if (json.error) return { mediaType: null, mediaUrl: null, imageUrls: [] };
    const imageUrls = json.media_type === "CAROUSEL_ALBUM"
      ? (json.children?.data ?? []).flatMap((child) => {
          const url = child.media_type === "VIDEO"
            ? child.thumbnail_url || null
            : child.media_url || child.thumbnail_url || null;
          return url ? [url] : [];
        })
      : json.media_type === "IMAGE"
        ? [json.media_url || json.thumbnail_url].filter((value): value is string => Boolean(value))
        : [];
    return {
      mediaType: typeof json.media_type === "string" ? json.media_type : null,
      mediaUrl: typeof json.media_url === "string" ? json.media_url : null,
      imageUrls,
    };
  } catch {
    return { mediaType: null, mediaUrl: null, imageUrls: [] };
  }
}

async function handle(metricId: string): Promise<NextResponse> {
  if (!mongoose.isValidObjectId(metricId)) {
    return NextResponse.json({ message: "metricId inválido." }, { status: 400 });
  }

  await connectToDatabase();
  const metric = await MetricModel.findById(metricId)
    .select("user instagramMediaId sceneElements stats")
    .exec();

  if (!metric) {
    return NextResponse.json({ message: "Métrica não encontrada." }, { status: 200 });
  }
  // Idempotente por versão: reprocessar só acontece quando a versão muda, e aí é
  // uma decisão explícita.
  if (metric.sceneElements?.version === SCENE_EVALUATION_VERSION) {
    return NextResponse.json({ message: "Cena já avaliada nesta versão." });
  }
  if (!metric.instagramMediaId) {
    return NextResponse.json({ message: "Post sem instagramMediaId — nada a ler." });
  }

  const creatorId = String(metric.user);
  const profiles = await loadMapProfiles([creatorId]);
  const profile: MapProfile = profiles.get(creatorId) ?? {
    creatorId,
    territoryIds: [],
    primaryTerritoryId: null,
    narrative: null,
    narrativeConfirmed: false,
    assets: [],
    toneIds: [],
    subjects: [],
    misplacedTerritoryLabels: [],
    maturity: null,
  };
  if (!profiles.has(creatorId)) {
    logger.info(`${TAG} criador ${creatorId} sem mapa; executando extração visual aberta.`);
  }

  const user = await UserModel.findById(metric.user).select("instagramAccessToken").lean<{
    instagramAccessToken?: string;
  }>();
  const token = user?.instagramAccessToken;
  if (!token) {
    logger.warn(`${TAG} criador ${creatorId} sem token — impossível baixar a mídia.`);
    return NextResponse.json({ message: "Criador sem token do Instagram." });
  }

  const media = await freshMedia(metric.instagramMediaId, token);
  const outcome = media.mediaType === "VIDEO" && media.mediaUrl
    ? await evaluateSceneAgainstMap({
        mediaUrl: media.mediaUrl,
        durationSeconds:
          typeof metric.stats?.video_duration_seconds === "number"
            ? metric.stats.video_duration_seconds
            : null,
        profile,
      })
    : ["IMAGE", "CAROUSEL_ALBUM"].includes(media.mediaType || "") && media.imageUrls.length
      ? await evaluateImagesAgainstMap({ mediaUrls: media.imageUrls, profile })
      : null;

  if (!outcome) {
    return NextResponse.json({ message: "Post sem mídia compatível para leitura visual." });
  }

  if (!outcome.ok) {
    logger.warn(`${TAG} ${metricId}: ${outcome.reason}`);
    // 503 devolve a tarefa para a fila do QStash; 200 encerra sem reenfileirar.
    return NextResponse.json(
      { message: outcome.reason, retryable: outcome.retryable },
      { status: outcome.retryable ? 503 : 200 },
    );
  }

  // A transcrição integral e a timeline ficam num documento privado separado.
  // Ela é persistida ANTES de marcar a cena como v4: se esta escrita falhar, o QStash
  // repete o job e não deixa um Reel falsamente "completo" sem o corpus integral.
  try {
    await upsertPublishedContentEvidence({ metricId, scene: outcome.result });
  } catch (evidenceError) {
    logger.warn(`${TAG} ${metricId}: evidência publicada não foi persistida; job será repetido.`, {
      error: evidenceError instanceof Error ? evidenceError.message : String(evidenceError || ""),
    });
    return NextResponse.json(
      { message: "Falha ao persistir a evidência integral.", retryable: true },
      { status: 503 },
    );
  }

  await MetricModel.updateOne(
    { _id: metric._id },
    { $set: { sceneElements: sceneElementsUpdate(outcome.result) } },
  );

  logger.info(
    `${TAG} ${metricId}: ${outcome.result.assetRoleIds.join(", ") || "(nenhum asset)"} · ` +
      `tom ${outcome.result.toneIds.join(", ") || "—"} · ` +
      `${outcome.result.placeId ?? "lugar?"} · ${outcome.result.subjects.join(" | ") || "sem tema"} · ` +
      `${media.mediaType ?? "mídia"}` +
      `${outcome.result.offMap ? " · FORA DO MAPA" : ""}`,
  );

  return NextResponse.json({
    ok: true,
    evidence: {
      version: outcome.result.version,
      provider: outcome.result.provider,
      subjects: outcome.result.subjects.length,
      scenes: outcome.result.sceneTimeline.length,
      transcriptAvailable: Boolean(outcome.result.transcript),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();

    // CRON_SECRET permite disparo manual (backfill pelo operador) sem QStash.
    const secret = process.env.CRON_SECRET;
    const authorized =
      (secret && request.headers.get("authorization") === `Bearer ${secret}`) ||
      process.env.NODE_ENV === "development";

    if (!authorized) {
      if (!receiver) {
        logger.error(`${TAG} signing keys do QStash ausentes — worker desabilitado.`);
        return new NextResponse("QStash signing keys not configured", { status: 500 });
      }
      const signature = request.headers.get("upstash-signature");
      if (!signature) return new NextResponse("Signature header missing", { status: 401 });
      const isValid = await receiver.verify({ signature, body: bodyText }).catch(() => false);
      if (!isValid) return new NextResponse("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(bodyText || "{}") as { metricId?: string };
    if (!body.metricId) {
      return NextResponse.json({ message: "metricId ausente." }, { status: 400 });
    }
    return await handle(body.metricId);
  } catch (error) {
    logger.error(`${TAG} falha:`, error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Worker de avaliação de cena contra o mapa do criador ativo.",
    versao: SCENE_EVALUATION_VERSION,
  });
}
