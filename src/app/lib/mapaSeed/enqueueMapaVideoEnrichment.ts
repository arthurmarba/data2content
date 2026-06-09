// src/app/lib/mapaSeed/enqueueMapaVideoEnrichment.ts
//
// Enfileira (via QStash) o enriquecimento do MapaSeed a partir das leituras de
// vídeo publicadas. Disparado ao declarar publishIntent="yes". Async por design
// — o enriquecimento é uma chamada de LLM (~segundos) que não deve bloquear a
// resposta do publish-intent.
//
// Degradação graciosa: se QSTASH_TOKEN ou MAPA_VIDEO_ENRICH_WORKER_URL não
// estiverem configurados (ex.: ambiente local), apenas loga e retorna — o
// publish-intent continua funcionando normalmente.

import { Client } from "@upstash/qstash";
import { logger } from "@/app/lib/logger";

const TAG = "[enqueueMapaVideoEnrichment]";

const qstashToken = process.env.QSTASH_TOKEN;
let qstashClient: Client | null = null;
if (qstashToken) {
  try {
    qstashClient = new Client({ token: qstashToken });
  } catch (err) {
    logger.error(`${TAG} Falha ao inicializar cliente QStash:`, err);
  }
}

export async function enqueueMapaVideoEnrichment(userId: string): Promise<void> {
  const workerUrl = process.env.MAPA_VIDEO_ENRICH_WORKER_URL;

  if (!qstashClient || !workerUrl) {
    logger.warn(
      `${TAG} QStash não configurado (token=${!!qstashClient}, url=${!!workerUrl}). Enriquecimento de vídeo não será enfileirado para userId=${userId}.`,
    );
    return;
  }

  try {
    const response = await qstashClient.publishJSON({
      url: workerUrl,
      body: { userId },
    });
    logger.info(
      `${TAG} Job de enriquecimento de vídeo enfileirado para userId=${userId}. Message ID: ${response.messageId}`,
    );
  } catch (err) {
    // Non-fatal: o mapa pode ser enriquecido numa próxima publicação.
    logger.error(`${TAG} Falha ao enfileirar job QStash para userId=${userId} (ignorada):`, err);
  }
}
