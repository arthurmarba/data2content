// src/app/lib/mapaSeed/enrichMapaSeedWithVideoForUser.ts
//
// Enriquece o MapaSeed de um usuário com a síntese das leituras de vídeo que
// ele escolheu publicar (publishIntent="yes" ou legado). Chamado pelo worker
// QStash enrich-mapa-video, disparado ao declarar "sim" no publish-intent.
// Operação non-fatal: nunca lança — erros são logados e ignorados.
//
// Nota sobre idempotência: o QStash entrega ao-menos-uma-vez. A reconstrução
// da síntese é determinística a partir das leituras publicadas, então uma
// entrega duplicada apenas re-roda o mesmo cross-reference (custo de LLM
// desperdiçado, sem corromper o mapa).

import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import MapaSeedModel from "@/app/models/MapaSeed";
import {
  listRecentCreatorVideoNarrativeDiagnosesForUser,
  readingFeedsNarrativeMap,
} from "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisReadService";
import { buildCreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { getMapConfirmationsSnapshot } from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";
import { enrichMapaWithVideoReadings } from "./enrichMapaWithVideoReadings";

const TAG = "[enrichMapaSeedWithVideoForUser]";
const READINGS_LIMIT = 12;

export async function enrichMapaSeedWithVideoForUser(userId: string): Promise<void> {
  try {
    await connectToDatabase();

    const mapaDoc = await MapaSeedModel.findOne({ userId });
    if (!mapaDoc) {
      logger.info(`${TAG} Sem MapaSeed para userId=${userId} — enriquecimento de vídeo ignorado.`);
      return;
    }

    // Só as leituras que o criador escolheu publicar alimentam o mapa
    // (mesma regra binária de publishIntent da síntese — Fase 2).
    const allReadings = await listRecentCreatorVideoNarrativeDiagnosesForUser({
      userId,
      limit: READINGS_LIMIT,
    });
    const publishingReadings = allReadings.filter(readingFeedsNarrativeMap);

    if (publishingReadings.length === 0) {
      logger.info(`${TAG} Nenhuma leitura publicada para userId=${userId} — ignorado.`);
      return;
    }

    const synthesis = buildCreatorStrategicProfileSynthesis({ readings: publishingReadings });
    if (synthesis.status === "empty" || synthesis.analyzedReadingsCount < 1) {
      logger.info(`${TAG} Síntese vazia para userId=${userId} — ignorado.`);
      return;
    }

    // Estabilidade do núcleo (G3): mesmo o vídeo respeita narrativa/tom confirmados.
    const confirmations = await getMapConfirmationsSnapshot(userId).catch(() => null);
    const locks = {
      narrativeLocked: confirmations?.narrative === "confirmed",
      toneLocked: confirmations?.tone === "confirmed",
    };

    const mapaEnriquecido = await enrichMapaWithVideoReadings(mapaDoc.mapa, synthesis, locks);

    mapaDoc.mapa = mapaEnriquecido;
    mapaDoc.videoEnrichedAt = new Date();
    await mapaDoc.save();

    logger.info(
      `${TAG} MapaSeed enriquecido com vídeo para userId=${userId}. Maturidade: ${mapaEnriquecido.maturidade}`,
    );
  } catch (err) {
    // Non-fatal: nunca quebra o caller (worker).
    logger.warn(`${TAG} Falha ao enriquecer MapaSeed com vídeo para userId=${userId} (ignorada):`, err);
  }
}
