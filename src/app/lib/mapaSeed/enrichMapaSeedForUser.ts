// src/app/lib/mapaSeed/enrichMapaSeedForUser.ts
//
// Enriquece o MapaSeed de um usuário com seus posts recentes do Instagram.
// Chamado pelo worker QStash após sync de dados do Instagram.
// Operação non-fatal: nunca lança — erros são logados e ignorados.

import { logger } from "@/app/lib/logger";
import { getInstagramConnectionDetails } from "@/app/lib/instagram/db/userActions";
import { fetchInstagramMedia } from "@/app/lib/instagram/api/fetchers";
import { analyzeInstagramPosts } from "./analyzeInstagramPosts";
import { enrichMapaWithInstagram } from "./enrichMapaWithInstagram";
import MapaSeedModel from "@/app/models/MapaSeed";
import { connectToDatabase } from "@/app/lib/mongoose";

const TAG = "[enrichMapaSeedForUser]";
const MAX_POSTS = 30;
// Só re-enriquece se o mapa foi criado/atualizado há mais de X horas,
// evitando re-processamento desnecessário em reconexões rápidas.
const MIN_HOURS_BETWEEN_ENRICHMENTS = 12;

export async function enrichMapaSeedWithInstagram(userId: string): Promise<void> {
  try {
    await connectToDatabase();

    const mapaDoc = await MapaSeedModel.findOne({ userId });
    if (!mapaDoc) {
      logger.info(`${TAG} Sem MapaSeed para userId=${userId} — enriquecimento ignorado.`);
      return;
    }

    // Throttle: evitar re-enriquecimento se já foi feito recentemente
    const updatedAt: Date | undefined = mapaDoc.updatedAt instanceof Date ? mapaDoc.updatedAt : undefined;
    if (updatedAt && mapaDoc.mapa.maturidade === "instagram_enriched") {
      const horasSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
      if (horasSinceUpdate < MIN_HOURS_BETWEEN_ENRICHMENTS) {
        logger.info(
          `${TAG} MapaSeed já enriquecido há ${horasSinceUpdate.toFixed(1)}h para userId=${userId} — ignorado.`,
        );
        return;
      }
    }

    const igConnection = await getInstagramConnectionDetails(userId);
    if (!igConnection?.accessToken || !igConnection?.accountId) {
      logger.warn(`${TAG} Instagram não conectado para userId=${userId} — enriquecimento ignorado.`);
      return;
    }

    const mediaResult = await fetchInstagramMedia(igConnection.accountId, igConnection.accessToken);
    if (!mediaResult.success || !mediaResult.data?.length) {
      logger.warn(
        `${TAG} Sem posts para userId=${userId}: ${mediaResult.error ?? "lista vazia"} — enriquecimento ignorado.`,
      );
      return;
    }

    const posts = mediaResult.data.slice(0, MAX_POSTS);
    logger.info(`${TAG} ${posts.length} posts recuperados para userId=${userId}.`);

    const padroes = await analyzeInstagramPosts(posts);
    const mapaEnriquecido = await enrichMapaWithInstagram(mapaDoc.mapa, padroes);

    mapaDoc.mapa = mapaEnriquecido;
    await mapaDoc.save();

    logger.info(
      `${TAG} MapaSeed enriquecido para userId=${userId}. Maturidade: ${mapaEnriquecido.maturidade}`,
    );
  } catch (err) {
    // Non-fatal: nunca quebra o caller
    logger.warn(`${TAG} Falha ao enriquecer MapaSeed para userId=${userId} (ignorada):`, err);
  }
}
