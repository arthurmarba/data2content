export type VideoNarrativePotentialBand =
  | "strong"
  | "promising_with_adjustment"
  | "uncertain"
  | "weak_signals";

export type VideoNarrativePotentialConfidence = "low" | "medium" | "high";
export type VideoNarrativePotentialBasis = "video_only" | "creator_history";
export type VideoNarrativePotentialDimensionStatus = "strong" | "mixed" | "weak" | "unknown";

export type VideoNarrativePotentialDimension = {
  status: VideoNarrativePotentialDimensionStatus;
  evidence: string;
  adjustment: string | null;
  window: "0-3s" | "0-10s" | "full_video" | "creator_history";
};

export type VideoNarrativeWatchedMoment = {
  moment: "opening" | "development" | "closing";
  observation: string;
  impact: string;
};

export type VideoNarrativePracticalDirection = {
  title: string;
  action: string;
  example: string | null;
};

export type VideoNarrativeContentPotentialScan = {
  band: VideoNarrativePotentialBand;
  confidence: VideoNarrativePotentialConfidence;
  basis: VideoNarrativePotentialBasis;
  objective: "attention" | "sharing" | "positioning" | "complete_reading";
  historyPostsAnalyzed: number;
  dimensions: {
    openingClarity: VideoNarrativePotentialDimension;
    attentionArchitecture: VideoNarrativePotentialDimension;
    shareImpulse: VideoNarrativePotentialDimension;
    promiseDelivery: VideoNarrativePotentialDimension;
    narrativeFit: VideoNarrativePotentialDimension;
  };
  watchedMoments?: VideoNarrativeWatchedMoment[];
  practicalDirection?: VideoNarrativePracticalDirection;
  highestImpactAdjustment: string;
  disclaimer: string;
};

const STATUS_SCORE: Record<VideoNarrativePotentialDimensionStatus, number | null> = {
  strong: 1,
  mixed: 0.58,
  weak: 0.15,
  unknown: null,
};

const OBJECTIVE_BY_GOAL: Record<string, VideoNarrativeContentPotentialScan["objective"]> = {
  authority: "positioning",
  authority_build: "positioning",
  retention: "complete_reading",
  format_test: "attention",
  sponsored_content: "sharing",
};

function cleanText(value: unknown, max = 260): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/viralizar|flopar|garantid[oa]|certeza|score|nota/gi, "resultado")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanWatchedMoments(value: unknown): VideoNarrativeWatchedMoment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).map((item): VideoNarrativeWatchedMoment | null => {
    if (!item || typeof item !== "object") return null;
    const raw = item as Partial<VideoNarrativeWatchedMoment>;
    const observation = cleanText(raw.observation, 220);
    const impact = cleanText(raw.impact, 220);
    if (!observation || !impact) return null;
    return {
      moment: ["opening", "development", "closing"].includes(String(raw.moment))
        ? raw.moment as VideoNarrativeWatchedMoment["moment"]
        : "development",
      observation,
      impact,
    };
  }).filter((item): item is VideoNarrativeWatchedMoment => Boolean(item));
}

function cleanPracticalDirection(value: unknown): VideoNarrativePracticalDirection | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<VideoNarrativePracticalDirection>;
  const title = cleanText(raw.title, 140);
  const action = cleanText(raw.action, 320);
  if (!title || !action) return undefined;
  return { title, action, example: cleanText(raw.example, 220) || null };
}

