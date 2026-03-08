export type PlanningObjectiveMode = "reach" | "engagement" | "leads";
export type RecommendationFeedbackStatus = "applied" | "not_applied";
export type PlanningRecommendationQueueStage = "now" | "later" | "monitor";
export type PlanningRecommendationExecutionState = "planned" | "executed" | "waiting_impact" | "discarded";
export type RecommendationFeedbackMeta = {
  status: RecommendationFeedbackStatus;
  updatedAt?: string | null;
};

export const ALLOWED_PLANNING_OBJECTIVES: PlanningObjectiveMode[] = [
  "reach",
  "engagement",
  "leads",
];

type RecommendationConfidence = "high" | "medium" | "low";
type RecommendationSignalQuality = "high_signal" | "medium_signal" | "low_signal";
export type PlanningRecommendationType = "maintain" | "scale" | "correct" | "test";
export type RecommendationExperimentPlan = {
  hypothesis: string;
  baseline: string;
  successSignal: string;
  sampleGoal: string;
};

export type RecommendationExperimentImpactSummary = {
  status: "improved" | "declined" | "stable" | "early" | "awaiting_posts" | "insufficient_history";
  text: string;
  beforeAvg: number | null;
  afterAvg: number | null;
  deltaRatio: number | null;
  beforeCount: number;
  afterCount: number;
};

export interface PlanningRecommendationAction {
  id: string;
  feedbackKey?: string | null;
  title: string;
  action: string;
  strategicSynopsis?: string;
  recommendationType?: PlanningRecommendationType;
  observation?: string;
  meaning?: string;
  nextStep?: string;
  whatNotToDo?: string | null;
  metricLabel?: string | null;
  timeWindowLabel?: string | null;
  isProxyMetric?: boolean;
  impactEstimate: string;
  confidence: RecommendationConfidence;
  evidence: string[];
  sampleSize?: number | null;
  expectedLiftRatio?: number | null;
  opportunityScore?: number | null;
  rankingScore?: number | null;
  signalQuality?: RecommendationSignalQuality;
  guardrailReason?: string | null;
  experimentPlan?: RecommendationExperimentPlan | null;
  experimentImpact?: RecommendationExperimentImpactSummary | null;
  feedbackStatus?: RecommendationFeedbackStatus | null;
  queueStage?: PlanningRecommendationQueueStage;
  executionState?: PlanningRecommendationExecutionState;
  feedbackUpdatedAt?: string | null;
}

export interface PlanningRecommendationsResult {
  objectiveMode: PlanningObjectiveMode;
  actions: PlanningRecommendationAction[];
  generatedAt: string;
}

type TimeSlot = {
  dayOfWeek: number;
  hour: number;
  average: number;
  count?: number;
};

type DurationBucket = {
  key: string;
  label: string;
  postsCount: number;
  averageInteractions: number;
};

type CategoryBar = {
  name: string;
  value: number;
  postsCount?: number;
};

type RecommendationInputs = {
  objectiveMode: PlanningObjectiveMode;
  trendData?: any;
  timeData?: any;
  durationData?: any;
  timingBenchmark?: any;
  formatData?: any;
  proposalData?: any;
  toneData?: any;
  contextData?: any;
  feedbackByActionId?: Record<string, RecommendationFeedbackStatus>;
  feedbackMetaByActionId?: Record<string, RecommendationFeedbackMeta>;
};

type RecommendationDraft = Omit<
  PlanningRecommendationAction,
  "opportunityScore" | "signalQuality" | "guardrailReason"
> & {
  guardrailReason?: string | null;
};

type RecommendationMetricContext = {
  objectiveMode: PlanningObjectiveMode;
  primaryMetricLabel: string;
  categoryMetricLabel: string;
  metricUnitLabel: string;
  metricShortLabel: string;
  trendWindowLabel: string;
};

type ResolvedTimeSlot = {
  dayOfWeek: number;
  hour: number;
  average: number;
  smoothedAverage: number;
  priorAverage: number;
  sampleSize: number;
};

type ResolvedDurationBucket = {
  key: string;
  label: string;
  averageInteractions: number;
  smoothedAverage: number;
  priorAverage: number;
  sampleSize: number;
};

