/**
 * Leitura publicada em lote: metade do preço pelo mesmo pedido.
 *
 * O desenho inteiro está em `docs/plano-lote-gemini.md`. As três regras que não podem
 * ser quebradas aqui:
 *
 * 1. **Ninguém vai ao provedor sem operação registrada.** Cada item é reservado antes
 *    de o job existir; só depois recebe o nome do job. Reserva sem job é rejeitada e
 *    volta para a fila; job sem reserva nunca acontece.
 * 2. **O arquivo da Files API vive até o job terminar.** Apagar cedo foi o que matou a
 *    prova de 14/09 (`code 7 · caller does not have permission`).
 * 3. **O pedido é idêntico ao do tempo real.** Mesmo prompt, mesma configuração — o
 *    lote é desconto de entrega, não versão barata da leitura.
 */
import { randomUUID } from "node:crypto";
import { GoogleGenAI, createPartFromUri, type ThinkingLevel } from "@google/genai";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import BatchJob from "@/app/models/GeminiBatchJob";
import Operation from "@/app/models/GeminiOperation";
import {
  reserveBatchOperation, settleBatchOperation, rejectBatchOperation,
  governanceHash, GeminiGovernanceError, type Reserva,
} from "@/app/lib/llm/geminiGovernance";
import { loadMapProfiles, type MapProfile } from "./mapProfiles";
import { freshPublishedMedia } from "./publishedMedia";
import {
  buildPrompt, uploadVideo, parseSceneEvaluation, salvageSceneEvaluation,
  SCENE_MAX_OUTPUT_TOKENS, SCENE_EVALUATION_VERSION,
} from "./sceneEvaluation";
import { LEGACY_SCENE_FORMAT } from "./compactSceneFormat";
import { findPendingReadingBatch, acquireReading, markBatched, releaseBatched, deferReading } from "./contentReadingState";
import { persistPublishedReading } from "./persistPublishedReading";
import { readingRevision } from "./readingRevision";

const TAG = "[relatorio][lote]";

/** Teto por job: o envio baixa e sobe vídeo por vídeo e roda dentro de uma função. */
const ITENS_POR_JOB = Number(process.env.GEMINI_BATCH_MAX_ITENS ?? 25);
/** O provedor expira o job em 48 h; os arquivos duram o mesmo tanto. */
const PRAZO_MS = 48 * 3600 * 1000;
const MODELO = process.env.GEMINI_CENA_MODEL || "gemini-2.5-flash";

export type ModoLote = "off" | "backlog" | "on";
export function modoLote(): ModoLote {
  const valor = (process.env.GEMINI_BATCH_READINGS ?? "off").trim().toLowerCase();
  return valor === "on" || valor === "backlog" ? valor : "off";
}

function configuracaoDoPedido(system: string) {
  return {
    systemInstruction: system,
    // Mesma regra do tempo real: orçamento numérico só no 2.5, nível nos modelos 3.x.
    thinkingConfig: MODELO.startsWith("gemini-2.") ? { thinkingBudget: 0 } : { thinkingLevel: "LOW" as ThinkingLevel },
    responseMimeType: "application/json",
    temperature: 0,
    maxOutputTokens: SCENE_MAX_OUTPUT_TOKENS,
  };
}

/** Só REEL/VIDEO vai a lote nesta fase: foto e carrossel seguem em tempo real. */
function selecionarQuery(modo: ModoLote, ids: Types.ObjectId[]) {
  const agora = Date.now();
  return {
    user: { $in: ids },
    postDate: modo === "backlog"
      // No modo de atraso, só o que já passou de 3 dias — o recente continua imediato.
      ? { $gte: new Date(agora - 90 * 86400000), $lte: new Date(agora - 3 * 86400000) }
      : { $gte: new Date(agora - 90 * 86400000) },
    classificationStatus: "completed",
    instagramMediaId: { $nin: [null, ""] },
    type: { $in: ["REEL", "VIDEO"] },
  };
}

