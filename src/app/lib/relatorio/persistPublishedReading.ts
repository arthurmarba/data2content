/**
 * Grava uma leitura publicada — venha ela do worker em tempo real ou da coleta do lote.
 *
 * A ordem importa e é a mesma dos dois caminhos: a evidência integral primeiro, porque
 * é ela que sustenta roteiros e relatório; só depois o resumo em `Metric.sceneElements`,
 * que é o que o fechamento semanal congela. Se a evidência falhar, nada é marcado como
 * lido e o job repete — melhor repetir do que ficar com um post "completo" e vazio.
 */
import MetricModel from "@/app/models/Metric";
import { logger } from "@/app/lib/logger";
import { sceneElementsUpdate, type SceneEvaluation } from "./sceneEvaluation";
import { upsertPublishedContentEvidence } from "@/app/lib/scripts/publishedContentEvidence";
import { enqueueScriptEvidenceMaintenance } from "@/app/lib/scripts/scriptEvidenceQueue";
import { enqueueProfileRefresh, enqueueInstagramMapEnrichment } from "@/app/lib/creatorWeeklyReport/queue";

const TAG = "[relatorio][persistPublishedReading]";

export async function persistPublishedReading(params: {
  metricId: string;
  creatorId: string;
  scene: SceneEvaluation;
}): Promise<void> {
  const { metricId, creatorId, scene } = params;

  // Antes do resumo: se esta escrita falhar, o chamador repete e não deixa um post
  // falsamente "lido" sem o corpus integral.
  await upsertPublishedContentEvidence({ metricId, scene });

  await MetricModel.updateOne({ _id: metricId }, { $set: { sceneElements: sceneElementsUpdate(scene) } });

  // Manutenções em fila: nenhuma delas pode derrubar a gravação que já aconteceu.
  await enqueueScriptEvidenceMaintenance(creatorId).catch((error) =>
    logger.warn(`${TAG} fila de evidências de roteiro falhou para ${creatorId}`, error));
  await enqueueProfileRefresh(creatorId).catch((error) =>
    logger.warn(`${TAG} fila do perfil falhou para ${creatorId}`, error));
  await enqueueInstagramMapEnrichment(creatorId).catch((error) =>
    logger.warn(`${TAG} fila do mapa falhou para ${creatorId}`, error));
}
