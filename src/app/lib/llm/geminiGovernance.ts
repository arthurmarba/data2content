import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from "@google/genai";
import { connectToDatabase } from "@/app/lib/mongoose";
import Operation from "@/app/models/GeminiOperation";
import { GeminiBudgetBucket, GeminiBudgetPolicy } from "@/app/models/GeminiBudget";
import { logGeminiUsage } from "./geminiUsageLog";
import { logger } from "@/app/lib/logger";

type Context = { creatorId: string; contentKey: string; fingerprint: string; responseFormat?: "scene_legacy_v1" | "scene_segments_v1"; durationSeconds?: number | null; budgetPolicyId?: string; maxAttempts?: number };
const context = new AsyncLocalStorage<Context>();
export const withGeminiGovernance = <T>(value: Context, work: () => Promise<T>): Promise<T> => context.run(value, work);
export const hasGeminiGovernance = () => Boolean(context.getStore());
export const governanceHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function recordGeminiOutcome(tag: string, outcome: "complete" | "partial" | "unusable") {
  const scope = context.getStore();
  if (!scope) return;
  await Operation.updateOne({ _id: governanceHash([scope.creatorId, scope.contentKey, tag]), state: "received" }, { $set: { outcome } })
    .catch(() => logger.warn("[gemini] Falha ao registrar qualidade da leitura; resposta paga preservada."));
}

export class GeminiGovernanceError extends Error {
  constructor(public readonly code: "gemini_budget_deferred" | "gemini_result_unknown" | "gemini_request_changed" | "gemini_provider_rejected" | "gemini_provider_balance", message: string) {
    super(`${code}: ${message}`);
  }
}
type Rates = { inputUsdPerMillion: number; outputUsdPerMillion: number };
export function estimatedMicros(inputTokens: number, outputTokens: number, rates: Rates): number {
  if (![inputTokens, outputTokens, rates.inputUsdPerMillion, rates.outputUsdPerMillion].every(n => Number.isFinite(n) && n >= 0)) throw new Error("Tarifa ou contagem inválida");
  const value = Math.ceil(inputTokens * rates.inputUsdPerMillion + outputTokens * rates.outputUsdPerMillion);
  if (!Number.isSafeInteger(value)) throw new Error("Estimativa fora do limite seguro");
  return value;
}

function replay(operation: any, fingerprint: string): GenerateContentResponse {
  if (operation.fingerprint !== fingerprint) throw new GeminiGovernanceError("gemini_request_changed", "Conteúdo já solicitado com outro contexto; exige revisão explícita.");
  if (operation.state === "received") return operation.response as GenerateContentResponse;
  if (operation.reason === "saldo") throw new GeminiGovernanceError("gemini_provider_balance", "Provedor sem saldo; aguardar recuperação.");
  throw new GeminiGovernanceError(operation.state === "rejected" ? "gemini_provider_rejected" : "gemini_result_unknown", "Solicitação registrada sem resposta recuperável; não reenviar automaticamente.");
}

