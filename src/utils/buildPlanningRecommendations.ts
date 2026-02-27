export type PlanningObjectiveMode = "reach" | "engagement" | "leads";
export type RecommendationFeedbackStatus = "applied" | "not_applied";

export const ALLOWED_PLANNING_OBJECTIVES: PlanningObjectiveMode[] = [
  "reach",
  "engagement",
  "leads",
];

type RecommendationConfidence = "high" | "medium" | "low";
type RecommendationSignalQuality = "high_signal" | "medium_signal" | "low_signal";

export interface PlanningRecommendationAction {
  id: string;
  feedbackKey?: string | null;
  title: string;
  action: string;
  impactEstimate: string;
  confidence: RecommendationConfidence;
  evidence: string[];
  sampleSize?: number | null;
  expectedLiftRatio?: number | null;
  opportunityScore?: number | null;
  rankingScore?: number | null;
  signalQuality?: RecommendationSignalQuality;
  guardrailReason?: string | null;
  feedbackStatus?: RecommendationFeedbackStatus | null;
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
  formatData?: any;
  proposalData?: any;
  toneData?: any;
  contextData?: any;
  feedbackByActionId?: Record<string, RecommendationFeedbackStatus>;
};

type RecommendationDraft = Omit<
  PlanningRecommendationAction,
  "opportunityScore" | "signalQuality" | "guardrailReason"
> & {
  guardrailReason?: string | null;
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
  trendData?: any
): { direction: "up" | "down" | "flat"; deltaRatio: number; sampleSize: number } | null {
  const points = Array.isArray(trendData?.chartData) ? trendData.chartData : [];
  if (points.length < 2) return null;

  const first = asPositiveNumber(points[0]?.totalInteractions ?? points[0]?.interactions);
  const last = asPositiveNumber(points[points.length - 1]?.totalInteractions ?? points[points.length - 1]?.interactions);
  if (!first || !last) return null;

  const deltaRatio = (last - first) / first;
  if (Math.abs(deltaRatio) < 0.05) return { direction: "flat", deltaRatio, sampleSize: points.length };
  return { direction: deltaRatio > 0 ? "up" : "down", deltaRatio, sampleSize: points.length };
}

function actionTimeSlot(bestSlot: ResolvedTimeSlot, liftRatio: number | null): RecommendationDraft {
  const dayLabel = WEEKDAY_LABELS[bestSlot.dayOfWeek] || `dia ${bestSlot.dayOfWeek}`;
  return {
    id: "time_slot",
    feedbackKey: buildFeedbackKey("time_slot", `d${bestSlot.dayOfWeek}_h${bestSlot.hour}`),
    title: "Priorize seu melhor horário",
    action: `Publique no pico de performance (${dayLabel} às ${bestSlot.hour}h).`,
    impactEstimate:
      liftRatio !== null
        ? `Potencial de ${liftRatio >= 0 ? "+" : ""}${toPercent(liftRatio)} vs média recente.`
        : "Maior chance de manter seu pico recente de interações.",
    expectedLiftRatio: liftRatio,
    sampleSize: bestSlot.sampleSize,
    confidence: confidenceFromSample(bestSlot.sampleSize),
    guardrailReason: bestSlot.sampleSize > 0 && bestSlot.sampleSize < LOW_SAMPLE_THRESHOLD
      ? "Baixa amostra para este slot horário."
      : null,
    evidence: [
      `Média ajustada de ${numberFormatter.format(Math.round(bestSlot.smoothedAverage || 0))} interações.`,
      `${numberFormatter.format(bestSlot.sampleSize || 0)} posts nesta janela.`,
    ],
  };
}

function actionDuration(bestDuration: ResolvedDurationBucket): RecommendationDraft {
  const expectedLiftRatio = bestDuration.priorAverage > 0
    ? (bestDuration.smoothedAverage - bestDuration.priorAverage) / bestDuration.priorAverage
    : null;
  return {
    id: "duration",
    feedbackKey: buildFeedbackKey("duration", bestDuration.key || bestDuration.label),
    title: "Repita a faixa de duração vencedora",
    action: `Foque em vídeos na faixa ${bestDuration.label} nos próximos testes.`,
    impactEstimate: `Faixa com ${numberFormatter.format(Math.round(bestDuration.smoothedAverage || 0))} interações médias.`,
    expectedLiftRatio,
    sampleSize: bestDuration.sampleSize,
    confidence: confidenceFromSample(bestDuration.sampleSize),
    guardrailReason: bestDuration.sampleSize > 0 && bestDuration.sampleSize < LOW_SAMPLE_THRESHOLD
      ? "Baixa amostra na faixa de duração."
      : null,
    evidence: [
      `${numberFormatter.format(bestDuration.sampleSize || 0)} posts com duração nesta faixa.`,
      "Ajuste estatístico aplicado para reduzir viés de amostra pequena.",
    ],
  };
}

