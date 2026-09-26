import type { ProfileEvolution } from './evolution';
export const CREATOR_WEEKLY_REPORT_SCHEMA_VERSION = 2;

export type CreatorWeeklyReportStatus =
  | "queued"
  | "generating"
  | "ready"
  | "partial"
  | "failed";

export type CreatorWeeklyReportEvidence = "indicio" | "sinal" | "tendencia";

export type CreatorWeeklyReportDetailId =
  | "timing"
  | "scene"
  | "subjects"
  | "openings";

export interface CreatorWeeklyReportRankItem {
  score?: number;
  consistent?: boolean;
  candidateConsistent?: boolean;
  postId?: string;
  postLink?: string | null;
  publishedAt?: string;
  comparisonMetric?: 'shares' | 'saved' | 'views';
  id: string;
  label: string;
  nPosts: number;
  index: number | null;
  evidence: CreatorWeeklyReportEvidence;
  weeklyOccurrences: number;
}

export interface CreatorWeeklyReportRankGroup {
  grouping?: { version: string; source: string; confidence: 'descriptive' };
  id: string;
  title: string;
  subtitle: string;
  items: CreatorWeeklyReportRankItem[];
  /** Posts distintos lidos nesta dimensão. Somar `nPosts` das opções inflaria:
   *  um post entra em várias opções (18 posts viravam "59 posts lidos"). */
  analysedPosts?: number;
}

export interface CreatorWeeklyReportDetail {
  id: CreatorWeeklyReportDetailId;
  title: string;
  subtitle: string;
  summary: string;
  interpretation: string | null;
  coverageLabel: string;
  groups: CreatorWeeklyReportRankGroup[];
}

export interface CreatorWeeklyReportVideo {
  postId: string | null;
  postLink: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  description: string;
  views: number | null;
  saved: number | null;
  shares: number | null;
  performanceIndex: number | null;
  openingLine: string | null;
  subject: string | null;
  place: string | null;
}

export interface CreatorWeeklyReportPayload {
  policyVersion?: string;
  evolution?: ProfileEvolution;
  schemaVersion: number;
  weekKey: string;
  period: {
    startsAt: string;
    endsAt: string;
    rangeLabel: string;
  };
  status: CreatorWeeklyReportStatus;
  generatedAt: string;
  sourceMetricsUpdatedAt: string | null;
  coverage: {
    posts90d: number;
    postsWeek: number;
    postsWithScene: number;
    scenePercent: number;
  };
  overview: {
    summary: string;
    numbers: Array<{ value: string; label: string }>;
    observedSubjects: string[];
  };
  weeklyVideo: CreatorWeeklyReportVideo | null;
  details: CreatorWeeklyReportDetail[];
  /**
   * O diagnóstico da semana, quando o recurso está ligado. Não sai do motor:
   * é escrito uma vez por semana e anexado na leitura (`diagnosisService.ts`).
   * Ausente = recurso desligado, e o Perfil mostra os cartões de padrão.
   */
  diagnosis?: CreatorWeeklyDiagnosisView;
}

/** O que o modelo escreve. O resto do diagnóstico é calculado. */
export interface CreatorWeeklyDiagnosisContent {
  /** Uma frase: o que a semana diz sobre a conta. */
  headline: string;
  /** Dois ou três parágrafos curtos, com o número sempre ao lado da amostra. */
  paragraphs: string[];
  /** Uma ação para a semana seguinte, que responde à pergunta aberta. */
  nextTest: string;
  /** A pergunta que fica em aberto — o gancho para continuar a conversa. */
  question: string;
}

/** Um diagnóstico pronto, como a tela recebe. */
export interface CreatorWeeklyDiagnosisEntry extends CreatorWeeklyDiagnosisContent {
  weekKey: string;
  rangeLabel: string;
  /** "12 de 18 posts lidos · comparado com os seus últimos 90 dias". Calculada, nunca escrita pelo modelo. */
  sampleLine: string;
  writtenAt: string;
}

/**
 * - `ready`: o diagnóstico da última semana fechada está pronto.
 * - `waiting`: a semana fechou, mas o diagnóstico só é escrito depois de `dueAt`.
 * - `writing`: já passou da hora e ele está na fila ou sendo escrito.
 * - `delayed`: a escrita falhou ou o provedor está pausado; volta a tentar sozinho.
 * - `missed`: as tentativas da semana acabaram; o próximo sai na segunda.
 * - `unavailable`: ainda não há posts suficientes para comparar.
 */
export type CreatorWeeklyDiagnosisState = "ready" | "waiting" | "writing" | "delayed" | "missed" | "unavailable";

export interface CreatorWeeklyDiagnosisView {
  state: CreatorWeeklyDiagnosisState;
  /** O diagnóstico em tela: o da semana, ou o último pronto enquanto o novo não sai. */
  shown: CreatorWeeklyDiagnosisEntry | null;
  /** Semana cujo diagnóstico ainda não saiu. Nulo quando `state` é `ready`. */
  upcomingRangeLabel: string | null;
  dueAt: string | null;
}

export interface CreatorWeeklyReportDocumentSnapshot {
  id: string;
  userId: string;
  report: CreatorWeeklyReportPayload;
  createdAt: string;
  updatedAt: string;
}

export function isCreatorWeeklyReportReady(
  report: CreatorWeeklyReportPayload | null | undefined,
): report is CreatorWeeklyReportPayload {
  return report?.status === "ready" || report?.status === "partial";
}
