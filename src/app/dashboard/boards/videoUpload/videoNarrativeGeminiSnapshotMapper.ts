import type {
  VideoNarrativeAiAnalysis,
  VideoNarrativeGeminiSnapshotMappingResult,
} from "./videoNarrativeAiProviderTypes";
import { cleanForbiddenText } from "./mobileStrategicProfileAnalyzeSnapshotMapper";

function cleanList(values: string[]): string[] {
  return values.map(cleanForbiddenText).filter(Boolean).slice(0, 5);
}

function cleanSummary(value: string, fallback: string): string {
  return (cleanForbiddenText(value) || fallback).slice(0, 2000);
}

export function mapGeminiAnalysisToStrategicProfileSnapshot(params: {
  analysis: VideoNarrativeAiAnalysis;
  source?: "gemini_ready" | "gemini_fixture";
  promptVersion: string;
}): VideoNarrativeGeminiSnapshotMappingResult {
  const source = params.source ?? "gemini_ready";

  return {
    source,
    snapshot: {
      schemaVersion: "mobile_strategic_profile_snapshot_v1",
      profileState: "active",
      unlockedSignals: cleanList([
        params.analysis.mainNarrative,
        params.analysis.whatVideoCommunicates,
        ...params.analysis.creatorSignals,
      ]),
      pendingSignals: cleanList([
        params.analysis.attentionPoint,
        params.analysis.recommendedAdjustment,
        ...params.analysis.nextActions,
      ]),
      recurringPatterns: cleanList([
        params.analysis.strengthPoint,
        params.analysis.creatorIntention,
      ]),
      opportunities: cleanList([
        params.analysis.commercialPotential,
        ...params.analysis.brandTerritories,
        ...params.analysis.collabOpportunities,
      ]),
      diagnosisSummary: cleanSummary(params.analysis.strategicReading, "Diagnóstico estratégico atualizado."),
      commercialSummary: cleanSummary(params.analysis.commercialPotential, "Potencial comercial futuro em avaliação."),
      lastAnalysisSummary: cleanSummary(params.analysis.suggestedHook, "Próximo gancho sugerido para teste criativo."),
      extraData: {
        source,
        promptVersion: params.promptVersion,
        adapterVersion: "mm65_gemini_snapshot_adapter_v1",
      },
    },
  };
}