function actionCategory(
  id: string,
  title: string,
  actionPrefix: string,
  topCategory: ResolvedCategory
): RecommendationDraft {
  const expectedLiftRatio = topCategory.priorValue > 0
    ? (topCategory.smoothedValue - topCategory.priorValue) / topCategory.priorValue
    : null;
  return {
    id,
    feedbackKey: buildFeedbackKey(id, topCategory.name),
    title,
    action: `${actionPrefix} ${topCategory.name}.`,
    impactEstimate: `${numberFormatter.format(Math.round(topCategory.smoothedValue || 0))} interações médias nesse grupo.`,
    expectedLiftRatio,
    sampleSize: topCategory.sampleSize,
    confidence: confidenceFromSample(topCategory.sampleSize),
    guardrailReason: topCategory.sampleSize > 0 && topCategory.sampleSize < LOW_SAMPLE_THRESHOLD
      ? `Baixa amostra no grupo ${topCategory.name}.`
      : null,
    evidence: [
      `Grupo líder: ${topCategory.name}.`,
      `${numberFormatter.format(topCategory.sampleSize || 0)} posts na amostra.`,
      "Valor ajustado por suavização para estabilidade do ranking.",
    ],
  };
}

function actionTrendRecovery(
  signal: { direction: "up" | "down" | "flat"; deltaRatio: number; sampleSize: number }
): RecommendationDraft {
  if (signal.direction === "down") {
    return {
      id: "trend_recovery",
      feedbackKey: buildFeedbackKey("trend_recovery", signal.direction),
      title: "Ação de recuperação da tendência",
      action: "Nas próximas 2 semanas, repita o formato e horário com maior média para recuperar tração.",
      impactEstimate: `Tendência atual em queda (${toPercent(signal.deltaRatio)} no período analisado).`,
      expectedLiftRatio: Math.abs(signal.deltaRatio),
      sampleSize: signal.sampleSize,
      confidence: confidenceFromSample(signal.sampleSize),
      evidence: [
        "Queda relevante entre início e fim da série de interações.",
        "Reforçar o playbook vencedor tende a acelerar recuperação.",
      ],
    };
  }

  if (signal.direction === "up") {
    return {
      id: "trend_scale",
      feedbackKey: buildFeedbackKey("trend_scale", signal.direction),
      title: "Ação de escala da tendência",
      action: "Aumente em 1 publicação semanal no formato dominante enquanto a curva segue positiva.",
      impactEstimate: `Tendência em alta (${toPercent(signal.deltaRatio)} no período analisado).`,
      expectedLiftRatio: Math.abs(signal.deltaRatio),
      sampleSize: signal.sampleSize,
      confidence: confidenceFromSample(signal.sampleSize),
      evidence: [
        "Crescimento consistente de interações na série.",
        "Momento favorável para escalar sem alterar a proposta vencedora.",
      ],
    };
  }

  return {
    id: "trend_stability",
    feedbackKey: buildFeedbackKey("trend_stability", signal.direction),
    title: "Ação de estabilização",
    action: "Mantenha a cadência atual e foque em pequenos testes de hook/CTA, sem mudar tudo ao mesmo tempo.",
    impactEstimate: "Tendência estável no período recente.",
    expectedLiftRatio: 0.04,
    sampleSize: signal.sampleSize,
    confidence: confidenceFromSample(signal.sampleSize),
    evidence: [
      "Sem variação expressiva na série de interações.",
      "Ajustes incrementais geram aprendizado com menor risco.",
    ],
  };
}

