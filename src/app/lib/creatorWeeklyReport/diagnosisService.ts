// src/app/lib/creatorWeeklyReport/diagnosisService.ts
//
// Quando o diagnóstico da semana é escrito, e o que a tela recebe.
//
// Três regras seguram o desenho:
//
// 1. UMA VEZ POR SEMANA. O relatório se refaz quando os números mudam; o
//    diagnóstico não. Escrito, congela até a semana seguinte — o texto que a
//    pessoa leu na segunda é o mesmo que ela encontra na quarta.
// 2. SEGUNDA À TARDE. A semana fecha domingo à meia-noite, mas os posts de
//    domingo ainda estão sendo lidos na madrugada. O diagnóstico espera
//    `DIAGNOSIS_DELAY_HOURS` depois do fechamento.
// 3. NUNCA TELA VAZIA À TOA. Enquanto o novo não sai, a tela mostra o último
//    pronto com a data dele; se a escrita falhar, tenta de novo sozinha.

import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { loadMcpCreatorMap } from "@/app/lib/mcp/creatorMap";
import CreatorWeeklyReport, { type ICreatorWeeklyDiagnosis } from "@/app/models/CreatorWeeklyReport";
import ContentReadingState from "@/app/models/ContentReadingState";
import {
  buildDiagnosisFacts,
  diagnosisSampleLine,
  isDiagnosisEligible,
  type DiagnosisMapInput,
} from "./diagnosisFacts";
import { DIAGNOSIS_PROMPT_VERSION, writeDiagnosis, type DiagnosisGenerate } from "./diagnosisWriter";
import { isCreatorWeeklyDiagnosisEnabled } from "./diagnosisFlag";
import { enqueueWeeklyDiagnosis } from "./queue";
import type {
  CreatorWeeklyDiagnosisEntry,
  CreatorWeeklyDiagnosisView,
  CreatorWeeklyReportPayload,
} from "./types";

/** Horas depois do fechamento da semana (domingo 23:59, horário de Brasília). */
export const DIAGNOSIS_DELAY_HOURS = 12;
/** Tentativas por semana antes de desistir até a semana seguinte. */
export const DIAGNOSIS_MAX_ATTEMPTS = 6;
/** Espera entre uma falha e a tentativa seguinte. */
export const DIAGNOSIS_RETRY_AFTER_MS = 2 * 3_600_000;
/** Uma escrita presa por mais que isso (processo morto) pode ser retomada. */
export const DIAGNOSIS_STALE_WRITING_MS = 10 * 60_000;

type StoredDiagnosis = Partial<ICreatorWeeklyDiagnosis> | null | undefined;

export function diagnosisDueAt(periodEndsAt: string | Date): Date {
  return new Date(new Date(periodEndsAt).getTime() + DIAGNOSIS_DELAY_HOURS * 3_600_000);
}