type ResolvedCategory = {
  name: string;
  value: number;
  smoothedValue: number;
  priorValue: number;
  sampleSize: number;
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const BAYESIAN_PRIOR_WEIGHT = 5;
const LOW_SAMPLE_THRESHOLD = 5;

const WEEKDAY_LABELS: Record<number, string> = {
  1: "domingo",
  2: "segunda",
  3: "terça",
  4: "quarta",
  5: "quinta",
  6: "sexta",
  7: "sábado",
};

function getRecommendationMetricContext(objectiveMode: PlanningObjectiveMode): RecommendationMetricContext {
  if (objectiveMode === "reach") {
    return {
      objectiveMode,
      primaryMetricLabel: "Alcance por post",
      categoryMetricLabel: "Alcance por post na categoria",
      metricUnitLabel: "pessoas alcançadas por post",
      metricShortLabel: "alcance",
      trendWindowLabel: "Bloco recente vs. bloco anterior",
    };
  }

  if (objectiveMode === "leads") {
    return {
      objectiveMode,
      primaryMetricLabel: "Intenção de lead por 1 mil alcançadas",
      categoryMetricLabel: "Intenção de lead por categoria",
      metricUnitLabel: "índice de intenção",
      metricShortLabel: "intenção de lead",
      trendWindowLabel: "Período selecionado",
    };
  }

  return {
    objectiveMode,
    primaryMetricLabel: "Interações por post",
    categoryMetricLabel: "Interações por post na categoria",
    metricUnitLabel: "interações por post",
    metricShortLabel: "interações",
    trendWindowLabel: "Bloco recente vs. bloco anterior",
  };
}

function formatMetricValue(value: number, objectiveMode: PlanningObjectiveMode): string {
  if (!Number.isFinite(value)) return "0";
  if (objectiveMode === "leads") return value.toFixed(value >= 10 ? 1 : 2).replace(".", ",");
  return numberFormatter.format(Math.round(value));
}

function suggestedExperimentSample(sampleSize?: number | null): number {
  const n = typeof sampleSize === "number" && Number.isFinite(sampleSize) ? sampleSize : 0;
  if (n >= 10) return 3;
  if (n >= 5) return 4;
  return 5;
}

function buildExperimentPlan(params: {
  sampleSize?: number | null;
  metricLabel: string;
  baseline: string;
  hypothesis: string;
  expectedLiftRatio?: number | null;
}): RecommendationExperimentPlan {
  const sampleGoal = suggestedExperimentSample(params.sampleSize);
  const liftText =
    typeof params.expectedLiftRatio === "number" && Number.isFinite(params.expectedLiftRatio) && Math.abs(params.expectedLiftRatio) >= 0.03
      ? `${params.expectedLiftRatio >= 0 ? "+" : ""}${toPercent(params.expectedLiftRatio)}`
      : null;

  return {
    hypothesis: params.hypothesis,
    baseline: params.baseline,
    successSignal: liftText
      ? `Considere sucesso se ${params.metricLabel.toLowerCase()} subir cerca de ${liftText} ou sustentar esse ganho por mais de um post.`
      : `Considere sucesso se ${params.metricLabel.toLowerCase()} ficar acima do seu padrão atual com menos oscilação.`,
    sampleGoal: `Valide com ${numberFormatter.format(sampleGoal)} publicações comparáveis antes de concluir.`,
  };
}

function typeFromLift(liftRatio?: number | null): PlanningRecommendationType {
  if (typeof liftRatio !== "number" || !Number.isFinite(liftRatio)) return "test";
  if (liftRatio >= 0.12) return "scale";
  if (liftRatio >= 0.03) return "maintain";
  return "test";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asPositiveNumber(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function asNonNegativeNumber(value: unknown): number {
  const parsed = asNumber(value);
  if (parsed === null || parsed < 0) return 0;
  return parsed;
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function confidenceFromSample(sampleSize?: number | null): RecommendationConfidence {
  const n = typeof sampleSize === "number" && Number.isFinite(sampleSize) ? sampleSize : 0;
  if (n >= 10) return "high";
  if (n >= 5) return "medium";
  return "low";
}

function signalQualityFromSample(sampleSize?: number | null): RecommendationSignalQuality {
  const n = typeof sampleSize === "number" && Number.isFinite(sampleSize) ? sampleSize : 0;
  if (n >= 12) return "high_signal";
  if (n >= 6) return "medium_signal";
  return "low_signal";
}

function shrinkAverage(observed: number, sampleSize: number, prior: number, priorWeight = BAYESIAN_PRIOR_WEIGHT): number {
  const n = Math.max(0, sampleSize);
  const safeObserved = Number.isFinite(observed) ? observed : 0;
  const safePrior = Number.isFinite(prior) ? prior : 0;
  if (n === 0) return safePrior;
  return (n / (n + priorWeight)) * safeObserved + (priorWeight / (n + priorWeight)) * safePrior;
}

function computePriorAverage(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizeExpectedLift(value?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.08;
  return Math.min(Math.abs(value), 1.5);
}

function sampleWeight(sampleSize?: number | null): number {
  const n = typeof sampleSize === "number" && Number.isFinite(sampleSize) ? sampleSize : 0;
  if (n >= 15) return 1;
  if (n >= 8) return 0.82;
  if (n >= 5) return 0.7;
  if (n >= 3) return 0.55;
  if (n >= 1) return 0.4;
  return 0.3;
}

function confidenceWeight(confidence: RecommendationConfidence): number {
  if (confidence === "high") return 1;
  if (confidence === "medium") return 0.72;
  return 0.45;
}

function buildOpportunityScore(
  expectedLiftRatio: number | null | undefined,
  confidence: RecommendationConfidence,
  sampleSize: number | null | undefined
): number {
  const lift = normalizeExpectedLift(expectedLiftRatio);
  const score = (0.55 + lift) * confidenceWeight(confidence) * sampleWeight(sampleSize) * 100;
  return Number(score.toFixed(1));
}

function normalizeActionId(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeVariant(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function buildFeedbackKey(baseId: string, variant?: string | null): string {
  const base = normalizeActionId(baseId);
  const normalizedVariant = normalizeVariant(variant || "");
  if (!normalizedVariant) return base;
  return `${base}:${normalizedVariant}`;
}

function feedbackWeight(status?: RecommendationFeedbackStatus | null): number {
  if (status === "applied") return 0.62;
  if (status === "not_applied") return 1.14;
  return 1;
}

function scoreWithFeedback(
  baseScore: number | null | undefined,
  status?: RecommendationFeedbackStatus | null
): number {
  const safeBase = typeof baseScore === "number" && Number.isFinite(baseScore) ? baseScore : 0;
  const adjusted = safeBase * feedbackWeight(status);
  return Number(adjusted.toFixed(1));
}

function toValidDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveRecommendationExecutionState(
  feedbackStatus?: RecommendationFeedbackStatus | null,
  feedbackUpdatedAt?: string | null,
  referenceDate = new Date()
): PlanningRecommendationExecutionState {
  if (feedbackStatus === "not_applied") return "discarded";
  if (feedbackStatus !== "applied") return "planned";
  const updatedAt = toValidDate(feedbackUpdatedAt);
  if (!updatedAt) return "waiting_impact";
  const elapsedMs = Math.max(0, referenceDate.getTime() - updatedAt.getTime());
  const recentWindowMs = 48 * 60 * 60 * 1000;
  return elapsedMs <= recentWindowMs ? "executed" : "waiting_impact";
}

export function resolveRecommendationQueueStage(params: {
  executionState: PlanningRecommendationExecutionState;
  pendingIndex: number;
  recommendationType?: PlanningRecommendationType;
}): PlanningRecommendationQueueStage {
  const { executionState, pendingIndex, recommendationType } = params;
  if (executionState === "discarded" || executionState === "waiting_impact" || executionState === "executed") {
    return "monitor";
  }
  if (pendingIndex <= 0) return "now";
  if (pendingIndex === 1) return "later";
  if (recommendationType === "correct") return "later";
  return "monitor";
}

function withRecommendationIntelligence(draft: RecommendationDraft): PlanningRecommendationAction {
  const sampleSize = typeof draft.sampleSize === "number" && Number.isFinite(draft.sampleSize)
    ? Math.max(0, Math.round(draft.sampleSize))
    : null;
  const forcedLowConfidence = typeof sampleSize === "number" && sampleSize > 0 && sampleSize < LOW_SAMPLE_THRESHOLD;
  const confidence: RecommendationConfidence = forcedLowConfidence ? "low" : draft.confidence;
  const guardrailReason = draft.guardrailReason || (forcedLowConfidence ? "Amostra baixa para recomendação forte." : null);

  return {
    ...draft,
    confidence,
    sampleSize,
    signalQuality: signalQualityFromSample(sampleSize),
    guardrailReason,
    opportunityScore: buildOpportunityScore(draft.expectedLiftRatio, confidence, sampleSize),
  };
}

function resolveBestTimeSlot(timeData?: any): ResolvedTimeSlot | null {
  const bucketsRaw = Array.isArray(timeData?.buckets) ? (timeData.buckets as TimeSlot[]) : [];
  const normalized = bucketsRaw
    .map((bucket) => {
      const dayOfWeek = asNumber(bucket?.dayOfWeek);
      const hour = asNumber(bucket?.hour);
      const average = asNonNegativeNumber(bucket?.average);
      const sampleSize = Math.max(0, Math.round(asNonNegativeNumber(bucket?.count)));
      if (dayOfWeek === null || hour === null) return null;
      return { dayOfWeek, hour, average, sampleSize };
    })
    .filter(Boolean) as Array<{ dayOfWeek: number; hour: number; average: number; sampleSize: number }>;

  if (!normalized.length) {
    const best = Array.isArray(timeData?.bestSlots) ? timeData.bestSlots[0] : null;
    if (!best) return null;
    const dayOfWeek = asNumber(best?.dayOfWeek);
    const hour = asNumber(best?.hour);
    const average = asNonNegativeNumber(best?.average);
    if (dayOfWeek === null || hour === null) return null;
    return {
      dayOfWeek,
      hour,
      average,
      smoothedAverage: average,
      priorAverage: average,
      sampleSize: Math.max(0, Math.round(asNonNegativeNumber(best?.count))),
    };
  }

  const priorAverage = computePriorAverage(normalized.map((bucket) => bucket.average));
  const withSmoothed = normalized.map((bucket) => ({
    ...bucket,
    smoothedAverage: shrinkAverage(bucket.average, bucket.sampleSize, priorAverage),
    priorAverage,
  }));

  return withSmoothed
    .slice()
    .sort((a, b) => b.smoothedAverage - a.smoothedAverage)[0] || null;
}

function estimateTimeLift(bestSlot?: ResolvedTimeSlot | null): number | null {
  if (!bestSlot || bestSlot.priorAverage <= 0) return null;
  return (bestSlot.smoothedAverage - bestSlot.priorAverage) / bestSlot.priorAverage;
}

function resolveBestDuration(durationData?: any): ResolvedDurationBucket | null {
  const buckets = Array.isArray(durationData?.buckets) ? (durationData.buckets as DurationBucket[]) : [];
  const withData = buckets
    .map((bucket) => {
      const averageInteractions = asNonNegativeNumber(bucket?.averageInteractions);
      const sampleSize = Math.max(0, Math.round(asNonNegativeNumber(bucket?.postsCount)));
      if (!bucket?.label || sampleSize <= 0) return null;
      return {
        key: String(bucket.key || ""),
        label: bucket.label,
        averageInteractions,
        sampleSize,
      };
    })
    .filter(Boolean) as Array<{ key: string; label: string; averageInteractions: number; sampleSize: number }>;

  if (!withData.length) return null;
  const priorAverage = computePriorAverage(withData.map((row) => row.averageInteractions));
  const withSmoothed = withData.map((row) => ({
    ...row,
    smoothedAverage: shrinkAverage(row.averageInteractions, row.sampleSize, priorAverage),
    priorAverage,
  }));
  return withSmoothed
    .slice()
    .sort((a, b) => b.smoothedAverage - a.smoothedAverage)[0] || null;
}

function resolveTopCategory(chartData?: any): ResolvedCategory | null {
  const rows = Array.isArray(chartData) ? (chartData as CategoryBar[]) : [];
  const withData = rows
    .map((row) => {
      const name = String(row?.name || "").trim();
      if (!name) return null;
      const value = asNonNegativeNumber(row?.value);
      const sampleSize = Math.max(0, Math.round(asNonNegativeNumber(row?.postsCount)));
      return { name, value, sampleSize };
    })
    .filter(Boolean) as Array<{ name: string; value: number; sampleSize: number }>;
  if (!withData.length) return null;

  const priorValue = computePriorAverage(withData.map((row) => row.value));
  const withSmoothed = withData.map((row) => ({
    ...row,
    smoothedValue: shrinkAverage(row.value, row.sampleSize, priorValue),
    priorValue,
  }));
  return withSmoothed
    .slice()
    .sort((a, b) => b.smoothedValue - a.smoothedValue)[0] || null;
}

function resolveTrendSignal(
  trendData: any,
  objectiveMode: "reach" | "engagement"
): { direction: "up" | "down" | "flat"; deltaRatio: number; sampleSize: number } | null {
  const points = Array.isArray(trendData?.chartData) ? trendData.chartData : [];
  if (points.length < 4) return null;

  const values: number[] = points
    .map((point: any) => {
      const postsCount = asPositiveNumber(point?.postsCount) ?? 0;
      if (objectiveMode === "reach") {
        const reach = asPositiveNumber(point?.reach);
        if (reach === null) return null;
        return postsCount > 0 ? reach / postsCount : reach;
      }
      const interactions = asPositiveNumber(point?.totalInteractions ?? point?.interactions);
      if (interactions === null) return null;
      return postsCount > 0 ? interactions / postsCount : interactions;
    })
    .filter((value: number | null): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  if (values.length < 4) return null;

  const splitIndex = Math.floor(values.length / 2);
  const previousWindow = values.slice(0, splitIndex);
  const recentWindow = values.slice(splitIndex);
  if (!previousWindow.length || !recentWindow.length) return null;

  const previousAvg = previousWindow.reduce((sum, value) => sum + value, 0) / previousWindow.length;
  const recentAvg = recentWindow.reduce((sum, value) => sum + value, 0) / recentWindow.length;
  if (!previousAvg || !recentAvg) return null;

  const deltaRatio = (recentAvg - previousAvg) / previousAvg;
  if (Math.abs(deltaRatio) < 0.05) return { direction: "flat", deltaRatio, sampleSize: points.length };
  return { direction: deltaRatio > 0 ? "up" : "down", deltaRatio, sampleSize: points.length };
}

function actionTimeSlot(
  bestSlot: ResolvedTimeSlot,
  liftRatio: number | null,
  context: RecommendationMetricContext
): RecommendationDraft {
  const dayLabel = WEEKDAY_LABELS[bestSlot.dayOfWeek] || `dia ${bestSlot.dayOfWeek}`;
  const expectedLiftPercent = liftRatio !== null ? `${liftRatio >= 0 ? "+" : ""}${toPercent(liftRatio)}` : "";
  const windowLabel = `${dayLabel} às ${bestSlot.hour}h`;
  return {
    id: "time_slot",
    feedbackKey: buildFeedbackKey("time_slot", `d${bestSlot.dayOfWeek}_h${bestSlot.hour}`),
    title: "Melhor Horário",
    recommendationType: typeFromLift(liftRatio),
    strategicSynopsis: expectedLiftPercent
      ? `Publicar em ${windowLabel} tem estimativa de ${expectedLiftPercent} em ${context.primaryMetricLabel.toLowerCase()} versus sua média recente.`
      : `A janela de ${windowLabel} concentrou a melhor média de ${context.metricShortLabel} no período analisado.`,
    observation: `A janela de ${windowLabel} ficou acima da média da conta em ${context.primaryMetricLabel.toLowerCase()}.`,
    meaning: expectedLiftPercent
      ? `Quando você publica nessa faixa, a tendência é elevar ${context.primaryMetricLabel.toLowerCase()} em ${expectedLiftPercent}.`
      : `Esse horário aparece como a faixa mais estável para repetir sua melhor média sem aumentar muito o risco.`,
    action: `Concentre suas próximas publicações na janela de maior audiência (${dayLabel} às ${bestSlot.hour}h).`,
    nextStep: `Nos próximos 7 dias, publique pelo menos 2 conteúdos em ${windowLabel} antes de testar novas janelas.`,
    whatNotToDo: `Evite espalhar os próximos posts em muitos horários diferentes enquanto confirma essa hipótese.`,
    metricLabel: context.primaryMetricLabel,
    timeWindowLabel: "Últimas semanas",
    impactEstimate: expectedLiftPercent
      ? `Estimativa de ${expectedLiftPercent} em ${context.primaryMetricLabel.toLowerCase()} vs. sua média recente.`
      : `Manutenção do melhor nível de ${context.metricShortLabel} da conta.`,
    expectedLiftRatio: liftRatio,
    sampleSize: bestSlot.sampleSize,
    confidence: confidenceFromSample(bestSlot.sampleSize),
    guardrailReason: bestSlot.sampleSize > 0 && bestSlot.sampleSize < LOW_SAMPLE_THRESHOLD
      ? "Base de dados pequena para cravar este pico horário de forma definitiva."
      : null,
    experimentPlan: buildExperimentPlan({
      sampleSize: bestSlot.sampleSize,
      metricLabel: context.primaryMetricLabel,
      baseline: `Hoje sua melhor referência nessa frente é a janela de ${windowLabel}.`,
      hypothesis: `Se você concentrar posts em ${windowLabel}, ${context.primaryMetricLabel.toLowerCase()} tende a subir com mais consistência.`,
      expectedLiftRatio: liftRatio,
    }),
    evidence: [
      `Essa faixa entregou cerca de ${formatMetricValue(bestSlot.smoothedAverage || 0, context.objectiveMode)} ${context.metricUnitLabel} na média ajustada.`,
      `A leitura usa ${numberFormatter.format(bestSlot.sampleSize || 0)} publicações recentes nessa janela.`,
    ],
  };
}

function actionDuration(
  bestDuration: ResolvedDurationBucket,
  context: RecommendationMetricContext
): RecommendationDraft {
  const expectedLiftRatio = bestDuration.priorAverage > 0
    ? (bestDuration.smoothedAverage - bestDuration.priorAverage) / bestDuration.priorAverage
    : null;
  return {
    id: "duration",
    feedbackKey: buildFeedbackKey("duration", bestDuration.key || bestDuration.label),
    title: "Duração Ideal",
    recommendationType: typeFromLift(expectedLiftRatio),
    strategicSynopsis: `A faixa de ${bestDuration.label} concentrou a melhor média de ${context.metricShortLabel} entre os vídeos analisados.`,
    observation: `Vídeos entre ${bestDuration.label} ficaram acima do restante em ${context.primaryMetricLabel.toLowerCase()}.`,
    meaning: `Essa duração está ajudando o conteúdo a repetir o melhor resultado nessa métrica com mais consistência.`,
    action: `Fixe a cronometragem dos próximos vídeos estritamente dentro da faixa de ${bestDuration.label}.`,
    nextStep: `Grave os próximos 3 vídeos dentro da faixa ${bestDuration.label} e compare contra seu padrão atual.`,
    whatNotToDo: "Evite alternar vídeos curtos e longos na mesma semana se o objetivo é validar uma duração vencedora.",
    metricLabel: context.primaryMetricLabel,
    timeWindowLabel: "Período selecionado",
    impactEstimate: `Faixa projetada em torno de ${formatMetricValue(bestDuration.smoothedAverage || 0, context.objectiveMode)} ${context.metricUnitLabel}.`,
    expectedLiftRatio,
    sampleSize: bestDuration.sampleSize,
    confidence: confidenceFromSample(bestDuration.sampleSize),
    guardrailReason: bestDuration.sampleSize > 0 && bestDuration.sampleSize < LOW_SAMPLE_THRESHOLD
      ? "Poucas peças analisadas com essa exata duração, exija confirmação prática."
      : null,
    experimentPlan: buildExperimentPlan({
      sampleSize: bestDuration.sampleSize,
      metricLabel: context.primaryMetricLabel,
      baseline: `A faixa ${bestDuration.label} é sua melhor referência atual de duração.`,
      hypothesis: `Se você repetir vídeos em ${bestDuration.label}, ${context.primaryMetricLabel.toLowerCase()} tende a ficar acima do restante.`,
      expectedLiftRatio,
    }),
    evidence: [
      `Essa faixa aparece em ${numberFormatter.format(bestDuration.sampleSize || 0)} vídeos recentes.`,
      `A média ajustada ficou acima do restante quando olhamos ${context.primaryMetricLabel.toLowerCase()}.`,
    ],
  };
}

function actionCategory(
  id: string,
  title: string,
  actionPrefix: string,
  topCategory: ResolvedCategory,
  context: RecommendationMetricContext
): RecommendationDraft {
  const expectedLiftRatio = topCategory.priorValue > 0
    ? (topCategory.smoothedValue - topCategory.priorValue) / topCategory.priorValue
    : null;
  const expectedLiftPercent = expectedLiftRatio !== null ? `${expectedLiftRatio >= 0 ? "+" : ""}${toPercent(expectedLiftRatio)}` : "";
  return {
    id,
    feedbackKey: buildFeedbackKey(id, topCategory.name),
    title,
    recommendationType: typeFromLift(expectedLiftRatio),
    strategicSynopsis: expectedLiftPercent
      ? `'${topCategory.name}' ficou ${expectedLiftPercent} acima do seu baseline recente nessa leitura.`
      : `'${topCategory.name}' segue como a categoria mais segura para esta métrica no momento.`,
    observation: `${topCategory.name} apareceu acima das demais opções quando olhamos ${context.categoryMetricLabel.toLowerCase()}.`,
    meaning: expectedLiftPercent
      ? `Essa categoria está acima da sua média recente e merece prioridade agora.`
      : `Mesmo sem uma margem grande, essa categoria segue como a leitura mais estável para o próximo ciclo.`,
    action: `${actionPrefix} '${topCategory.name}' nas próximas publicações.`,
    nextStep: `Use '${topCategory.name}' em 2 a 3 publicações da próxima semana para confirmar o ganho com menos ruído.`,
    whatNotToDo: `Evite abrir muitas categorias novas antes de validar '${topCategory.name}' com repetição suficiente.`,
    metricLabel: context.categoryMetricLabel,
    timeWindowLabel: "Período selecionado",
    impactEstimate: `Média ajustada de ${formatMetricValue(topCategory.smoothedValue || 0, context.objectiveMode)} ${context.metricUnitLabel}.`,
    expectedLiftRatio,
    sampleSize: topCategory.sampleSize,
    confidence: confidenceFromSample(topCategory.sampleSize),
    guardrailReason: topCategory.sampleSize > 0 && topCategory.sampleSize < LOW_SAMPLE_THRESHOLD
      ? `Amostragem em '${topCategory.name}' não é robusta o bastante para longo prazo.`
      : null,
    experimentPlan: buildExperimentPlan({
      sampleSize: topCategory.sampleSize,
      metricLabel: context.categoryMetricLabel,
      baseline: `'${topCategory.name}' é a categoria que hoje mais se destaca nesta leitura.`,
      hypothesis: `Se você repetir '${topCategory.name}' nas próximas publicações, ${context.categoryMetricLabel.toLowerCase()} tende a seguir acima da média da conta.`,
      expectedLiftRatio,
    }),
    evidence: [
      `'${topCategory.name}' liderou quando comparamos ${context.categoryMetricLabel.toLowerCase()}.`,
      `A leitura usa ${numberFormatter.format(topCategory.sampleSize || 0)} ocorrências dessa categoria.`,
      "O ranking foi ajustado para reduzir o peso de amostras pequenas.",
    ],
  };
}

function actionTrendRecovery(
  signal: { direction: "up" | "down" | "flat"; deltaRatio: number; sampleSize: number },
  context: RecommendationMetricContext
): RecommendationDraft {
  if (signal.direction === "down") {
    return {
      id: "trend_recovery",
      feedbackKey: buildFeedbackKey("trend_recovery", signal.direction),
      title: "Recuperar Tração",
      recommendationType: "correct",
      strategicSynopsis: `${context.primaryMetricLabel} caiu ${toPercent(Math.abs(signal.deltaRatio))} no bloco mais recente. O melhor movimento agora é reduzir ruído e voltar ao que já funcionou.`,
      observation: `O bloco mais recente ficou abaixo do anterior em ${context.primaryMetricLabel.toLowerCase()}.`,
      meaning: `Seu conteúdo perdeu força no curto prazo e abrir novos testes agora tende a aumentar o ruído.`,
      action: "Recupere tração ignorando inovações esta semana: repita de forma sistemática o assunto com maior eficácia histórica.",
      nextStep: "Durante os próximos 7 dias, reduza experimentação e repita a tese criativa que já provou resultado.",
      whatNotToDo: "Não lance nova editoria nem mude vários elementos criativos ao mesmo tempo nesta semana.",
      metricLabel: context.primaryMetricLabel,
      timeWindowLabel: context.trendWindowLabel,
      impactEstimate: `Queda recente de ${toPercent(Math.abs(signal.deltaRatio))} em ${context.primaryMetricLabel.toLowerCase()}.`,
      expectedLiftRatio: Math.abs(signal.deltaRatio),
      sampleSize: signal.sampleSize,
      confidence: confidenceFromSample(signal.sampleSize),
      experimentPlan: buildExperimentPlan({
        sampleSize: signal.sampleSize,
        metricLabel: context.primaryMetricLabel,
        baseline: `O bloco recente caiu ${toPercent(Math.abs(signal.deltaRatio))} frente ao anterior.`,
        hypothesis: `Se você reduzir dispersão e repetir o que já funcionou, ${context.primaryMetricLabel.toLowerCase()} tende a parar de cair.`,
        expectedLiftRatio: Math.abs(signal.deltaRatio),
      }),
      evidence: [
        `A comparação entre blocos mostrou perda consistente em ${context.primaryMetricLabel.toLowerCase()}.`,
        "Quando a curva cai, reduzir dispersão costuma ser mais útil do que abrir novos testes.",
      ],
    };
  }

  if (signal.direction === "up") {
    return {
      id: "trend_scale",
      feedbackKey: buildFeedbackKey("trend_scale", signal.direction),
      title: "Escalar Tração",
      recommendationType: "scale",
      strategicSynopsis: `${context.primaryMetricLabel} subiu ${toPercent(Math.abs(signal.deltaRatio))} no bloco mais recente. Vale escalar a tese vencedora antes de abrir novos testes.`,
      observation: `O bloco mais recente superou o anterior em ${context.primaryMetricLabel.toLowerCase()}.`,
      meaning: `Há aceleração real. O melhor uso desse momento é repetir a tese vencedora antes de abrir muita novidade.`,
      action: "Amplie seu volume produtivo em mais 1 ou 2 publicações massivas usando seu formato dominante, sem alterar teses.",
      nextStep: "Aumente em 1 ou 2 posts a execução da tese atual na próxima semana, sem mexer no núcleo da mensagem.",
      whatNotToDo: "Evite trocar formato, tema e tom ao mesmo tempo enquanto a conta está acelerando.",
      metricLabel: context.primaryMetricLabel,
      timeWindowLabel: context.trendWindowLabel,
      impactEstimate: `Alta recente de +${toPercent(Math.abs(signal.deltaRatio))} em ${context.primaryMetricLabel.toLowerCase()}.`,
      expectedLiftRatio: Math.abs(signal.deltaRatio),
      sampleSize: signal.sampleSize,
      confidence: confidenceFromSample(signal.sampleSize),
      experimentPlan: buildExperimentPlan({
        sampleSize: signal.sampleSize,
        metricLabel: context.primaryMetricLabel,
        baseline: `O bloco recente já está ${toPercent(Math.abs(signal.deltaRatio))} acima do anterior.`,
        hypothesis: `Se você repetir a tese que acelerou a curva, ${context.primaryMetricLabel.toLowerCase()} tende a sustentar esse avanço.`,
        expectedLiftRatio: Math.abs(signal.deltaRatio),
      }),
      evidence: [
        `A comparação entre blocos mostrou avanço consistente em ${context.primaryMetricLabel.toLowerCase()}.`,
        "Quando a curva acelera, repetir a tese vencedora costuma capturar mais resultado do que abrir muita novidade.",
      ],
    };
  }

  return {
    id: "trend_stability",
    feedbackKey: buildFeedbackKey("trend_stability", signal.direction),
    title: "Manter Baseline",
    recommendationType: "test",
    strategicSynopsis: "Seu desempenho está estável. Isso abre espaço para um teste pequeno e controlado, sem mexer no núcleo da conta.",
    observation: `O recorte recente ficou muito próximo do bloco anterior em ${context.primaryMetricLabel.toLowerCase()}, sem variação forte.`,
    meaning: "Você está em zona estável. Isso abre espaço para testes pequenos sem comprometer o piso da conta.",
    action: "Não mude radicalmente as editorias. Aloque 15% a 20% do volume na prototipagem cautelosa de novos Hooks ou Tons Visuais.",
    nextStep: "Separe uma pequena parte do volume da próxima semana para testar um novo hook ou tom visual.",
    whatNotToDo: "Não faça uma guinada completa na editoria enquanto os dados apontam estabilidade, não saturação.",
    metricLabel: context.primaryMetricLabel,
    timeWindowLabel: context.trendWindowLabel,
    impactEstimate: "Controle da estabilidade do diagnóstico ativo.",
    expectedLiftRatio: 0.04,
    sampleSize: signal.sampleSize,
    confidence: confidenceFromSample(signal.sampleSize),
    experimentPlan: buildExperimentPlan({
      sampleSize: signal.sampleSize,
      metricLabel: context.primaryMetricLabel,
      baseline: "A conta está estável, sem alta ou queda forte neste recorte.",
      hypothesis: `Se você testar uma única variável por vez, ${context.primaryMetricLabel.toLowerCase()} pode subir sem perder estabilidade.`,
      expectedLiftRatio: 0.04,
    }),
    evidence: [
      `A comparação entre blocos mostrou estabilidade em ${context.primaryMetricLabel.toLowerCase()}.`,
      "Esse cenário permite teste pequeno e controlado sem desmontar o que já funciona.",
    ],
  };
}

function ensureMaxThree(
  actions: PlanningRecommendationAction[],
  feedbackByActionId?: Record<string, RecommendationFeedbackStatus>,
  feedbackMetaByActionId?: Record<string, RecommendationFeedbackMeta>
): PlanningRecommendationAction[] {
  const feedbackMap = feedbackByActionId || {};
  const feedbackMetaMap = feedbackMetaByActionId || {};
  const deduped = new Map<string, PlanningRecommendationAction>();
  for (const action of actions) {
    const dedupeKey = normalizeActionId(action.feedbackKey || action.id);
    if (!deduped.has(dedupeKey)) deduped.set(dedupeKey, action);
  }
  const scored = Array.from(deduped.values())
    .map((action) => {
      const feedbackKey = normalizeActionId(action.feedbackKey || action.id);
      const actionId = normalizeActionId(action.id);
      const feedbackMeta = feedbackMetaMap[feedbackKey] || feedbackMetaMap[actionId] || null;
      const feedbackStatus = feedbackMeta?.status || feedbackMap[feedbackKey] || feedbackMap[actionId] || null;
      const feedbackUpdatedAt = feedbackMeta?.updatedAt || null;
      const rankingScore = scoreWithFeedback(action.opportunityScore, feedbackStatus);
      return {
        ...action,
        feedbackStatus,
        feedbackUpdatedAt,
        rankingScore,
      };
    })
    .sort((a, b) => (b.rankingScore || b.opportunityScore || 0) - (a.rankingScore || a.opportunityScore || 0));

  let pendingIndex = 0;
  const withStages = scored.map((action) => {
    const executionState = resolveRecommendationExecutionState(action.feedbackStatus, action.feedbackUpdatedAt);
    const queueStage = resolveRecommendationQueueStage({
      executionState,
      pendingIndex,
      recommendationType: action.recommendationType,
    });
    if (executionState === "planned") pendingIndex += 1;
    return {
      ...action,
      executionState,
      queueStage,
    };
  });

  return withStages.slice(0, 3);
}

export function buildPlanningRecommendations({
  objectiveMode,
  trendData,
  timeData,
  durationData,
  formatData,
  proposalData,
  toneData,
  contextData,
  feedbackByActionId,
  feedbackMetaByActionId,
}: RecommendationInputs): PlanningRecommendationsResult {
  const context = getRecommendationMetricContext(objectiveMode);
  const bestTime = resolveBestTimeSlot(timeData);
  const timeLift = estimateTimeLift(bestTime);
  const bestDuration = resolveBestDuration(durationData);
  const topFormat = resolveTopCategory(formatData?.chartData);
  const topProposal = resolveTopCategory(proposalData?.chartData);
  const topTone = resolveTopCategory(toneData?.chartData);
  const topContext = resolveTopCategory(contextData?.chartData);
  const trendSignal =
    objectiveMode === "reach"
      ? resolveTrendSignal(trendData, "reach")
      : objectiveMode === "engagement"
        ? resolveTrendSignal(trendData, "engagement")
        : null;

  const draftActions: RecommendationDraft[] = [];

  if (objectiveMode === "reach") {
    if (bestTime) draftActions.push(actionTimeSlot(bestTime, timeLift, context));
    if (topFormat) {
      draftActions.push(actionCategory("format_reach", "Aposte no formato dominante", "Priorize conteúdos no formato", topFormat, context));
    }
    if (trendSignal) draftActions.push(actionTrendRecovery(trendSignal, context));
    if (!trendSignal && topContext) {
      draftActions.push(actionCategory("context_reach", "Amplie o contexto com maior tração", "Escalone pautas de", topContext, context));
    }
  }

  if (objectiveMode === "engagement") {
    if (bestDuration) draftActions.push(actionDuration(bestDuration, context));
    if (topTone) draftActions.push(actionCategory("tone_engagement", "Use o tom com melhor resposta", "Produza conteúdos com tom", topTone, context));
    if (topProposal) {
      draftActions.push(actionCategory("proposal_engagement", "Repita a proposta vencedora", "Priorize propostas do tipo", topProposal, context));
    }
    if (draftActions.length < 3 && bestTime) draftActions.push(actionTimeSlot(bestTime, timeLift, context));
  }

  if (objectiveMode === "leads") {
    if (topProposal) {
      draftActions.push(actionCategory("proposal_leads", "Concentre no conteúdo com intenção mais forte", "Priorize propostas de", topProposal, context));
    }
    if (topContext) {
      draftActions.push(actionCategory("context_leads", "Contextualize para conversão", "Reforce conteúdos no contexto", topContext, context));
    }
    if (bestTime) draftActions.push(actionTimeSlot(bestTime, timeLift, context));
    if (draftActions.length < 3 && bestDuration) draftActions.push(actionDuration(bestDuration, context));
  }

  if (!draftActions.length) {
    draftActions.push({
      id: "baseline",
      feedbackKey: buildFeedbackKey("baseline", "default"),
      title: "Construção de Baseline",
      recommendationType: "test",
      strategicSynopsis: "Ainda há poucos dados para uma leitura forte. O próximo passo é formar uma base comparável antes de ampliar os testes.",
      observation: "Ainda não há base suficiente para comparar padrões com confiança.",
      meaning: "Antes de procurar um vencedor, precisamos reduzir variáveis e formar uma amostra utilizável.",
      action: "Limite testes. Defina 2 envios pontuais (mesmos dias e faixa de horário) por 14 dias letivos seguidos com estética uniforme.",
      nextStep: "Publique com rotina estável por 2 semanas para formar uma base mínima de comparação.",
      whatNotToDo: "Evite testar vários formatos, durações e propostas ao mesmo tempo nesta fase inicial.",
      metricLabel: context.primaryMetricLabel,
      timeWindowLabel: "Período selecionado",
      impactEstimate: "Redução de ruído para formar uma base comparável.",
      expectedLiftRatio: 0.05,
      sampleSize: null,
      confidence: "low",
      guardrailReason: "Ainda faltam pontos suficientes para transformar esse padrão em recomendação forte.",
      experimentPlan: buildExperimentPlan({
        sampleSize: null,
        metricLabel: context.primaryMetricLabel,
        baseline: "Hoje a conta ainda não tem base comparável suficiente para eleger um vencedor.",
        hypothesis: `Se você reduzir variação e publicar com rotina estável, a próxima leitura de ${context.primaryMetricLabel.toLowerCase()} ficará mais confiável.`,
        expectedLiftRatio: 0.05,
      }),
      evidence: [
        "Com poucos posts comparáveis, qualquer leitura forte tende a gerar falso positivo.",
        "Manter rotina estável por algumas semanas melhora a qualidade do próximo diagnóstico.",
      ],
    });
  }

  const intelligentActions = draftActions.map(withRecommendationIntelligence);

  return {
    objectiveMode,
    actions: ensureMaxThree(intelligentActions, feedbackByActionId, feedbackMetaByActionId),
    generatedAt: new Date().toISOString(),
  };
}
