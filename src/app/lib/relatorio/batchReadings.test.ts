/** @jest-environment node */
/**
 * As duas regras que não podem quebrar no lote: nada vai ao provedor sem operação
 * registrada, e o arquivo da Files API só morre depois que o job termina.
 */
import { enviarLoteDeLeituras, coletarLotes } from "./batchReadings";
import BatchJob from "@/app/models/GeminiBatchJob";
import { rejectBatchOperation, settleBatchOperation } from "@/app/lib/llm/geminiGovernance";
import { releaseBatched, markBatched, finishReading } from "./contentReadingState";
import { persistPublishedReading } from "./persistPublishedReading";

const criarJob = jest.fn();
const consultarJob = jest.fn();
const apagarArquivo = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    batches: { create: (...args: any[]) => criarJob(...args), get: (...args: any[]) => consultarJob(...args) },
    files: { delete: (...args: any[]) => apagarArquivo(...args) },
  })),
  createPartFromUri: jest.fn((uri: string, mimeType: string) => ({ fileData: { fileUri: uri, mimeType } })),
}));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/app/models/GeminiBatchJob", () => ({ __esModule: true, default: {
  create: jest.fn(), updateOne: jest.fn(),
  find: jest.fn(() => ({ sort: () => ({ limit: () => ({ lean: () => mockAbertos() }) }) })),
} }));
jest.mock("@/app/models/GeminiOperation", () => ({ __esModule: true, default: { updateMany: jest.fn() } }));
jest.mock("@/app/models/Metric", () => ({ __esModule: true, default: {
  findById: () => ({ select: () => ({ lean: async () => ({ stats: { video_duration_seconds: 30 }, type: "REEL" }) }) }),
} }));
jest.mock("@/app/models/User", () => ({ __esModule: true, default: {
  findById: () => ({ select: () => ({ lean: async () => ({ instagramAccessToken: "token" }) }) }),
} }));
jest.mock("./contentReadingState", () => ({
  findPendingReadingBatch: jest.fn(async () => [{ _id: "post1", user: "criador1", type: "REEL", stats: { video_duration_seconds: 30 }, instagramMediaId: "ig1" }]),
  acquireReading: jest.fn(async () => ({ token: "posse", result: null })),
  markBatched: jest.fn(), releaseBatched: jest.fn(async () => 1), finishReading: jest.fn(),
}));
jest.mock("./mapProfiles", () => ({ loadMapProfiles: jest.fn(async () => new Map([["criador1", { creatorId: "criador1", assets: [], toneIds: [], subjects: [], territoryIds: [], primaryTerritoryId: null, narrative: null, narrativeConfirmed: false, misplacedTerritoryLabels: [], maturity: null }]])) }));
jest.mock("./publishedMedia", () => ({ freshPublishedMedia: jest.fn(async () => ({ mediaType: "VIDEO", mediaUrl: "https://video", imageUrls: [], items: [] })) }));
jest.mock("./sceneEvaluation", () => ({
  buildPrompt: jest.fn(() => ({ system: "s", user: "u", format: "f" })),
  uploadVideo: jest.fn(async () => ({ uri: "files/uri", mimeType: "video/mp4", name: "files/arquivo1" })),
  parseSceneEvaluation: jest.fn(() => ({ assetRoleIds: [], toneIds: [], subjects: [], transcript: "fala" })),
  salvageSceneEvaluation: jest.fn(() => null),
  SCENE_MAX_OUTPUT_TOKENS: 16384,
  SCENE_EVALUATION_VERSION: "cena_mapa_v4",
}));
jest.mock("./persistPublishedReading", () => ({ persistPublishedReading: jest.fn() }));
jest.mock("./readingRevision", () => ({ readingRevision: () => "cena_mapa_v4" }));
jest.mock("@/app/lib/llm/geminiGovernance", () => ({
  reserveBatchOperation: jest.fn(async () => ({ id: "op1", reservedMicros: 10, bucketIds: ["balde"] })),
  settleBatchOperation: jest.fn(), rejectBatchOperation: jest.fn(),
  governanceHash: jest.fn(() => "hash"),
  GeminiGovernanceError: class extends Error {},
}));