function time(value: Date | string | null | undefined): number {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Pode tentar escrever agora? Mesma regra para o pedido na fila e para a trava no banco. */
export function canAttemptDiagnosis(diagnosis: StoredDiagnosis, now: Date): boolean {
  if (!diagnosis) return true;
  if (diagnosis.status === "ready") return false;
  if ((diagnosis.attempts ?? 0) >= DIAGNOSIS_MAX_ATTEMPTS) return false;
  const since = now.getTime() - time(diagnosis.attemptedAt);
  if (diagnosis.status === "writing") return since >= DIAGNOSIS_STALE_WRITING_MS;
  return since >= DIAGNOSIS_RETRY_AFTER_MS;
}

/**
 * O Gemini pausado (sem saldo, limite) não gasta tentativa: a semana espera o
 * provedor voltar, em vez de queimar as tentativas batendo na mesma recusa.
 * Mesma regra da leitura de cena (`enqueuePublishedReading`).
 */
async function isProviderPaused(now: Date): Promise<boolean> {
  const provider = await ContentReadingState.findById("provider:gemini").select("state nextAttemptAt").lean();
  return Boolean(provider && provider.state !== "healthy" && provider.nextAttemptAt && new Date(provider.nextAttemptAt) > now);
}

function toEntry(
  weekKey: string,
  rangeLabel: string,
  diagnosis: StoredDiagnosis,
): CreatorWeeklyDiagnosisEntry | null {
  if (diagnosis?.status !== "ready" || !diagnosis.content) return null;
  return {
    ...diagnosis.content,
    weekKey,
    rangeLabel,
    sampleLine: diagnosis.sampleLine ?? "",
    writtenAt: new Date(diagnosis.writtenAt ?? diagnosis.attemptedAt ?? Date.now()).toISOString(),
  };
}

/**
 * O estado da tela a partir do que está guardado. Puro: quem chama busca os
 * documentos. `shouldEnqueue` diz se vale pôr a escrita na fila agora.
 */
export function resolveDiagnosisView(params: {
  report: CreatorWeeklyReportPayload;
  current: StoredDiagnosis;
  previous: CreatorWeeklyDiagnosisEntry | null;
  now: Date;
  providerPaused?: boolean;
}): { view: CreatorWeeklyDiagnosisView; shouldEnqueue: boolean } {
  const { report, current, previous, now } = params;
  const ready = toEntry(report.weekKey, report.period.rangeLabel, current);
  if (ready) {
    return {
      view: { state: "ready", shown: ready, upcomingRangeLabel: null, dueAt: null },
      shouldEnqueue: false,
    };
  }

  const dueAt = diagnosisDueAt(report.period.endsAt);
  const base = { shown: previous, upcomingRangeLabel: report.period.rangeLabel, dueAt: dueAt.toISOString() };

  if (!isDiagnosisEligible(report)) {
    return { view: { ...base, state: "unavailable", upcomingRangeLabel: null, dueAt: null }, shouldEnqueue: false };
  }
  if (now < dueAt) {
    return { view: { ...base, state: "waiting" }, shouldEnqueue: false };
  }
  if (current?.status === "failed" && (current.attempts ?? 0) >= DIAGNOSIS_MAX_ATTEMPTS) {
    return { view: { ...base, state: "missed" }, shouldEnqueue: false };
  }
  if (params.providerPaused) {
    return { view: { ...base, state: "delayed" }, shouldEnqueue: false };
  }
  if (current?.status === "failed") {
    return { view: { ...base, state: "delayed" }, shouldEnqueue: canAttemptDiagnosis(current, now) };
  }
  return { view: { ...base, state: "writing" }, shouldEnqueue: canAttemptDiagnosis(current, now) };
}

async function latestReadyBefore(
  userId: mongoose.Types.ObjectId,
  periodEndsAt: Date,
): Promise<CreatorWeeklyDiagnosisEntry | null> {
  const document = await CreatorWeeklyReport.findOne({
    userId,
    periodEndsAt: { $lt: periodEndsAt },
    "diagnosis.status": "ready",
  })
    .sort({ periodEndsAt: -1 })
    .select("weekKey payload.period.rangeLabel diagnosis")
    .lean();
  if (!document) return null;
  return toEntry(document.weekKey, document.payload?.period?.rangeLabel ?? "", document.diagnosis);
}

/**
 * Anexa o diagnóstico ao relatório que o Perfil lê. Com o recurso desligado,
 * devolve o relatório intacto — e a tela continua nos cartões.
 */
export async function attachWeeklyDiagnosis(
  userId: string,
  report: CreatorWeeklyReportPayload,
  now: Date = new Date(),
): Promise<CreatorWeeklyReportPayload> {
  if (!isCreatorWeeklyDiagnosisEnabled() || !mongoose.Types.ObjectId.isValid(userId)) return report;
  try {
    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const document = await CreatorWeeklyReport.findOne({ userId: userObjectId, weekKey: report.weekKey })
      .select("diagnosis periodEndsAt")
      .lean();
    const periodEndsAt = document?.periodEndsAt ?? new Date(report.period.endsAt);
    const current = document?.diagnosis ?? null;
    const pending = current?.status !== "ready";
    const [previous, providerPaused] = pending
      ? await Promise.all([latestReadyBefore(userObjectId, periodEndsAt), isProviderPaused(now)])
      : [null, false];
    const { view, shouldEnqueue } = resolveDiagnosisView({ report, current, previous, now, providerPaused });
    if (shouldEnqueue) {
      void enqueueWeeklyDiagnosis(userId, report.weekKey).catch(() => false);
    }
    return { ...report, diagnosis: view };
  } catch (error) {
    logger.warn("[perfil][diagnostico] falha ao anexar", { userId, error: String(error) });
    return { ...report, diagnosis: { state: "delayed", shown: null, upcomingRangeLabel: report.period.rangeLabel, dueAt: null } };
  }
}

/**
 * Depois do relatório, agenda a escrita para a hora certa. Chamado pelo
 * trabalho de segunda de madrugada: o pedido fica guardado na fila até a tarde.
 */
export async function scheduleWeeklyDiagnosis(
  userId: string,
  report: CreatorWeeklyReportPayload,
  now: Date = new Date(),
): Promise<boolean> {
  if (!isCreatorWeeklyDiagnosisEnabled() || !isDiagnosisEligible(report)) return false;
  await connectToDatabase();
  const document = await CreatorWeeklyReport.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    weekKey: report.weekKey,
  })
    .select("diagnosis")
    .lean();
  if (!canAttemptDiagnosis(document?.diagnosis, now)) return false;
  // Pausado agora não impede agendar: até segunda à tarde o saldo pode voltar,
  // e o trabalho confere de novo na hora de escrever.
  const waitSeconds = (diagnosisDueAt(report.period.endsAt).getTime() - now.getTime()) / 1000;
  return enqueueWeeklyDiagnosis(userId, report.weekKey, waitSeconds);
}