export function contextualizeVideoNarrativeContentPotentialScan(params: {
  scan: VideoNarrativeContentPotentialScan;
  evidenceAnchors?: import("./creatorVideoNarrativeDiagnosisTypes").CreatorVideoNarrativeEvidenceAnchors;
  suggestedHook?: string | null;
  nextActions?: string[] | null;
}): VideoNarrativeContentPotentialScan {
  const existingMoments = cleanWatchedMoments(params.scan.watchedMoments);
  const roleToMoment = (role: string): VideoNarrativeWatchedMoment["moment"] => {
    if (role === "opening") return "opening";
    if (role === "turning_point" || role === "conflict") return "development";
    return "development";
  };
  const observedFromScenes = (params.evidenceAnchors?.sceneAnchors ?? []).map((anchor) => ({
    moment: roleToMoment(anchor.momentRole),
    observation: anchor.description,
    impact: anchor.whyItMatters,
  }));
  const observedFromSpeech = (params.evidenceAnchors?.speechQuotes ?? []).map((anchor) => ({
    moment: anchor.quoteRole === "hook" ? "opening" as const : anchor.quoteRole === "closing" ? "closing" as const : "development" as const,
    observation: `Você diz: “${anchor.quote}”`,
    impact: anchor.whyItMatters,
  }));
  const watchedMoments = cleanWatchedMoments(
    existingMoments.length > 0
      ? existingMoments
      : [observedFromScenes[0], observedFromSpeech[0], ...observedFromScenes.slice(1), ...observedFromSpeech.slice(1)].filter(Boolean),
  );
  const dimensionAdjustment = [
    params.scan.dimensions.openingClarity.adjustment,
    params.scan.dimensions.attentionArchitecture.adjustment,
    params.scan.dimensions.promiseDelivery.adjustment,
    params.scan.dimensions.shareImpulse.adjustment,
    params.scan.dimensions.narrativeFit.adjustment,
  ].find((adjustment) => cleanText(adjustment, 320));
  const practicalDirection = cleanPracticalDirection(params.scan.practicalDirection) ?? {
    title: cleanText(params.scan.highestImpactAdjustment, 140) || "Deixe a direção mais explícita",
    action: cleanText(dimensionAdjustment, 320) || cleanText(params.nextActions?.[0], 320) || cleanText(params.scan.highestImpactAdjustment, 320) || "Torne a mudança principal visível no próprio vídeo.",
    example: cleanText(params.suggestedHook, 220) || null,
  };

  return { ...params.scan, watchedMoments, practicalDirection };
}

function dimensionScore(
  scan: VideoNarrativeContentPotentialScan,
): { score: number; known: number } {
  const weights: Record<keyof VideoNarrativeContentPotentialScan["dimensions"], number> = {
    openingClarity: 0.23,
    attentionArchitecture: 0.2,
    shareImpulse: 0.2,
    promiseDelivery: 0.17,
    narrativeFit: 0.2,
  };
  let weighted = 0;
  let usedWeight = 0;
  let known = 0;
  for (const key of Object.keys(weights) as Array<keyof typeof weights>) {
    const value = STATUS_SCORE[scan.dimensions[key].status];
    if (value === null) continue;
    weighted += value * weights[key];
    usedWeight += weights[key];
    known += 1;
  }
  return { score: usedWeight > 0 ? weighted / usedWeight : 0.5, known };
}

function bandForScore(score: number, known: number): VideoNarrativePotentialBand {
  if (known < 3) return "uncertain";
  if (score >= 0.78) return "strong";
  if (score >= 0.53) return "promising_with_adjustment";
  if (score >= 0.32) return "uncertain";
  return "weak_signals";
}

export function calibrateVideoNarrativeContentPotentialScan(params: {
  scan: VideoNarrativeContentPotentialScan;
  selectedGoalOption: string;
  postsAnalyzed?: number | null;
  historyCalibration?: import("./contentPotentialHistoryService").ContentPotentialCalibrationHistory | null;
}): VideoNarrativeContentPotentialScan {
  const postsAnalyzed = Math.max(0, Math.trunc(params.postsAnalyzed ?? 0));
  const basis: VideoNarrativePotentialBasis = postsAnalyzed >= 5 ? "creator_history" : "video_only";
  const { score, known } = dimensionScore(params.scan);
  let band = bandForScore(score, known);
  const historicalBand = params.historyCalibration?.bandOutcomes?.[band];
  // Outcome calibration is deliberately conservative: only a repeated pattern
  // can move the structural reading by one band.
  if (historicalBand && historicalBand.count >= 3) {
    if (historicalBand.successRate >= 0.72 && band === "uncertain") band = "promising_with_adjustment";
    if (historicalBand.successRate <= 0.28 && band === "strong") band = "promising_with_adjustment";
    if (historicalBand.successRate <= 0.28 && band === "promising_with_adjustment") band = "uncertain";
  }
  const confidence: VideoNarrativePotentialConfidence =
    known < 4
      ? "low"
      : (params.historyCalibration?.outcomesLinked ?? 0) >= 8
        ? "high"
        : "medium";

  return {
    ...params.scan,
    band,
    confidence,
    basis,
    objective: OBJECTIVE_BY_GOAL[params.selectedGoalOption] ?? "complete_reading",
    historyPostsAnalyzed: postsAnalyzed,
    highestImpactAdjustment:
      cleanText(params.scan.highestImpactAdjustment) ||
      "O principal ajuste ainda precisa de mais evidência do vídeo.",
    disclaimer:
      basis === "creator_history"
        ? "Potencial relativo ao seu histórico — não é garantia de alcance."
        : "Leitura estrutural do vídeo — ainda sem histórico suficiente para comparar performance.",
  };
}