/** Registra antes do envio; salva a resposta antes do parse e proíbe retry oculto do SDK. */
export async function governedGenerateContent(ai: GoogleGenAI, request: GenerateContentParameters, tag: string): Promise<GenerateContentResponse> {
  const scope = context.getStore();
  if (!scope) {
    const response = await ai.models.generateContent(request);
    logGeminiUsage(tag, request.model, response);
    return response;
  }
  await connectToDatabase();
  const id = governanceHash([scope.creatorId, scope.contentKey, tag]);
  const fingerprint = governanceHash([scope.fingerprint, request.model]);
  const existing = await Operation.findById(id).lean();
  if (existing && scope.responseFormat && (existing.responseFormat ?? "scene_legacy_v1") !== scope.responseFormat) throw new GeminiGovernanceError("gemini_request_changed", "Formato fixado na operação difere do solicitado.");
  if (existing && !(existing.state === "rejected" && existing.retryAt && existing.retryAt <= new Date())) return replay(existing, fingerprint);
  if (existing && existing.attempts >= (scope.maxAttempts ?? 3)) throw new GeminiGovernanceError("gemini_result_unknown", "Limite de rejeições atingido; exige revisão.");
  if (existing && existing.fingerprint !== fingerprint) return replay(existing, fingerprint);

  const policy = await GeminiBudgetPolicy.findById(scope.budgetPolicyId ?? "automatic").lean();
  if (scope.budgetPolicyId && !policy?.enabled) throw new GeminiGovernanceError("gemini_budget_deferred", "Experimento sem orçamento ativo.");
  let reservedMicros = 0;
  let rates: Rates | undefined;
  const bucketIds: string[] = [];
  if (policy?.enabled) {
    rates = policy.rates?.[request.model] as Rates | undefined;
    if (!rates || ![policy.globalDailyMicros, ...(policy.creatorDailyMicros == null ? [] : [policy.creatorDailyMicros])].every(n => typeof n === "number" && Number.isSafeInteger(n) && n >= 0) || !request.config?.maxOutputTokens) {
      throw new GeminiGovernanceError("gemini_budget_deferred", "Orçamento ou tarifa do modelo ainda não configurados.");
    }
    // A API de desenvolvedor recusa systemInstruction no countTokens: conta como texto.
    const system = request.config.systemInstruction;
    const contents = [
      ...(typeof system === "string" && system ? [{ role: "user", parts: [{ text: system }] }] : []),
      ...(Array.isArray(request.contents) ? request.contents : [request.contents]),
    ] as GenerateContentParameters["contents"];
    const count = await ai.models.countTokens({ model: request.model, contents });
    try {
      reservedMicros = estimatedMicros(count.totalTokens ?? NaN, request.config.maxOutputTokens, rates);
    } catch {
      throw new GeminiGovernanceError("gemini_budget_deferred", "Não foi possível estimar o custo com segurança.");
    }
    const day = new Date().toISOString().slice(0, 10);
    bucketIds.push(scope.budgetPolicyId ? `experiment:${scope.budgetPolicyId}` : `global:${day}`);
    if (policy.creatorDailyMicros != null) bucketIds.push(scope.budgetPolicyId ? `experiment:${scope.budgetPolicyId}:${scope.creatorId}` : `creator:${scope.creatorId}:${day}`);
  }
  const session = await Operation.db.startSession();
  try {
    await session.withTransaction(async () => {
      // Rejeições explícitas 429/503 podem voltar após espera; resultado incerto nunca.
      if (existing) {
        const removed = await Operation.deleteOne({ _id: id, state: "rejected", retryAt: { $lte: new Date() } }, { session });
        if (removed.deletedCount !== 1) throw new GeminiGovernanceError("gemini_result_unknown", "Outra execução já retomou a solicitação.");
      }
      for (const [index, bucketId] of bucketIds.entries()) {
        await GeminiBudgetBucket.updateOne({ _id: bucketId }, { $setOnInsert: { allocatedMicros: 0 } }, { upsert: true, session });
        const limit = index === 0 ? policy!.globalDailyMicros : policy!.creatorDailyMicros;
        const reserved = await GeminiBudgetBucket.updateOne({ _id: bucketId, allocatedMicros: { $lte: Number(limit) - reservedMicros } }, { $inc: { allocatedMicros: reservedMicros } }, { session });
        if (reserved.matchedCount !== 1) throw new GeminiGovernanceError("gemini_budget_deferred", "Limite diário atingido; leitura aguardando orçamento.");
      }
      await Operation.create([{ _id: id, ...scope, fingerprint, tag, model: request.model, state: "started", attempts: (existing?.attempts ?? 0) + 1, reservedMicros, rates, bucketIds }], { session });
    });
  } catch (error: any) {
    if (error?.code === 11000) throw new GeminiGovernanceError("gemini_result_unknown", "Solicitação já reservada por outra execução.");
    throw error;
  } finally { await session.endSession(); }

  let response: GenerateContentResponse;
  try {
    response = await ai.models.generateContent({ ...request, config: { ...request.config, httpOptions: { ...request.config?.httpOptions, retryOptions: { attempts: 1 } } } });
  } catch (error: any) {
    if (Number(error?.status) >= 400 && /prepayment.*depleted|insufficient.*credit|billing|payment required/i.test(String(error?.message))) {
      await Operation.updateOne({ _id: id, state: "started" }, { $set: { state: "rejected", retryAt: new Date(Date.now() + 6 * 3600000), reason: "saldo" } });
      throw new GeminiGovernanceError("gemini_provider_balance", "Provedor sem saldo; aguardar recuperação.");
    }
    // Só uma rejeição HTTP explícita é elegível. Timeout/abort não prova ausência de uso.
    if ([429, 503].includes(Number(error?.status))) {
      // Mantém a reserva: uma rejeição não é prova contábil de custo zero.
      await Operation.updateOne({ _id: id, state: "started" }, { $set: { state: "rejected", retryAt: new Date(Date.now() + 30 * 60000), reason: `HTTP ${error.status}` } });
      throw new GeminiGovernanceError("gemini_provider_rejected", `HTTP ${error.status}; aguardar antes de nova tentativa.`);
    }
    throw new GeminiGovernanceError("gemini_result_unknown", "Envio interrompido ou recusado; resultado precisa de revisão.");
  }
  // Persiste apenas campos consumidos, sem candidatos multimodais potencialmente enormes.
  const receipt = { text: response.text ?? "", usageMetadata: response.usageMetadata, candidates: [{ finishReason: response.candidates?.[0]?.finishReason }] };
  logGeminiUsage(tag, request.model, response, { operationId: id, creatorId: scope.creatorId, contentKey: scope.contentKey });
  const settle = await Operation.db.startSession();
  try {
    await settle.withTransaction(async () => {
      const usage = response.usageMetadata;
      const actual = rates && usage?.promptTokenCount != null && usage.candidatesTokenCount != null
        ? estimatedMicros(usage.promptTokenCount, usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0), rates) : reservedMicros;
      if (actual > reservedMicros && rates) logger.error("[gemini] Uso excedeu a reserva estimada; revisar tarifa e contagem.", { operationId: id });
      await Operation.updateOne({ _id: id, state: "started" }, { $set: { state: "received", response: receipt, chargedEstimateMicros: rates ? actual : null } }, { session: settle });
      for (const bucketId of bucketIds) await GeminiBudgetBucket.updateOne({ _id: bucketId }, { $inc: { allocatedMicros: actual - reservedMicros } }, { session: settle });
    });
  } catch {
    throw new GeminiGovernanceError("gemini_result_unknown", "Resposta recebida, mas o comprovante não pôde ser salvo; não reenviar.");
  } finally { await settle.endSession(); }
  return response;
}