async function loadDiagnosisMap(userId: string): Promise<DiagnosisMapInput | null> {
  const map = await loadMcpCreatorMap(userId);
  if (!map.hasMap) return null;
  return {
    narrative: map.narrative,
    narrativeIsFirm: map.narrativeIsFirm,
    territories: map.territories,
    assets: map.assets,
    tone: map.tone,
  };
}

export type EnsureDiagnosisResult =
  | "ready"
  | "written"
  | "failed"
  | "busy"
  | "paused"
  | "not_due"
  | "ineligible"
  | "no_report"
  | "disabled";

/**
 * Escreve o diagnóstico de uma semana, se ainda não existe. Idempotente: pode ser
 * chamado quantas vezes for — a trava no banco garante uma escrita por vez e o
 * texto pronto nunca é reescrito (salvo `force`, para o comando de operação).
 */
export async function ensureWeeklyDiagnosis(params: {
  userId: string;
  weekKey: string;
  now?: Date;
  force?: boolean;
  generate?: DiagnosisGenerate;
}): Promise<EnsureDiagnosisResult> {
  if (!params.force && !isCreatorWeeklyDiagnosisEnabled()) return "disabled";
  if (!mongoose.Types.ObjectId.isValid(params.userId)) return "no_report";
  const now = params.now ?? new Date();
  await connectToDatabase();
  const userObjectId = new mongoose.Types.ObjectId(params.userId);

  const document = await CreatorWeeklyReport.findOne({ userId: userObjectId, weekKey: params.weekKey }).lean();
  if (!document) return "no_report";
  const report = document.payload;
  if (!params.force && document.diagnosis?.status === "ready") return "ready";
  if (!isDiagnosisEligible(report)) return "ineligible";
  if (!params.force && now < diagnosisDueAt(document.periodEndsAt)) return "not_due";
  if (!params.force && !canAttemptDiagnosis(document.diagnosis, now)) return "busy";
  if (!params.force && await isProviderPaused(now)) return "paused";

  const previousDiagnosis = document.diagnosis ?? null;
  const writing: ICreatorWeeklyDiagnosis = {
    status: "writing",
    attempts: params.force ? 1 : (previousDiagnosis?.attempts ?? 0) + 1,
    attemptedAt: now,
    writtenAt: null,
    safeErrorCode: null,
    content: null,
    sampleLine: null,
    facts: null,
    promptVersion: DIAGNOSIS_PROMPT_VERSION,
    provider: null,
    model: null,
  };
  // A trava: só um processo passa daqui por vez. O filtro repete o estado que
  // acabou de ser lido — se outro trabalho mudou o diagnóstico nesse meio tempo,
  // nenhum documento casa e este desiste.
  const claimed = await CreatorWeeklyReport.findOneAndUpdate(
    params.force
      ? { _id: document._id }
      : {
          _id: document._id,
          ...(previousDiagnosis
            ? { "diagnosis.status": previousDiagnosis.status, "diagnosis.attemptedAt": previousDiagnosis.attemptedAt }
            : { diagnosis: null }),
        },
    { $set: { diagnosis: writing } },
    { new: true },
  ).lean();
  if (!claimed) return "busy";

  let facts: ReturnType<typeof buildDiagnosisFacts> | null = null;
  try {
    const [map, previous] = await Promise.all([
      loadDiagnosisMap(params.userId),
      latestReadyBefore(userObjectId, document.periodEndsAt),
    ]);
    facts = buildDiagnosisFacts({ report, map, previousHeadline: previous?.headline ?? null, now });
    const result = await writeDiagnosis(facts, params.generate);
    if (result.ok) {
      await CreatorWeeklyReport.updateOne(
        { _id: document._id },
        {
          $set: {
            diagnosis: {
              ...writing,
              status: "ready",
              writtenAt: new Date(),
              content: result.content,
              sampleLine: diagnosisSampleLine(report.coverage),
              facts,
              provider: result.provider,
              model: result.model,
            } satisfies ICreatorWeeklyDiagnosis,
          },
        },
      );
      return "written";
    }
    logger.warn("[perfil][diagnostico] escrita recusada", {
      userId: params.userId,
      weekKey: params.weekKey,
      safeErrorCode: result.safeErrorCode,
      problems: result.problems,
    });
    await markFailed(document._id, writing, result.safeErrorCode, facts);
    return "failed";
  } catch (error) {
    logger.warn("[perfil][diagnostico] falha ao escrever", { userId: params.userId, weekKey: params.weekKey, error: String(error) });
    await markFailed(document._id, writing, "diagnosis_unexpected_error", facts);
    return "failed";
  }
}

async function markFailed(
  id: unknown,
  writing: ICreatorWeeklyDiagnosis,
  safeErrorCode: string,
  facts: unknown,
) {
  await CreatorWeeklyReport.updateOne(
    { _id: id, "diagnosis.status": "writing", "diagnosis.attemptedAt": writing.attemptedAt },
    { $set: { diagnosis: { ...writing, status: "failed", safeErrorCode, facts } } },
  ).catch(() => undefined);
}