export function sanitizeVideoNarrativeContentPotentialScan(
  scan: VideoNarrativeContentPotentialScan | undefined,
): VideoNarrativeContentPotentialScan | undefined {
  if (!scan?.dimensions) return undefined;
  const cleanDimension = (
    value: VideoNarrativePotentialDimension,
    fallbackWindow: VideoNarrativePotentialDimension["window"],
  ): VideoNarrativePotentialDimension => ({
    status: ["strong", "mixed", "weak", "unknown"].includes(value?.status)
      ? value.status
      : "unknown",
    evidence: cleanText(value?.evidence) || "Sem evidência suficiente para esta dimensão.",
    adjustment: cleanText(value?.adjustment) || null,
    window: ["0-3s", "0-10s", "full_video", "creator_history"].includes(value?.window)
      ? value.window
      : fallbackWindow,
  });

  const watchedMoments = cleanWatchedMoments(scan.watchedMoments);
  const practicalDirection = cleanPracticalDirection(scan.practicalDirection);
  return {
    band: ["strong", "promising_with_adjustment", "uncertain", "weak_signals"].includes(scan.band)
      ? scan.band
      : "uncertain",
    confidence: ["low", "medium", "high"].includes(scan.confidence) ? scan.confidence : "low",
    basis: scan.basis === "creator_history" ? "creator_history" : "video_only",
    objective: ["attention", "sharing", "positioning", "complete_reading"].includes(scan.objective)
      ? scan.objective
      : "complete_reading",
    historyPostsAnalyzed: Math.max(0, Math.trunc(scan.historyPostsAnalyzed || 0)),
    dimensions: {
      openingClarity: cleanDimension(scan.dimensions.openingClarity, "0-3s"),
      attentionArchitecture: cleanDimension(scan.dimensions.attentionArchitecture, "0-10s"),
      shareImpulse: cleanDimension(scan.dimensions.shareImpulse, "full_video"),
      promiseDelivery: cleanDimension(scan.dimensions.promiseDelivery, "full_video"),
      narrativeFit: cleanDimension(scan.dimensions.narrativeFit, "creator_history"),
    },
    ...(watchedMoments.length > 0 ? { watchedMoments } : {}),
    ...(practicalDirection ? { practicalDirection } : {}),
    highestImpactAdjustment: cleanText(scan.highestImpactAdjustment),
    disclaimer: cleanText(scan.disclaimer),
  };
}

export function buildFallbackVideoNarrativeContentPotentialScan(params: {
  selectedGoalOption: string;
  adjustment?: string | null;
}): VideoNarrativeContentPotentialScan {
  const unknown = (
    window: VideoNarrativePotentialDimension["window"],
  ): VideoNarrativePotentialDimension => ({
    status: "unknown",
    evidence: "A leitura não trouxe evidência suficiente para esta dimensão.",
    adjustment: null,
    window,
  });
  return calibrateVideoNarrativeContentPotentialScan({
    selectedGoalOption: params.selectedGoalOption,
    postsAnalyzed: 0,
    scan: {
      band: "uncertain",
      confidence: "low",
      basis: "video_only",
      objective: OBJECTIVE_BY_GOAL[params.selectedGoalOption] ?? "complete_reading",
      historyPostsAnalyzed: 0,
      dimensions: {
        openingClarity: unknown("0-3s"),
        attentionArchitecture: unknown("0-10s"),
        shareImpulse: unknown("full_video"),
        promiseDelivery: unknown("full_video"),
        narrativeFit: unknown("creator_history"),
      },
      highestImpactAdjustment: params.adjustment?.trim() || "Repetir o scan com mais contexto do vídeo.",
      disclaimer: "Leitura estrutural do vídeo — ainda sem histórico suficiente para comparar performance.",
    },
  });
}