export async function enviarLoteDeLeituras(assinantes: Types.ObjectId[]): Promise<{ enviados: number; job: string | null; pulados: number }> {
  const modo = modoLote();
  if (modo === "off") return { enviados: 0, job: null, pulados: 0 };
  await connectToDatabase();

  const candidatos = await findPendingReadingBatch(selecionarQuery(modo, assinantes), SCENE_EVALUATION_VERSION, ITENS_POR_JOB);
  if (!candidatos.length) return { enviados: 0, job: null, pulados: 0 };

  const perfis = await loadMapProfiles([...new Set(candidatos.map((m: any) => String(m.user)))]);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "" });
  const provisorio = `sending:${randomUUID()}`;

  type Preparado = { metricId: string; creatorId: string; lease: string; reserva: Reserva; fileName: string; pedido: any; profile: MapProfile };
  const preparados: Preparado[] = [];
  let pulados = 0;

  for (const metric of candidatos as any[]) {
    const metricId = String(metric._id);
    const creatorId = String(metric.user);
    const profile = perfis.get(creatorId);
    if (!profile) { pulados++; continue; }

    const lease = await acquireReading(metricId, readingRevision(metric.type));
    if (!lease) { pulados++; continue; }

    try {
      const user = await UserModel.findById(creatorId).select("instagramAccessToken").lean<{ instagramAccessToken?: string }>();
      if (!user?.instagramAccessToken) throw new Error("Criador sem token do Instagram.");
      const media = await freshPublishedMedia(metric.instagramMediaId, user.instagramAccessToken);
      if (media.mediaType !== "VIDEO" || !media.mediaUrl) throw new Error("Post sem mídia compatível para leitura visual.");

      const resposta = await fetch(media.mediaUrl, { signal: AbortSignal.timeout(60000) });
      if (!resposta.ok) throw new Error(`Download do vídeo falhou: HTTP ${resposta.status}.`);
      const bytes = Buffer.from(await resposta.arrayBuffer());

      // Sempre pela Files API: vídeo embutido no job não é documentado e estoura a função.
      const arquivo = await uploadVideo(ai, bytes, "video/mp4");
      const prompt = buildPrompt(profile);
      const pedido = {
        contents: [{ role: "user", parts: [
          { text: prompt.user }, { text: prompt.format },
          createPartFromUri(arquivo.uri!, arquivo.mimeType ?? "video/mp4"),
        ] }],
        config: configuracaoDoPedido(prompt.system),
      };

      // Reserva ANTES do job existir: nada chega ao provedor sem operação registrada.
      const reserva = await reserveBatchOperation(
        ai,
        { model: MODELO, contents: pedido.contents as any, config: pedido.config as any },
        "cena",
        {
          creatorId, contentKey: `published:${metricId}`, fingerprint: governanceHash(profile),
          responseFormat: LEGACY_SCENE_FORMAT, durationSeconds: metric.stats?.video_duration_seconds ?? null,
        },
        provisorio,
      );
      preparados.push({ metricId, creatorId, lease: lease.token, reserva, fileName: arquivo.name!, pedido, profile });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Falha ao preparar item do lote";
      // Preparo é diferente de leitura: aqui ninguém pagou nada e o post continua
      // legível. Adia e tenta de novo — marcar como falha de leitura chegou a
      // aposentar post bom no primeiro ciclo (18/09/2026).
      const espera = /HTTP 4\d\d|rate|limit/i.test(mensagem) ? 60 * 60000 : 30 * 60000;
      await deferReading(metricId, lease.token, "preparo_do_lote", espera);
      logger.warn(`${TAG} item ${metricId} adiado: ${mensagem.slice(0, 160)}`);
      pulados++;
    }
  }

  if (!preparados.length) return { enviados: 0, job: null, pulados };

  let job: any;
  try {
    job = await ai.batches.create({
      model: MODELO,
      src: preparados.map(item => item.pedido) as any,
      config: { displayName: `leitura-cena-${new Date().toISOString().slice(0, 16)}` },
    });
  } catch (erro) {
    // Job não nasceu: devolve tudo para a fila e não deixa reserva pendurada.
    const mensagem = erro instanceof Error ? erro.message : "Falha ao criar o job de lote";
    logger.error(`${TAG} job não criado; devolvendo ${preparados.length} itens.`, erro);
    for (const item of preparados) {
      await rejectBatchOperation(item.reserva.id, "lote_nao_criado", 30 * 60000, mensagem);
      await deferReading(item.metricId, item.lease, "lote_nao_criado", 30 * 60000);
      await ai.files.delete({ name: item.fileName }).catch(() => {});
    }
    return { enviados: 0, job: null, pulados: pulados + preparados.length };
  }

  const expiresAt = new Date(Date.now() + PRAZO_MS);
  await BatchJob.create({
    _id: job.name, model: MODELO, state: "open", expiresAt,
    items: preparados.map(item => ({ metricId: item.metricId, creatorId: item.creatorId, operationId: item.reserva.id, fileName: item.fileName, state: "sent" })),
  });
  await Operation.updateMany({ _id: { $in: preparados.map(item => item.reserva.id) } }, { $set: { batchJobName: job.name } });
  for (const item of preparados) await markBatched(item.metricId, item.lease, job.name, expiresAt);

  logger.info(`${TAG} job ${job.name} com ${preparados.length} leituras (${pulados} pulados).`);
  return { enviados: preparados.length, job: job.name, pulados };
}

