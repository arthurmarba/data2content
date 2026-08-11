import type { CreatorEngagementBaseline } from "./creatorEngagementBaselineService";
import type {
  VideoNarrativeContentPotentialScan,
  VideoNarrativeEngagementPotential,
  VideoNarrativePersonalComparison,
  VideoNarrativePotentialDimensionStatus,
} from "./videoNarrativeContentPotentialScan";
import type { VideoNarrativeAiAnalysis } from "./videoNarrativeAiProviderTypes";

const STATUS_SCORE: Record<VideoNarrativePotentialDimensionStatus, number> = {
  strong: 1,
  mixed: 0.58,
  weak: 0.18,
  unknown: 0.45,
};

function readable(value: string | null | undefined, fallback: string): string {
  const text = value?.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesPattern(current: string | null | undefined, pattern: string | null | undefined): boolean | null {
  const currentText = normalized(current);
  const patternText = normalized(pattern);
  if (!currentText || !patternText) return null;
  const meaningfulTokens = patternText.split(" ").filter((token) => token.length >= 4);
  return currentText.includes(patternText) || meaningfulTokens.some((token) => currentText.includes(token));
}

function potentialFor(params: {
  scan: VideoNarrativeContentPotentialScan;
  baseline: CreatorEngagementBaseline;
  analysis: VideoNarrativeAiAnalysis;
}): VideoNarrativeEngagementPotential {
  const dimensions = params.scan.dimensions;
  const structural =
    STATUS_SCORE[dimensions.openingClarity.status] * 0.26 +
    STATUS_SCORE[dimensions.attentionArchitecture.status] * 0.2 +
    STATUS_SCORE[dimensions.shareImpulse.status] * 0.2 +
    STATUS_SCORE[dimensions.promiseDelivery.status] * 0.18 +
    STATUS_SCORE[dimensions.narrativeFit.status] * 0.16;
  const currentProduction = params.analysis.contentContext?.productionStyle;
  const currentSubject = params.analysis.mainNarrative;
  const currentTone = params.analysis.contentContext?.emotionalRegister;
  const alignmentChecks = [
    matchesPattern(currentProduction, params.baseline.patterns.framing?.label),
    matchesPattern(currentSubject, params.baseline.patterns.subject?.label),
    matchesPattern(currentTone, params.baseline.patterns.tone?.label),
  ].filter((match): match is boolean => match !== null);
  const alignmentRatio = alignmentChecks.length > 0
    ? alignmentChecks.filter(Boolean).length / alignmentChecks.length
    : null;
  const adjustedStructural = alignmentRatio === null
    ? structural
    : Math.max(0, Math.min(1, structural + (alignmentRatio - 0.5) * 0.16));
  const hasHistory = params.baseline.postsAnalyzed >= 5;
  const verdict: VideoNarrativeEngagementPotential["verdict"] =
    adjustedStructural >= 0.8 && hasHistory
      ? "strong"
      : adjustedStructural >= 0.68
        ? "promising"
        : adjustedStructural >= 0.5
          ? "promising_with_adjustment"
          : adjustedStructural >= 0.34
            ? "uncertain"
            : "limited";
  const summaries: Record<VideoNarrativeEngagementPotential["verdict"], string> = {
    strong: "A estrutura do vídeo e os sinais do seu histórico apontam na mesma direção.",
    promising: "O vídeo reúne sinais que costumam sustentar interação no seu perfil.",
    promising_with_adjustment: "A ideia tem sinais favoráveis, mas um ponto da execução pode limitar o engajamento.",
    uncertain: "Os sinais estão divididos e ainda não sustentam uma previsão segura.",
    limited: "A estrutura atual reúne poucos sinais associados aos seus conteúdos com mais interação.",
  };
  const summary = hasHistory && alignmentRatio !== null
    ? alignmentRatio >= 0.67
      ? "A execução está próxima dos padrões que acompanham seus conteúdos com mais interação."
      : alignmentRatio <= 0.33
        ? "A execução se afasta dos padrões que acompanham seus conteúdos com mais interação, então a resposta pode ser diferente."
        : summaries[verdict]
    : summaries[verdict];
  return {
    verdict,
    confidence: params.baseline.postsAnalyzed >= 12 && params.scan.confidence !== "low"
      ? "high"
      : params.baseline.postsAnalyzed >= 5
        ? "medium"
        : "low",
    basis: params.baseline.postsAnalyzed >= 12
      ? "creator_history"
      : params.baseline.postsAnalyzed >= 5
        ? "partial_history"
        : "video_structure",
    summary,
    postsCompared: params.baseline.postsAnalyzed,
    historicalWindowDays: params.baseline.windowDays,
  };
}

function impactFor(status: VideoNarrativePotentialDimensionStatus): VideoNarrativePersonalComparison["impact"] {
  if (status === "strong") return "positive";
  if (status === "mixed") return "experimental";
  if (status === "weak") return "limiting";
  return "unknown";
}

export function enrichContentPotentialWithCreatorHistory(params: {
  scan: VideoNarrativeContentPotentialScan;
  analysis: VideoNarrativeAiAnalysis;
  baseline: CreatorEngagementBaseline;
}): VideoNarrativeContentPotentialScan {
  const { scan, analysis, baseline } = params;
  const comparisons: VideoNarrativePersonalComparison[] = [];
  const hookEvidenceCount = Math.round(
    Math.max(baseline.openingSpeechRate ?? 0, baseline.openingTextRate ?? 0) * baseline.topPostsCount,
  );
  comparisons.push({
    dimension: "hook",
    label: "Gancho",
    current: scan.dimensions.openingClarity.evidence,
    historical: baseline.openingSpeechRate !== null || baseline.openingTextRate !== null
      ? `${Math.round(Math.max(baseline.openingSpeechRate ?? 0, baseline.openingTextRate ?? 0) * 100)}% dos seus conteúdos de maior interação abrem com fala ou texto explícito.`
      : "Seu padrão de abertura ainda não tem amostra suficiente.",
    impact: impactFor(scan.dimensions.openingClarity.status),
    reading: scan.dimensions.openingClarity.adjustment ?? "A abertura foi comparada com a estrutura dos seus conteúdos publicados.",
    evidenceCount: hookEvidenceCount,
  });

  const currentProduction = readable(analysis.contentContext?.productionStyle, "Estilo visual identificado no vídeo");
  const framingMatches = matchesPattern(currentProduction, baseline.patterns.framing?.label);
  comparisons.push({
    dimension: "framing",
    label: "Enquadramento",
    current: currentProduction,
    historical: baseline.patterns.framing
      ? `${baseline.patterns.framing.label} aparece com mais frequência entre seus conteúdos de maior interação.`
      : "Ainda não há enquadramento recorrente suficiente no seu histórico.",
    impact: framingMatches === true ? "positive" : framingMatches === false ? "experimental" : "unknown",
    reading: framingMatches === false
      ? "O enquadramento deste vídeo difere do padrão mais recorrente no seu histórico; a resposta pode mudar."
      : scan.dimensions.attentionArchitecture.evidence,
    evidenceCount: baseline.patterns.framing?.count ?? 0,
  });

  const subjectMatches = matchesPattern(analysis.mainNarrative, baseline.patterns.subject?.label);
  comparisons.push({
    dimension: "subject",
    label: "Assunto",
    current: readable(analysis.mainNarrative, "Assunto identificado no vídeo"),
    historical: baseline.patterns.subject
      ? `${baseline.patterns.subject.label} é o assunto mais recorrente entre seus conteúdos de maior interação.`
      : "Seu histórico ainda não revela um assunto dominante.",
    impact: subjectMatches === true ? "positive" : subjectMatches === false ? "experimental" : "unknown",
    reading: subjectMatches === false
      ? "O assunto abre uma hipótese diferente do tema que mais aparece entre seus melhores resultados recentes."
      : scan.dimensions.narrativeFit.evidence,
    evidenceCount: baseline.patterns.subject?.count ?? 0,
  });

  const toneMatches = matchesPattern(analysis.contentContext?.emotionalRegister, baseline.patterns.tone?.label);
  comparisons.push({
    dimension: "tone",
    label: "Tom",
    current: readable(analysis.contentContext?.emotionalRegister, "Tom identificado no vídeo"),
    historical: baseline.patterns.tone
      ? `${baseline.patterns.tone.label} aparece com mais frequência entre seus conteúdos de maior interação.`
      : "Seu histórico ainda não revela um tom dominante.",
    impact: toneMatches === true ? "positive" : toneMatches === false ? "experimental" : "unknown",
    reading: toneMatches === false
      ? "O tom difere do padrão recente de maior interação; trate como experimento, não como erro."
      : analysis.narrativeCoherence?.reasoning ?? scan.dimensions.narrativeFit.evidence,
    evidenceCount: baseline.patterns.tone?.count ?? 0,
  });

  comparisons.push({
    dimension: "rhythm",
    label: "Ritmo",
    current: scan.dimensions.attentionArchitecture.evidence,
    historical: baseline.patterns.aesthetic
      ? `${baseline.patterns.aesthetic.label} é o traço visual mais recorrente nos seus melhores conteúdos recentes.`
      : "Ainda não há padrão visual suficiente para comparar ritmo.",
    impact: impactFor(scan.dimensions.attentionArchitecture.status),
    reading: scan.dimensions.attentionArchitecture.adjustment ?? "O ritmo foi lido pela progressão dos primeiros segundos.",
    evidenceCount: baseline.patterns.aesthetic?.count ?? 0,
  });

  comparisons.push({
    dimension: "delivery",
    label: "Entrega",
    current: scan.dimensions.promiseDelivery.evidence,
    historical: "A entrega é comparada com a clareza estrutural dos seus conteúdos publicados.",
    impact: impactFor(scan.dimensions.promiseDelivery.status),
    reading: scan.dimensions.promiseDelivery.adjustment ?? "A promessa e o fechamento estão coerentes.",
    evidenceCount: baseline.postsAnalyzed,
  });

  return {
    ...scan,
    engagementPotential: potentialFor({ scan, baseline, analysis }),
    personalComparisons: comparisons,
  };
}
