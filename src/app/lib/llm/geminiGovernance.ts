import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from "@google/genai";
import { connectToDatabase } from "@/app/lib/mongoose";
import Operation from "@/app/models/GeminiOperation";
import { GeminiBudgetBucket, GeminiBudgetPolicy } from "@/app/models/GeminiBudget";
import { logGeminiUsage } from "./geminiUsageLog";
import UsageLog from "@/app/models/GeminiUsageLog";
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
/** O que fica reservado antes do envio: identidade da operação e o dinheiro apartado. */
export type Reserva = { id: string; rates?: Rates; reservedMicros: number; bucketIds: string[] };
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

  const { reserva } = await reserveOperation({ ai, request, tag, scope, id, fingerprint, existing });
  return executeAndSettle(ai, request, tag, scope, reserva);
}

/** Reserva contábil + registro da intenção. Usada pelo tempo real e pelo envio em lote. */
async function reserveOperation(params: {
  ai: GoogleGenAI; request: GenerateContentParameters; tag: string; scope: Context;
  id: string; fingerprint: string; existing: any; batchJobName?: string;
}): Promise<{ reserva: Reserva }> {
  const { ai, request, tag, scope, id, fingerprint, existing } = params;
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
      await Operation.create([{ _id: id, ...scope, fingerprint, tag, model: request.model, state: "started", attempts: (existing?.attempts ?? 0) + 1, reservedMicros, rates, bucketIds, batchJobName: params.batchJobName ?? null }], { session });
    });
  } catch (error: any) {
    if (error?.code === 11000) throw new GeminiGovernanceError("gemini_result_unknown", "Solicitação já reservada por outra execução.");
    throw error;
  } finally { await session.endSession(); }
  return { reserva: { id, rates, reservedMicros, bucketIds } };
}

/**
 * Chama o modelo e quita a reserva. Separado do registro de propósito: o envio em lote
 * reserva agora e quita horas depois, na coleta, com a resposta que o job devolver.
 */
async function executeAndSettle(
  ai: GoogleGenAI, request: GenerateContentParameters, tag: string, scope: Context, reserva: Reserva,
): Promise<GenerateContentResponse> {
  const { id, rates, reservedMicros, bucketIds } = reserva;
  let response: GenerateContentResponse;
  try {
    response = await ai.models.generateContent({ ...request, config: { ...request.config, httpOptions: { ...request.config?.httpOptions, retryOptions: { attempts: 1 } } } });
  } catch (error: any) {
    // A mensagem crua é a única prova de POR QUE a chamada caiu: sem ela, em 18/09/2026
    // um limite de taxa em rajada de cron virou "sem saldo" e pausou a fila inteira por
    // seis horas, com dinheiro na conta e o modelo respondendo normalmente.
    const mensagem = String(error?.message ?? "");
    const semSaldo = /prepayment credits? (?:are )?depleted|insufficient (?:prepaid )?credits?|billing (?:account )?(?:is )?(?:disabled|not enabled|required)|payment required/i.test(mensagem)
      && !/quota|rate.?limit|resource_exhausted/i.test(mensagem);
    if (Number(error?.status) >= 400 && semSaldo) {
      await Operation.updateOne({ _id: id, state: "started" }, { $set: { state: "rejected", retryAt: new Date(Date.now() + 6 * 3600000), reason: "saldo", error: mensagem.slice(0, 300) } });
      throw new GeminiGovernanceError("gemini_provider_balance", "Provedor sem saldo; aguardar recuperação.");
    }
    // Só uma rejeição HTTP explícita é elegível. Timeout/abort não prova ausência de uso.
    if ([429, 503].includes(Number(error?.status))) {
      // Mantém a reserva: uma rejeição não é prova contábil de custo zero.
      await Operation.updateOne({ _id: id, state: "started" }, { $set: { state: "rejected", retryAt: new Date(Date.now() + 30 * 60000), reason: `HTTP ${error.status}`, error: mensagem.slice(0, 300) } });
      throw new GeminiGovernanceError("gemini_provider_rejected", `HTTP ${error.status}; aguardar antes de nova tentativa.`);
    }
    throw new GeminiGovernanceError("gemini_result_unknown", "Envio interrompido ou recusado; resultado precisa de revisão.");
  }
  await settleReserva(reserva, tag, request.model, scope, response);
  return response;
}