const mockAbertos = jest.fn();
const anterior = process.env.GEMINI_BATCH_READINGS;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_BATCH_READINGS = "on";
  global.fetch = jest.fn(async () => new Response(new Uint8Array([1, 2, 3]))) as any;
  criarJob.mockResolvedValue({ name: "batches/job1" });
  // O código encadeia `.catch` na exclusão do arquivo: o mock precisa ser promessa.
  apagarArquivo.mockResolvedValue({});
  mockAbertos.mockResolvedValue([]);
});
afterAll(() => { if (anterior === undefined) delete process.env.GEMINI_BATCH_READINGS; else process.env.GEMINI_BATCH_READINGS = anterior; });

it("desligado por padrão: não envia nada", async () => {
  process.env.GEMINI_BATCH_READINGS = "off";
  expect(await enviarLoteDeLeituras(["criador1" as any])).toMatchObject({ enviados: 0, job: null });
  expect(criarJob).not.toHaveBeenCalled();
});

it("job que não nasce devolve os itens à fila e solta a reserva", async () => {
  criarJob.mockRejectedValue(new Error("provedor recusou"));
  const saida = await enviarLoteDeLeituras(["criador1" as any]);
  expect(saida.enviados).toBe(0);
  expect(rejectBatchOperation).toHaveBeenCalledWith("op1", "lote_nao_criado", expect.any(Number), "provedor recusou");
  expect(finishReading).toHaveBeenCalledWith("post1", "posse", "provedor recusou");
  expect(apagarArquivo).toHaveBeenCalledWith({ name: "files/arquivo1" });
  expect(markBatched).not.toHaveBeenCalled();
});

it("envio bem-sucedido registra o job e tira o post da fila do tempo real", async () => {
  const saida = await enviarLoteDeLeituras(["criador1" as any]);
  expect(saida).toMatchObject({ enviados: 1, job: "batches/job1" });
  expect(BatchJob.create).toHaveBeenCalledWith(expect.objectContaining({ _id: "batches/job1" }));
  expect(markBatched).toHaveBeenCalledWith("post1", "posse", "batches/job1", expect.any(Date));
  // O arquivo NÃO pode ser apagado no envio: o job ainda vai lê-lo.
  expect(apagarArquivo).not.toHaveBeenCalled();
});

it("coleta grava a leitura, quita a operação e só então apaga o arquivo", async () => {
  mockAbertos.mockResolvedValue([{ _id: "batches/job1", model: "gemini-2.5-flash", state: "open", expiresAt: new Date(Date.now() + 3600000),
    items: [{ metricId: "post1", creatorId: "criador1", operationId: "op1", fileName: "files/arquivo1", state: "sent" }] }]);
  consultarJob.mockResolvedValue({ state: "JOB_STATE_SUCCEEDED", dest: { inlinedResponses: [
    { response: { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] } },
  ] } });
  expect(await coletarLotes()).toMatchObject({ jobs: 1, lidos: 1, devolvidos: 0 });
  expect(settleBatchOperation).toHaveBeenCalled();
  expect(persistPublishedReading).toHaveBeenCalledWith(expect.objectContaining({ metricId: "post1", creatorId: "criador1" }));
  expect(apagarArquivo).toHaveBeenCalledWith({ name: "files/arquivo1" });
});

it("item sem resposta volta para a fila em vez de virar leitura vazia", async () => {
  mockAbertos.mockResolvedValue([{ _id: "batches/job1", model: "gemini-2.5-flash", state: "open", expiresAt: new Date(Date.now() + 3600000),
    items: [{ metricId: "post1", creatorId: "criador1", operationId: "op1", fileName: "files/arquivo1", state: "sent" }] }]);
  consultarJob.mockResolvedValue({ state: "JOB_STATE_SUCCEEDED", dest: { inlinedResponses: [{ error: { code: 7 } }] } });
  expect(await coletarLotes()).toMatchObject({ jobs: 1, lidos: 0, devolvidos: 1 });
  expect(persistPublishedReading).not.toHaveBeenCalled();
  expect(releaseBatched).toHaveBeenCalledWith(["post1"], "batch_sem_resposta");
});
