/** @jest-environment node */
import { CREATOR_WEEKLY_REPORT_DEMO } from "./demoReport";
import {
  DIAGNOSIS_MAX_ATTEMPTS,
  canAttemptDiagnosis,
  diagnosisDueAt,
  resolveDiagnosisView,
} from "./diagnosisService";
import type { CreatorWeeklyDiagnosisEntry } from "./types";

jest.mock("./queue", () => ({ enqueueWeeklyDiagnosis: jest.fn() }));
jest.mock("@/app/lib/mcp/creatorMap", () => ({ loadMcpCreatorMap: jest.fn() }));
jest.mock("@/app/models/ContentReadingState", () => ({ __esModule: true, default: { findById: jest.fn() } }));

const REPORT = CREATOR_WEEKLY_REPORT_DEMO; // semana fecha em 2026-08-10T02:59:59.999Z
const DUE = diagnosisDueAt(REPORT.period.endsAt);
const BEFORE = new Date(DUE.getTime() - 60_000);
const AFTER = new Date(DUE.getTime() + 60_000);

const CONTENT = {
  headline: "Manchete",
  paragraphs: ["Um.", "Dois."],
  nextTest: "Teste.",
  question: "Pergunta?",
};

const PREVIOUS: CreatorWeeklyDiagnosisEntry = {
  ...CONTENT,
  headline: "A da semana anterior",
  weekKey: "2026-W31",
  rangeLabel: "28 de julho a 3 de agosto",
  sampleLine: "10 de 12 posts lidos · comparado com os seus últimos 90 dias",
  writtenAt: "2026-08-04T15:00:00.000Z",
};

describe("diagnosisService — regras de tempo e tentativa", () => {
  it("escreve 12 horas depois do fechamento da semana (meio-dia de segunda em Brasília)", () => {
    expect(DUE.toISOString()).toBe("2026-08-10T14:59:59.999Z");
  });

  it("não reescreve o que está pronto e respeita o limite de tentativas", () => {
    const now = AFTER;
    expect(canAttemptDiagnosis(null, now)).toBe(true);
    expect(canAttemptDiagnosis({ status: "ready", attempts: 1, attemptedAt: now }, now)).toBe(false);
    expect(canAttemptDiagnosis({ status: "failed", attempts: DIAGNOSIS_MAX_ATTEMPTS, attemptedAt: new Date(0) }, now)).toBe(false);
  });

  it("espera entre falhas e retoma escrita presa", () => {
    const now = AFTER;
    const recent = new Date(now.getTime() - 60_000);
    const old = new Date(now.getTime() - 3 * 3_600_000);
    expect(canAttemptDiagnosis({ status: "failed", attempts: 1, attemptedAt: recent }, now)).toBe(false);
    expect(canAttemptDiagnosis({ status: "failed", attempts: 1, attemptedAt: old }, now)).toBe(true);
    expect(canAttemptDiagnosis({ status: "writing", attempts: 1, attemptedAt: recent }, now)).toBe(false);
    expect(canAttemptDiagnosis({ status: "writing", attempts: 1, attemptedAt: old }, now)).toBe(true);
  });
});

describe("resolveDiagnosisView", () => {
  it("mostra o da semana quando está pronto", () => {
    const { view, shouldEnqueue } = resolveDiagnosisView({
      report: REPORT,
      current: { status: "ready", attempts: 1, attemptedAt: AFTER, writtenAt: AFTER, content: CONTENT, sampleLine: "x" },
      previous: PREVIOUS,
      now: AFTER,
    });
    expect(view.state).toBe("ready");
    expect(view.shown?.headline).toBe("Manchete");
    expect(view.shown?.rangeLabel).toBe(REPORT.period.rangeLabel);
    expect(shouldEnqueue).toBe(false);
  });

  it("antes da hora, mostra o anterior e diz quando sai o novo", () => {
    const { view, shouldEnqueue } = resolveDiagnosisView({ report: REPORT, current: null, previous: PREVIOUS, now: BEFORE });
    expect(view).toEqual({
      state: "waiting",
      shown: PREVIOUS,
      upcomingRangeLabel: REPORT.period.rangeLabel,
      dueAt: DUE.toISOString(),
    });
    expect(shouldEnqueue).toBe(false);
  });

  it("depois da hora, sem texto, põe na fila e avisa que está escrevendo", () => {
    const { view, shouldEnqueue } = resolveDiagnosisView({ report: REPORT, current: null, previous: null, now: AFTER });
    expect(view.state).toBe("writing");
    expect(view.shown).toBeNull();
    expect(shouldEnqueue).toBe(true);
  });

  it("falha recente vira atraso, sem nova fila até a espera passar", () => {
    const { view, shouldEnqueue } = resolveDiagnosisView({
      report: REPORT,
      current: { status: "failed", attempts: 1, attemptedAt: AFTER },
      previous: PREVIOUS,
      now: AFTER,
    });
    expect(view.state).toBe("delayed");
    expect(view.shown).toBe(PREVIOUS);
    expect(shouldEnqueue).toBe(false);
  });

  it("tentativas esgotadas dizem que a semana não saiu, sem prometer nova tentativa", () => {
    const { view, shouldEnqueue } = resolveDiagnosisView({
      report: REPORT,
      current: { status: "failed", attempts: DIAGNOSIS_MAX_ATTEMPTS, attemptedAt: new Date(0) },
      previous: PREVIOUS,
      now: AFTER,
    });
    expect(view.state).toBe("missed");
    expect(shouldEnqueue).toBe(false);
  });

  it("com o Gemini pausado, avisa o atraso e não gasta tentativa", () => {
    const { view, shouldEnqueue } = resolveDiagnosisView({
      report: REPORT,
      current: null,
      previous: PREVIOUS,
      now: AFTER,
      providerPaused: true,
    });
    expect(view.state).toBe("delayed");
    expect(view.shown).toBe(PREVIOUS);
    expect(shouldEnqueue).toBe(false);
  });

  it("sem posts para comparar, não escreve", () => {
    const { view, shouldEnqueue } = resolveDiagnosisView({
      report: { ...REPORT, coverage: { ...REPORT.coverage, posts90d: 1 } },
      current: null,
      previous: null,
      now: AFTER,
    });
    expect(view.state).toBe("unavailable");
    expect(shouldEnqueue).toBe(false);
  });
});