function ensureMaxThree(
  actions: PlanningRecommendationAction[],
  feedbackByActionId?: Record<string, RecommendationFeedbackStatus>
): PlanningRecommendationAction[] {
  const feedbackMap = feedbackByActionId || {};
  const deduped = new Map<string, PlanningRecommendationAction>();
  for (const action of actions) {
    const dedupeKey = normalizeActionId(action.feedbackKey || action.id);
    if (!deduped.has(dedupeKey)) deduped.set(dedupeKey, action);
  }
  return Array.from(deduped.values())
    .map((action) => {
      const feedbackKey = normalizeActionId(action.feedbackKey || action.id);
      const actionId = normalizeActionId(action.id);
      const feedbackStatus = feedbackMap[feedbackKey] || feedbackMap[actionId] || null;
      const rankingScore = scoreWithFeedback(action.opportunityScore, feedbackStatus);
      return {
        ...action,
        feedbackStatus,
        rankingScore,
      };
    })
    .sort((a, b) => (b.rankingScore || b.opportunityScore || 0) - (a.rankingScore || a.opportunityScore || 0))
    .slice(0, 3);
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
}: RecommendationInputs): PlanningRecommendationsResult {
  const bestTime = resolveBestTimeSlot(timeData);
  const timeLift = estimateTimeLift(bestTime);
  const bestDuration = resolveBestDuration(durationData);
  const topFormat = resolveTopCategory(formatData?.chartData);
  const topProposal = resolveTopCategory(proposalData?.chartData);
  const topTone = resolveTopCategory(toneData?.chartData);
  const topContext = resolveTopCategory(contextData?.chartData);
  const trendSignal = resolveTrendSignal(trendData);

  const draftActions: RecommendationDraft[] = [];

  if (objectiveMode === "reach") {
    if (bestTime) draftActions.push(actionTimeSlot(bestTime, timeLift));
    if (topFormat) {
      draftActions.push(actionCategory("format_reach", "Aposte no formato dominante", "Priorize conteúdos no formato", topFormat));
    }
    if (trendSignal) draftActions.push(actionTrendRecovery(trendSignal));
    if (!trendSignal && topContext) {
      draftActions.push(actionCategory("context_reach", "Amplie o contexto com maior tração", "Escalone pautas de", topContext));
    }
  }

  if (objectiveMode === "engagement") {
    if (bestDuration) draftActions.push(actionDuration(bestDuration));
    if (topTone) draftActions.push(actionCategory("tone_engagement", "Use o tom com melhor resposta", "Produza conteúdos com tom", topTone));
    if (topProposal) {
      draftActions.push(actionCategory("proposal_engagement", "Repita a proposta vencedora", "Priorize propostas do tipo", topProposal));
    }
    if (draftActions.length < 3 && bestTime) draftActions.push(actionTimeSlot(bestTime, timeLift));
  }

  if (objectiveMode === "leads") {
    if (topProposal) {
      draftActions.push(actionCategory("proposal_leads", "Concentre no conteúdo com intenção mais forte", "Priorize propostas de", topProposal));
    }
    if (topContext) {
      draftActions.push(actionCategory("context_leads", "Contextualize para conversão", "Reforce conteúdos no contexto", topContext));
    }
    if (bestTime) draftActions.push(actionTimeSlot(bestTime, timeLift));
    if (draftActions.length < 3 && bestDuration) draftActions.push(actionDuration(bestDuration));
  }

  if (!draftActions.length) {
    draftActions.push({
      id: "baseline",
      feedbackKey: buildFeedbackKey("baseline", "default"),
      title: "Mantenha consistência com foco",
      action: "Defina 2 slots fixos na semana e publique com o mesmo formato por 14 dias para gerar baseline confiável.",
      impactEstimate: "Objetivo: ganhar previsibilidade para decidir a próxima otimização.",
      expectedLiftRatio: 0.05,
      sampleSize: null,
      confidence: "low",
      guardrailReason: "Dados atuais insuficientes para recomendação específica.",
      evidence: [
        "Dados atuais insuficientes para recomendação específica.",
        "Consistência aumenta qualidade do diagnóstico.",
      ],
    });
  }

  const intelligentActions = draftActions.map(withRecommendationIntelligence);

  return {
    objectiveMode,
    actions: ensureMaxThree(intelligentActions, feedbackByActionId),
    generatedAt: new Date().toISOString(),
  };
}
