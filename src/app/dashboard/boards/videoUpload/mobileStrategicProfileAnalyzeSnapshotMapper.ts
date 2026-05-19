import type { VideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";
import type { MobileStrategicProfileSnapshotPayload } from "./mobileStrategicProfileSnapshotTypes";

const forbiddenTerms = [
  /score/gi,
  /nota/gi,
  /pontos/gi,
  /ranking/gi,
  /gabarito/gi,
  /garantido/gi,
  /certeza/gi,
  /comprovado/gi,
  /viralizar garantido/gi,
  /match real/gi,
  /marca garantida/gi,
  /patrocínio garantido/gi,
  /vídeos salvos/gi,
  /histórico de vídeos/gi,
  /novo Mídia Kit/gi,
  /Mídia Kit mobile/gi,
  /18 sinais/gi,
  /3 narrativas/gi,
  /percentual de perfil/gi,
];

/**
 * Remove qualquer termo proibido nos textos gerados para visualização do Perfil.
 */
export function cleanForbiddenText(text: string): string {
  if (!text) return "";
  let cleaned = text;
  for (const regex of forbiddenTerms) {
    cleaned = cleaned.replace(regex, "");
  }
  // Remove múltiplos espaços e limpa pontas
  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * Mapeia uma análise de vídeo em um snapshot persistível.
 */
export function mapAnalysisToSnapshotPayload(
  analysis: VideoNarrativeAnalysis
): MobileStrategicProfileSnapshotPayload {
  const recurringPatterns = [
    ...(analysis.diagnosis?.strengths || []),
    ...analysis.profileSignals
      .filter((s) => s.type === "recurring_theme" || s.type === "content_strength")
      .map((s) => s.value),
  ].map(cleanForbiddenText).filter(Boolean);

  const opportunities = [
    ...(analysis.brandMatch?.territories || []),
    ...analysis.profileSignals
      .filter((s) => s.type === "brand_territory")
      .map((s) => s.value),
  ].map(cleanForbiddenText).filter(Boolean);

  const unlockedSignals = [
    ...(analysis.spokenTopics || []),
    ...analysis.profileSignals
      .filter((s) => s.type === "positioning_signal")
      .map((s) => s.value),
  ].map(cleanForbiddenText).filter(Boolean);

  const pendingSignals = [
    ...(analysis.diagnosis?.recommendedAdjustments || []),
    ...analysis.profileSignals
      .filter((s) => s.type === "creative_gap")
      .map((s) => s.value),
  ].map(cleanForbiddenText).filter(Boolean);

  const diagnosisSummary = cleanForbiddenText(
    analysis.summary || 
    analysis.blueprintSuggestion?.whyThisPath || 
    "Diagnóstico estratégico ativo baseado no seu último vídeo."
  );

  const commercialSummary = cleanForbiddenText(
    analysis.brandMatch?.whyBrandsWouldFit || 
    "Oportunidades e marcas recomendadas para sua narrativa."
  );

  const lastAnalysisSummary = cleanForbiddenText(
    analysis.hook?.detected || 
    "Análise de gancho e retenção narrativa processada."
  );

  return {
    schemaVersion: "mobile_strategic_profile_snapshot_v1",
    profileState: "active",
    unlockedSignals: unlockedSignals.slice(0, 5),
    pendingSignals: pendingSignals.slice(0, 5),
    recurringPatterns: recurringPatterns.slice(0, 5),
    opportunities: opportunities.slice(0, 5),
    diagnosisSummary: diagnosisSummary.substring(0, 2000),
    commercialSummary: commercialSummary.substring(0, 2000),
    lastAnalysisSummary: lastAnalysisSummary.substring(0, 2000),
  };
}
