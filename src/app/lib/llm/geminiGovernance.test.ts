/** @jest-environment node */
import ScenePolicy from "@/app/models/SceneReadingPolicy";
import { resolveSceneFormat } from "../relatorio/sceneReadingRollout";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { GoogleGenAI, GenerateContentParameters } from "@google/genai";
import Operation from "@/app/models/GeminiOperation";
import { GeminiBudgetBucket, GeminiBudgetPolicy } from "@/app/models/GeminiBudget";
import { governedGenerateContent, withGeminiGovernance, estimatedMicros } from "./geminiGovernance";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("./geminiUsageLog", () => ({ logGeminiUsage: jest.fn() }));
let db: MongoMemoryReplSet;
const generateContent = jest.fn();
const countTokens = jest.fn();
const ai = { models: { generateContent, countTokens } } as unknown as GoogleGenAI;
const request: GenerateContentParameters = { model: "teste", contents: "vídeo", config: { maxOutputTokens: 100, systemInstruction: "instrução" } };
const run = (contentKey = "post", creatorId = "criador", fingerprint = "mapa") => withGeminiGovernance({ contentKey, creatorId, fingerprint }, () => governedGenerateContent(ai, request, "cena"));
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({ binary: { downloadDir: "/private/tmp/collabs-mongodb" }, replSet: { count: 1 } });
  await mongoose.connect(db.getUri("gemini_governance_test"));
  await Promise.all([Operation.init(), GeminiBudgetBucket.init(), GeminiBudgetPolicy.init(), ScenePolicy.init()]);
}, 180000);
afterAll(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
  await Promise.all([Operation.deleteMany({}), GeminiBudgetBucket.deleteMany({}), GeminiBudgetPolicy.deleteMany({}), ScenePolicy.deleteMany({})]);
  jest.restoreAllMocks();
  generateContent.mockReset().mockResolvedValue({ text: "resposta", candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 10 } });
  countTokens.mockReset().mockResolvedValue({ totalTokens: 100 });
});
async function budget(globalDailyMicros = 300, creatorDailyMicros = 300) {
  await GeminiBudgetPolicy.create({ _id: "automatic", enabled: true, globalDailyMicros, creatorDailyMicros, rates: { teste: { inputUsdPerMillion: 1, outputUsdPerMillion: 2 } } });
}
it("fila e recuperação concorrentes pagam uma única vez", async () => {
  const results = await Promise.allSettled([run(), run()]);
  expect(results.some(r => r.status === "fulfilled")).toBe(true);
  expect(generateContent).toHaveBeenCalledTimes(1);
  expect((await run()).text).toBe("resposta");
  expect(generateContent).toHaveBeenCalledTimes(1);
  expect(generateContent.mock.calls[0][0].config.httpOptions.retryOptions.attempts).toBe(1);
  expect((await Operation.findOne())?.chargedEstimateMicros).toBeNull();
});
it("timeout depois do envio permanece bloqueado mesmo em outra execução", async () => {
  generateContent.mockRejectedValue(new Error("timeout"));
  await expect(run()).rejects.toThrow("gemini_result_unknown");
  await expect(run()).rejects.toThrow("gemini_result_unknown");
  expect(generateContent).toHaveBeenCalledTimes(1);
});
it("falha ao salvar comprovante não autoriza pagar novamente", async () => {
  const update = jest.spyOn(Operation, "updateOne").mockRejectedValueOnce(new Error("banco indisponível") as never);
  await expect(run()).rejects.toThrow("gemini_result_unknown");
  update.mockRestore();
  await expect(run()).rejects.toThrow("gemini_result_unknown");
  expect(generateContent).toHaveBeenCalledTimes(1);
});
it("falha antes do registro não envia ao provedor", async () => {
  jest.spyOn(Operation, "create").mockRejectedValueOnce(new Error("banco indisponível") as never);
  await expect(run()).rejects.toThrow("banco indisponível");
  expect(generateContent).not.toHaveBeenCalled();
});
it("resposta cortada fica recuperável sem repetir a chamada", async () => {
  generateContent.mockResolvedValue({ text: '{"fala":"parcial', candidates: [{ finishReason: "MAX_TOKENS" }] });
  expect((await run()).text).toContain("parcial");
  expect((await run()).candidates?.[0]?.finishReason).toBe("MAX_TOKENS");
  expect(generateContent).toHaveBeenCalledTimes(1);
});
it("mudança de contexto não reinterpreta códigos do mapa nem autoriza nova leitura", async () => {
  await run();
  await expect(run("post", "criador", "outro mapa")).rejects.toThrow("gemini_request_changed");
  expect(generateContent).toHaveBeenCalledTimes(1);
});
it("reservas concorrentes respeitam teto global entre criadores", async () => {
  await budget();
  const results = await Promise.allSettled([run("a", "a"), run("b", "b")]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(generateContent).toHaveBeenCalledTimes(1);
  expect((await GeminiBudgetBucket.findOne({ _id: /^global:/ }))?.allocatedMicros).toBe(160);
  expect(await Operation.countDocuments()).toBe(1);
});
it("teto por criador não consome reserva global quando recusa", async () => {
  await budget(10000, 100);
  await expect(run()).rejects.toThrow("gemini_budget_deferred");
  expect(generateContent).not.toHaveBeenCalled();
  expect(await GeminiBudgetBucket.countDocuments()).toBe(0);
});
it("orçamento sem tarifa falha fechado antes de enviar", async () => {
  await budget();
  await GeminiBudgetPolicy.updateOne({ _id: "automatic" }, { $set: { rates: {} } });
  await expect(run()).rejects.toThrow("gemini_budget_deferred");
  expect(generateContent).not.toHaveBeenCalled();
});
it("resultado incerto conserva reserva nas execuções seguintes", async () => {
  await budget();
  generateContent.mockRejectedValue(new Error("abort"));
  await expect(run()).rejects.toThrow("gemini_result_unknown");
  expect((await GeminiBudgetBucket.findOne({ _id: /^global:/ }))?.allocatedMicros).toBe(300);
  await expect(run()).rejects.toThrow("gemini_result_unknown");
  expect(generateContent).toHaveBeenCalledTimes(1);
});
it("rejeição explícita aguarda e tem limite de tentativas", async () => {
  generateContent.mockRejectedValue({ status: 429 });
  await expect(run()).rejects.toThrow("gemini_provider_rejected");
  await expect(run()).rejects.toThrow("gemini_provider_rejected");
  expect(generateContent).toHaveBeenCalledTimes(1);
  for (let attempt = 0; attempt < 2; attempt++) {
    await Operation.updateOne({}, { $set: { retryAt: new Date(0) } });
    await expect(run()).rejects.toThrow("gemini_provider_rejected");
  }
  await Operation.updateOne({}, { $set: { retryAt: new Date(0) } });
  await expect(run()).rejects.toThrow("gemini_result_unknown");
  expect(generateContent).toHaveBeenCalledTimes(3);
});
it("estimativa inclui entrada e saída e rejeita valores inválidos", () => {
  expect(estimatedMicros(100, 30, { inputUsdPerMillion: 1, outputUsdPerMillion: 2 })).toBe(160);
  expect(() => estimatedMicros(NaN, 30, { inputUsdPerMillion: 1, outputUsdPerMillion: 2 })).toThrow();
});

it("saldo esgotado mantém motivo próprio para pausar o provedor", async () => {
  generateContent.mockRejectedValue({ status: 400, message: "prepayment credits depleted" });
  await expect(run()).rejects.toThrow("gemini_provider_balance");
  await expect(run()).rejects.toThrow("gemini_provider_balance");
  expect(generateContent).toHaveBeenCalledTimes(1);
});
it("limite de taxa não vira falta de saldo, e a mensagem do provedor fica no recibo", async () => {
  // Em 18/09/2026 uma rajada de cron devolveu quota esgotada com a palavra "billing" na
  // mensagem: a fila inteira foi pausada por seis horas com dinheiro na conta.
  generateContent.mockRejectedValue({ status: 429, message: "Quota exceeded for quota metric 'Generate requests'; check your billing plan" });
  await expect(run()).rejects.toThrow("gemini_provider_rejected");
  const operation = await Operation.findOne({}).lean();
  expect(operation?.reason).toBe("HTTP 429");
  expect(operation?.error).toContain("Quota exceeded");
});
it("permite limite apenas global, sem impor cota por criador", async () => {
  await budget();
  await GeminiBudgetPolicy.updateOne({ _id: "automatic" }, { $unset: { creatorDailyMicros: 1 } });
  await run();
  expect(await GeminiBudgetBucket.countDocuments()).toBe(1);
});

it("variante fixada sobrevive ao desligamento do piloto antes do envio", async () => {
  await ScenePolicy.create({ _id: "rollout", compactPercent: 100 });
  expect(await resolveSceneFormat("criador", "post")).toBe("scene_segments_v1");
  await ScenePolicy.updateOne({ _id: "rollout" }, { $set: { compactPercent: 0 } });
  expect(await resolveSceneFormat("criador", "post")).toBe("scene_segments_v1");
  expect(await resolveSceneFormat("criador", "outro")).toBe("scene_legacy_v1");
});
it("comprovante antigo sempre usa parser legado mesmo com piloto em 100%", async () => {
  await run();
  await ScenePolicy.create({ _id: "rollout", compactPercent: 100 });
  expect(await resolveSceneFormat("criador", "post")).toBe("scene_legacy_v1");
  await expect(withGeminiGovernance({ creatorId: "criador", contentKey: "post", fingerprint: "mapa", responseFormat: "scene_segments_v1" }, () => governedGenerateContent(ai, request, "cena"))).rejects.toThrow("gemini_request_changed");
  expect(generateContent).toHaveBeenCalledTimes(1);
});
it("comprovante compacto conserva formato e pode ser recuperado após reversão", async () => {
  const compact = () => withGeminiGovernance({ creatorId: "criador", contentKey: "post", fingerprint: "mapa", responseFormat: "scene_segments_v1" }, () => governedGenerateContent(ai, request, "cena"));
  await compact();
  expect(await resolveSceneFormat("criador", "post")).toBe("scene_segments_v1");
  expect((await compact()).text).toBe("resposta");
  expect(generateContent).toHaveBeenCalledTimes(1);
});
it("experimento não executa sem orçamento próprio ativo", async () => {
  await expect(withGeminiGovernance({ creatorId: "criador", contentKey: "experiment:post", fingerprint: "mapa", budgetPolicyId: "experiment-test" }, () => governedGenerateContent(ai, request, "cena"))).rejects.toThrow("gemini_budget_deferred");
  expect(generateContent).not.toHaveBeenCalled();
});
