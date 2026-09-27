/** @jest-environment node */
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { GoogleGenAI, GenerateContentParameters } from "@google/genai";
import State from "@/app/models/ContentReadingState";
import Operation from "@/app/models/GeminiOperation";
import { GeminiBudgetBucket, GeminiBudgetPolicy } from "@/app/models/GeminiBudget";
import { governedGenerateContent, withGeminiGovernance } from "@/app/lib/llm/geminiGovernance";
import { acquireReading, claimGeminiAvailability, eligibleReadingIds, finishReading, geminiUnavailable } from "./contentReadingState";

jest.setTimeout(30000); // Mongo real em memória; sob carga, 5 s não bastam.
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/lib/llm/geminiUsageLog", () => ({ logGeminiUsage: jest.fn() }));

// Resposta real do provedor em 26/09/2026, no formato em que o SDK a entrega.
const SALDO_402 = '{"error":{"code":402,"message":"Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay. ","status":"RESOURCE_EXHAUSTED"}}';
const HORA = 3600000;
const generateContent = jest.fn();
const ai = { models: { generateContent, countTokens: jest.fn() } } as unknown as GoogleGenAI;
const request: GenerateContentParameters = { model: "gemini-2.5-flash", contents: "vídeo", config: { maxOutputTokens: 100 } };
let db: MongoMemoryReplSet;

beforeAll(async () => {
  db = await MongoMemoryReplSet.create({ binary: { downloadDir: "/private/tmp/collabs-mongodb" }, instanceOpts: [{ launchTimeout: 60000 }], replSet: { count: 1 } });
  await mongoose.connect(db.getUri("gemini_probe_test"));
  await Promise.all([State.init(), Operation.init(), GeminiBudgetBucket.init(), GeminiBudgetPolicy.init()]);
}, 180000);
afterAll(async () => { await mongoose.disconnect(); await db?.stop(); }, 60000);
beforeEach(async () => {
  await Promise.all([State.deleteMany({}), Operation.deleteMany({})]);
  jest.restoreAllMocks();
  generateContent.mockReset();
});

it("sonda que encontra o saldo esgotado volta a pausar e não encerra o post", async () => {
  // Estado de produção em 26/09/2026: sonda presa em "probing", prazo vencido havia dois
  // dias, e cada job novo renovando a posse sem nunca pausar de novo.
  await State.create({ _id: "provider:gemini", revision: "v1", state: "probing", reason: "provider_balance",
    nextAttemptAt: new Date(Date.now() - 48 * HORA), leaseUntil: new Date(Date.now() - 60000) });
  expect(await geminiUnavailable()).toBe(false);

  const metricId = new mongoose.Types.ObjectId().toString();
  const lease = await acquireReading(metricId, "cena_mapa_v4");
  expect(lease).not.toBeNull();
  expect(await claimGeminiAvailability()).toBe(true);
  expect(await geminiUnavailable()).toBe(true);

  generateContent.mockRejectedValue({ status: 402, message: SALDO_402 });
  const erro = await withGeminiGovernance({ creatorId: "criador", contentKey: `published:${metricId}`, fingerprint: "mapa" },
    () => governedGenerateContent(ai, request, "cena")).catch((error: Error) => error);
  expect(String(erro)).toContain("gemini_provider_balance");
  await finishReading(metricId, lease!.token, (erro as Error).message);

  const provider = await State.findById("provider:gemini").lean();
  expect(provider).toMatchObject({ state: "paused", reason: "provider_balance" });
  expect(provider!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 5.9 * HORA);
  expect(provider!.leaseUntil.getTime()).toBe(0);
  const post = await State.findById(metricId).lean();
  expect(post).toMatchObject({ state: "deferred", reason: "provider_balance" });
  expect(await claimGeminiAvailability()).toBe(false);
  expect(await geminiUnavailable()).toBe(true);
});

it("job que leu o estado antigo não devolve o provedor saudável para a sonda", async () => {
  // 27/09/2026: após a recarga, duas leituras marcaram "saudável"; um job da rajada de
  // 00:20 tinha lido "testando" um instante antes e reabriu a sonda por cima.
  await State.create({ _id: "provider:gemini", revision: "v1", state: "healthy", reason: null, nextAttemptAt: new Date(0), leaseUntil: new Date(0) });
  const antigo = { _id: "provider:gemini", state: "probing", nextAttemptAt: new Date(0), leaseUntil: new Date(0) };
  jest.spyOn(State, "findById").mockReturnValueOnce({ lean: async () => antigo } as never);
  expect(await claimGeminiAvailability()).toBe(true);
  expect(await State.findById("provider:gemini").lean()).toMatchObject({ state: "healthy" });
  expect(await geminiUnavailable()).toBe(false);
});

it("seleção da fila recusa post encerrado só na revisão em que ele foi encerrado", async () => {
  const novoId = () => new mongoose.Types.ObjectId().toString();
  const [encerrado, revisaoAntiga, adiado, concluido, novo] = [novoId(), novoId(), novoId(), novoId(), novoId()];
  await State.create([
    { _id: encerrado, revision: "cena_mapa_v4", state: "unsupported", reason: "unsupported_media", nextAttemptAt: new Date(Date.now() - HORA) },
    { _id: revisaoAntiga, revision: "cena_mapa_v3", state: "unsupported", reason: "provider_unreadable" },
    { _id: adiado, revision: "cena_mapa_v4", state: "deferred", reason: "provider_paused", nextAttemptAt: new Date(Date.now() + 6 * HORA) },
    { _id: concluido, revision: "cena_mapa_v4", state: "complete" },
  ]);
  expect(await eligibleReadingIds([encerrado, revisaoAntiga, adiado, concluido, novo], "cena_mapa_v4"))
    .toEqual([revisaoAntiga, concluido, novo]);
});