/**
 * Quita a reserva: comprovante na operação e acerto do que foi apartado no balde.
 *
 * Um caminho só para tempo real e lote — dois caminhos de cobrança seriam duas chances
 * de pagar duas vezes pelo mesmo conteúdo.
 */
async function settleReserva(
  reserva: Reserva, tag: string, model: string, scope: Context, response: GenerateContentResponse,
): Promise<void> {
  const { id, rates, reservedMicros, bucketIds } = reserva;
  // Persiste apenas campos consumidos, sem candidatos multimodais potencialmente enormes.
  const receipt = { text: response.text ?? "", usageMetadata: response.usageMetadata, candidates: [{ finishReason: response.candidates?.[0]?.finishReason }] };
  logGeminiUsage(tag, model, response, { operationId: id, creatorId: scope.creatorId, contentKey: scope.contentKey });
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
}

/**
 * Reserva para um item que vai num job de lote: registra a intenção e aparta o dinheiro
 * agora, sem chamar o modelo. A resposta chega horas depois, na coleta.
 */
export async function reserveBatchOperation(
  ai: GoogleGenAI, request: GenerateContentParameters, tag: string, scope: Context, batchJobName: string,
): Promise<Reserva> {
  await connectToDatabase();
  const id = governanceHash([scope.creatorId, scope.contentKey, tag]);
  const fingerprint = governanceHash([scope.fingerprint, request.model]);
  const existing = await Operation.findById(id).lean();
  if (existing && !(existing.state === "rejected" && existing.retryAt && existing.retryAt <= new Date())) {
    throw new GeminiGovernanceError("gemini_result_unknown", "Conteúdo já tem operação registrada; não enviar ao lote.");
  }
  if (existing && existing.attempts >= (scope.maxAttempts ?? 3)) {
    throw new GeminiGovernanceError("gemini_result_unknown", "Limite de rejeições atingido; exige revisão.");
  }
  const { reserva } = await reserveOperation({ ai, request, tag, scope, id, fingerprint, existing, batchJobName });
  return reserva;
}

/** Coleta: a resposta do job vira comprovante pela mesma porta do tempo real. */
export async function settleBatchOperation(
  reserva: Reserva, tag: string, model: string, scope: Context, response: GenerateContentResponse,
): Promise<void> {
  await settleReserva(reserva, tag, model, scope, response);
}

/**
 * Solicitação que ficou em "iniciada" sem nunca virar resposta nem uso registrado.
 *
 * Acontece quando a função morre no meio (timeout da Vercel, rajada de cron): a
 * intenção fica registrada e trava o conteúdo para sempre, porque a regra de pagamento
 * único recusa reenviar. Sem registro de uso não houve cobrança, então é seguro
 * devolver para a fila. Em 18/09/2026 havia 88 assim, a mais antiga de três dias.
 */
export async function reconcileStuckOperations(tag: string, horas = 1): Promise<number> {
  await connectToDatabase();
  const presas = await Operation.find({ tag, state: "started", updatedAt: { $lte: new Date(Date.now() - horas * 3600000) } })
    .select("_id").lean();
  if (!presas.length) return 0;
  const ids = presas.map(operacao => String(operacao._id));
  const cobradas = new Set((await UsageLog.find({ operationId: { $in: ids } }).select("operationId").lean())
    .map((registro: any) => String(registro.operationId)));
  const soltas = ids.filter(id => !cobradas.has(id));
  if (!soltas.length) return 0;
  const resultado = await Operation.updateMany({ _id: { $in: soltas }, state: "started" }, { $set: {
    state: "rejected", reason: "reconciliacao_sem_resposta", retryAt: new Date(0),
    error: "Sem resposta registrada; liberado para nova tentativa.",
  } });
  if (resultado.modifiedCount) logger.warn(`[gemini] ${resultado.modifiedCount} solicitações sem resposta liberadas (${tag}).`);
  return resultado.modifiedCount;
}

/** Item do job sem resposta utilizável: rejeita para a repescagem tentar de novo. */
export async function rejectBatchOperation(id: string, motivo: string, retryEmMs: number, mensagem?: string): Promise<void> {
  await Operation.updateOne({ _id: id, state: "started" }, { $set: {
    state: "rejected", reason: motivo.slice(0, 120), retryAt: new Date(Date.now() + retryEmMs),
    error: (mensagem ?? "").slice(0, 300) || null,
  } });
}