export async function coletarLotes(): Promise<{ jobs: number; lidos: number; devolvidos: number }> {
  await connectToDatabase();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "" });
  const abertos = await BatchJob.find({ state: "open" }).sort({ createdAt: 1 }).limit(10).lean();
  let lidos = 0, devolvidos = 0, jobs = 0;

  for (const registro of abertos as any[]) {
    let job: any;
    try { job = await ai.batches.get({ name: registro._id }); }
    catch (erro) { logger.warn(`${TAG} não consegui consultar ${registro._id}.`, erro); continue; }
    const estado = String(job.state ?? "");
    if (!/SUCCEEDED|FAILED|CANCELLED|EXPIRED/.test(estado)) {
      // Job vivo além do prazo do provedor: devolve para não prender os posts.
      if (new Date(registro.expiresAt) < new Date()) {
        devolvidos += await releaseBatched(registro.items.map((item: any) => item.metricId), "batch_expirado");
        for (const item of registro.items) await rejectBatchOperation(item.operationId, "batch_expirado", 0);
        await BatchJob.updateOne({ _id: registro._id }, { $set: { state: "expired", collectedAt: new Date() } });
      }
      continue;
    }
    jobs++;

    const respostas = job.dest?.inlinedResponses ?? [];
    for (const [indice, item] of (registro.items as any[]).entries()) {
      const resposta = respostas[indice];
      const texto = resposta?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      const metricId = String(item.metricId);
      try {
        if (!resposta || resposta.error || typeof texto !== "string" || !texto.trim()) {
          throw new Error(resposta?.error ? JSON.stringify(resposta.error).slice(0, 200) : "Item do lote voltou sem resposta.");
        }
        const metric = await MetricModel.findById(metricId).select("stats.video_duration_seconds user type").lean<any>();
        const profile = (await loadMapProfiles([String(item.creatorId)])).get(String(item.creatorId));
        if (!profile) throw new Error("Criador sem mapa na coleta.");

        // A resposta paga vira comprovante ANTES do parse, como no tempo real.
        await settleBatchOperation(
          { id: item.operationId, rates: undefined, reservedMicros: 0, bucketIds: [] },
          "cena", registro.model,
          { creatorId: String(item.creatorId), contentKey: `published:${metricId}`, fingerprint: governanceHash(profile) },
          resposta.response,
        );

        const duracao = metric?.stats?.video_duration_seconds ?? null;
        const lida = parseSceneEvaluation(texto, profile, { format: LEGACY_SCENE_FORMAT, durationSeconds: duracao })
          ?? salvageSceneEvaluation(texto, profile, duracao, LEGACY_SCENE_FORMAT);
        if (!lida) throw new Error("Resposta ilegível.");

        await persistPublishedReading({ metricId, creatorId: String(item.creatorId), scene: { ...lida, provider: registro.model } as any });
        await BatchJob.updateOne({ _id: registro._id, "items.metricId": metricId }, { $set: { "items.$.state": "done" } });
        lidos++;
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : "Falha na coleta do item";
        await rejectBatchOperation(item.operationId, "lote_sem_resposta", 30 * 60000, mensagem);
        devolvidos += await releaseBatched([metricId], "batch_sem_resposta");
        await BatchJob.updateOne({ _id: registro._id, "items.metricId": metricId }, { $set: { "items.$.state": "failed", "items.$.error": mensagem.slice(0, 300) } });
      } finally {
        // Só agora o arquivo pode morrer: apagar antes do fim do job foi o erro de 14/09.
        if (item.fileName) await ai.files.delete({ name: item.fileName }).catch(() => {});
      }
    }
    await BatchJob.updateOne({ _id: registro._id }, { $set: { state: "collected", collectedAt: new Date() } });
  }

  if (jobs) logger.info(`${TAG} coleta: ${jobs} jobs, ${lidos} leituras gravadas, ${devolvidos} devolvidas à fila.`);
  return { jobs, lidos, devolvidos };
}
