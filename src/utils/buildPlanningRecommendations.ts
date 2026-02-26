export type PlanningObjectiveMode = "reach" | "engagement" | "leads";

export const ALLOWED_PLANNING_OBJECTIVES: PlanningObjectiveMode[] = [
  "reach",
  "engagement",
  "leads",
];

type RecommendationConfidence = "high" | "medium" | "low";

export interface PlanningRecommendationAction {
  id: string;
  title: string;
  action: string;
  impactEstimate: string;
  confidence: RecommendationConfidence;
  evidence: string[];
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

const WEEKDAY_LABELS: Record<number, string> = {
  1: "domingo",
  2: "segunda",
  3: "terça",
  4: "quarta",
  5: "quinta",
  6: "sexta",
  7: "sábado",
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

type RecommendationInputs = {
  objectiveMode: PlanningObjectiveMode;
  trendData?: any;
  timeData?: any;
  durationData?: any;
  formatData?: any;
  proposalData?: any;
  toneData?: any;
  contextData?: any;
};

function asPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function confidenceFromSample(sampleSize?: number | null): RecommendationConfidence {
  const n = typeof sampleSize === "number" && Number.isFinite(sampleSize) ? sampleSize : 0;
  if (n >= 8) return "high";
  if (n >= 4) return "medium";
  return "low";
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function resolveBestTimeSlot(timeData?: any): TimeSlot | null {
  const best = Array.isArray(timeData?.bestSlots) ? timeData.bestSlots[0] : null;
  if (best && typeof best.hour === "number" && typeof best.dayOfWeek === "number") {
    return best as TimeSlot;
  }

  const buckets = Array.isArray(timeData?.buckets) ? (timeData.buckets as TimeSlot[]) : [];
  if (!buckets.length) return null;
  return buckets.slice().sort((a, b) => (b.average || 0) - (a.average || 0))[0] || null;
}

function estimateTimeLift(timeData?: any, bestSlot?: TimeSlot | null): number | null {
  if (!bestSlot || typeof bestSlot.average !== "number") return null;
  const buckets = Array.isArray(timeData?.buckets) ? (timeData.buckets as TimeSlot[]) : [];
  if (!buckets.length) return null;

  const avg =
    buckets.reduce((sum, bucket) => sum + (typeof bucket.average === "number" ? bucket.average : 0), 0) /
    buckets.length;
  if (!avg) return null;
  return (bestSlot.average - avg) / avg;
}

function resolveBestDuration(durationData?: any): DurationBucket | null {
  const buckets = Array.isArray(durationData?.buckets) ? (durationData.buckets as DurationBucket[]) : [];
  if (!buckets.length) return null;

  const withData = buckets.filter((bucket) => (bucket.postsCount || 0) > 0);
  if (!withData.length) return null;
  return (
    withData
      .slice()
      .sort((a, b) => (b.averageInteractions || 0) - (a.averageInteractions || 0))[0] || null
  );
}

function resolveTopCategory(chartData?: any): CategoryBar | null {
  const rows = Array.isArray(chartData) ? (chartData as CategoryBar[]) : [];
  if (!rows.length) return null;
  return rows[0] || null;
}

function resolveTrendSignal(trendData?: any): { direction: "up" | "down" | "flat"; deltaRatio: number } | null {
  const points = Array.isArray(trendData?.chartData) ? trendData.chartData : [];
  if (points.length < 2) return null;

  const first = asPositiveNumber(points[0]?.totalInteractions ?? points[0]?.interactions);
  const last = asPositiveNumber(points[points.length - 1]?.totalInteractions ?? points[points.length - 1]?.interactions);
  if (!first || !last) return null;

  const deltaRatio = (last - first) / first;
  if (Math.abs(deltaRatio) < 0.05) return { direction: "flat", deltaRatio };
  return { direction: deltaRatio > 0 ? "up" : "down", deltaRatio };
}

function actionTimeSlot(bestSlot: TimeSlot, liftRatio: number | null): PlanningRecommendationAction {
  const dayLabel = WEEKDAY_LABELS[bestSlot.dayOfWeek] || `dia ${bestSlot.dayOfWeek}`;
  const sample = typeof bestSlot.count === "number" ? bestSlot.count : null;
  return {
    id: "time_slot",
    title: "Priorize seu melhor horário",
    action: `Publique no pico de performance (${dayLabel} às ${bestSlot.hour}h).`,
    impactEstimate:
      liftRatio !== null
        ? `Potencial de ${liftRatio >= 0 ? "+" : ""}${toPercent(liftRatio)} vs média recente.`
        : "Maior chance de manter seu pico recente de interações.",
    confidence: confidenceFromSample(sample),
    evidence: [
      `Horário com média de ${numberFormatter.format(Math.round(bestSlot.average || 0))} interações.`,
      sample ? `${numberFormatter.format(sample)} posts nesta janela.` : "Amostra histórica limitada para este horário.",
    ],
  };
}

function actionDuration(bestDuration: DurationBucket): PlanningRecommendationAction {
  return {
    id: "duration",
    title: "Repita a faixa de duração vencedora",
    action: `Foque em vídeos na faixa ${bestDuration.label} nos próximos testes.`,
    impactEstimate: `Faixa com ${numberFormatter.format(Math.round(bestDuration.averageInteractions || 0))} interações médias.`,
    confidence: confidenceFromSample(bestDuration.postsCount || 0),
    evidence: [
      `${numberFormatter.format(bestDuration.postsCount || 0)} posts com duração nesta faixa.`,
      "Melhor relação entre volume e performance no período atual.",
    ],
  };
}

function actionCategory(
  id: string,
  title: string,
  actionPrefix: string,
  topCategory: CategoryBar
): PlanningRecommendationAction {
  return {
    id,
    title,
    action: `${actionPrefix} ${topCategory.name}.`,
    impactEstimate: `${numberFormatter.format(Math.round(topCategory.value || 0))} interações médias nesse grupo.`,
    confidence: confidenceFromSample(topCategory.postsCount ?? 0),
    evidence: [
      `Grupo líder: ${topCategory.name}.`,
      topCategory.postsCount
        ? `${numberFormatter.format(topCategory.postsCount)} posts na amostra.`
        : "Sem contagem detalhada de posts para o grupo.",
    ],
  };
}

function actionTrendRecovery(signal: { direction: "up" | "down" | "flat"; deltaRatio: number }): PlanningRecommendationAction {
  if (signal.direction === "down") {
    return {
      id: "trend_recovery",
      title: "Ação de recuperação da tendência",
      action: "Nas próximas 2 semanas, repita o formato e horário com maior média para recuperar tração.",
      impactEstimate: `Tendência atual em queda (${toPercent(signal.deltaRatio)} no período analisado).`,
      confidence: "medium",
      evidence: [
        "Queda relevante entre início e fim da série de interações.",
        "Reforçar o playbook vencedor tende a acelerar recuperação.",
      ],
    };
  }

  if (signal.direction === "up") {
    return {
      id: "trend_scale",
      title: "Ação de escala da tendência",
      action: "Aumente em 1 publicação semanal no formato dominante enquanto a curva segue positiva.",
      impactEstimate: `Tendência em alta (${toPercent(signal.deltaRatio)} no período analisado).`,
      confidence: "medium",
      evidence: [
        "Crescimento consistente de interações na série.",
        "Momento favorável para escalar sem alterar a proposta vencedora.",
      ],
    };
  }

  return {
    id: "trend_stability",
    title: "Ação de estabilização",
    action: "Mantenha a cadência atual e foque em pequenos testes de hook/CTA, sem mudar tudo ao mesmo tempo.",
    impactEstimate: "Tendência estável no período recente.",
    confidence: "low",
    evidence: [
      "Sem variação expressiva na série de interações.",
      "Ajustes incrementais geram aprendizado com menor risco.",
    ],
  };
}

function ensureMaxThree(actions: PlanningRecommendationAction[]): PlanningRecommendationAction[] {
  const deduped = new Map<string, PlanningRecommendationAction>();
  for (const action of actions) {
    if (!deduped.has(action.id)) deduped.set(action.id, action);
  }
  return Array.from(deduped.values()).slice(0, 3);
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
}: RecommendationInputs): PlanningRecommendationsResult {
  const bestTime = resolveBestTimeSlot(timeData);
  const timeLift = estimateTimeLift(timeData, bestTime);
  const bestDuration = resolveBestDuration(durationData);
  const topFormat = resolveTopCategory(formatData?.chartData);
  const topProposal = resolveTopCategory(proposalData?.chartData);
  const topTone = resolveTopCategory(toneData?.chartData);
  const topContext = resolveTopCategory(contextData?.chartData);
  const trendSignal = resolveTrendSignal(trendData);

  const actions: PlanningRecommendationAction[] = [];

  if (objectiveMode === "reach") {
    if (bestTime) actions.push(actionTimeSlot(bestTime, timeLift));
    if (topFormat) {
      actions.push(actionCategory("format_reach", "Aposte no formato dominante", "Priorize conteúdos no formato", topFormat));
    }
    if (trendSignal) actions.push(actionTrendRecovery(trendSignal));
    if (!trendSignal && topContext) {
      actions.push(actionCategory("context_reach", "Amplie o contexto com maior tração", "Escalone pautas de", topContext));
    }
  }

  if (objectiveMode === "engagement") {
    if (bestDuration) actions.push(actionDuration(bestDuration));
    if (topTone) actions.push(actionCategory("tone_engagement", "Use o tom com melhor resposta", "Produza conteúdos com tom", topTone));
    if (topProposal) {
      actions.push(actionCategory("proposal_engagement", "Repita a proposta vencedora", "Priorize propostas do tipo", topProposal));
    }
    if (actions.length < 3 && bestTime) actions.push(actionTimeSlot(bestTime, timeLift));
  }

  if (objectiveMode === "leads") {
    if (topProposal) {
      actions.push(actionCategory("proposal_leads", "Concentre no conteúdo com intenção mais forte", "Priorize propostas de", topProposal));
    }
    if (topContext) {
      actions.push(actionCategory("context_leads", "Contextualize para conversão", "Reforce conteúdos no contexto", topContext));
    }
    if (bestTime) actions.push(actionTimeSlot(bestTime, timeLift));
    if (actions.length < 3 && bestDuration) actions.push(actionDuration(bestDuration));
  }

  if (!actions.length) {
    actions.push({
      id: "baseline",
      title: "Mantenha consistência com foco",
      action: "Defina 2 slots fixos na semana e publique com o mesmo formato por 14 dias para gerar baseline confiável.",
      impactEstimate: "Objetivo: ganhar previsibilidade para decidir a próxima otimização.",
      confidence: "low",
      evidence: [
        "Dados atuais insuficientes para recomendação específica.",
        "Consistência aumenta qualidade do diagnóstico.",
      ],
    });
  }

  return {
    objectiveMode,
    actions: ensureMaxThree(actions),
    generatedAt: new Date().toISOString(),
  };
}
