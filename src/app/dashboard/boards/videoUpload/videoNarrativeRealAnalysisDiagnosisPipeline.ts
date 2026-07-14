import {
  createEmptyVideoNarrativeAnalysis,
  sanitizeVideoNarrativeAnalysisText,
  type VideoNarrativeAnalysis,
  type VideoNarrativeConfidence,
} from "./videoNarrativeAnalysisTypes";
import type { VideoNarrativeAiAnalysis } from "./videoNarrativeAiProviderTypes";
import { buildPostCreationVideoSeedFromAnalysis } from "./videoNarrativePostCreationSeed";
import {
  buildVideoNarrativeStrategicDiagnosis,
  type VideoNarrativeDiagnosisAccessLevel,
} from "./videoNarrativeDiagnosisLearningModel";
import { buildVideoNarrativeEvolvingDiagnosis } from "./videoNarrativeEvolvingDiagnosisContract";
import { buildVideoNarrativeAccessTierDiagnosisRules } from "./videoNarrativeAccessTierDiagnosisRules";
import { buildVideoNarrativeDiagnosisPresentation } from "./videoNarrativeDiagnosisPresentationModel";

function clean(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return sanitizeVideoNarrativeAnalysisText(value).trim() || null;
}

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).map(clean).filter((value): value is string => Boolean(value)).slice(0, 8);
}

function confidenceFromAnalysis(analysis: VideoNarrativeAiAnalysis): VideoNarrativeConfidence {
  const usefulSignals = [
    analysis.mainNarrative,
    analysis.whatVideoCommunicates,
    analysis.strategicReading,
    analysis.strengthPoint,
    analysis.attentionPoint,
  ].filter((value) => clean(value)).length;

  if (usefulSignals >= 4) return "high";
  if (usefulSignals >= 2) return "medium";
  return "low";
}

export function mapRealProviderAnalysisToVideoNarrativeAnalysis(params: {
  id: string;
  analysis: VideoNarrativeAiAnalysis;
  createdAt: string;
}): VideoNarrativeAnalysis {
  const base = createEmptyVideoNarrativeAnalysis({
    id: params.id,
    createdAt: params.createdAt,
  });
  const scenes = cleanList([
    params.analysis.whatVideoCommunicates,
    params.analysis.strategicReading,
    params.analysis.attentionPoint,
  ]);

  return {
    ...base,
    summary: clean(params.analysis.whatVideoCommunicates) ?? clean(params.analysis.strategicReading),
    hook: {
      detected: clean(params.analysis.suggestedHook),
      strength: params.analysis.suggestedHook ? "medium" : "unknown",
      why: clean(params.analysis.strengthPoint),
    },
    spokenTopics: cleanList(params.analysis.creatorSignals),
    visualElements: cleanList(params.analysis.evidenceAnchors?.sceneAnchors.map((anchor) => anchor.description)),
    sceneStructure: scenes.map((description, index) => ({
      id: `${params.id}-scene-${index + 1}`,
      timestampLabel: null,
      role: index === 0 ? "hook" : index === 1 ? "development" : "turning_point",
      description,
      suggestedAdjustment: clean(params.analysis.recommendedAdjustment),
    })),
    d2cClassification: {
      format: "reel",
      proposal: "positioning_authority",
      context: clean(params.analysis.whatVideoCommunicates),
      tone: clean(params.analysis.creatorIntention),
      reference: null,
      intent: clean(params.analysis.creatorIntention),
      narrative: clean(params.analysis.mainNarrative),
    },
    diagnosis: {
      strengths: cleanList([params.analysis.strengthPoint]),
      weaknesses: cleanList([params.analysis.attentionPoint]),
      recommendedAdjustments: cleanList([params.analysis.recommendedAdjustment]),
    },
    blueprintSuggestion: {
      whatToPost: clean(params.analysis.recommendedAdjustment),
      whyThisPath: clean(params.analysis.strategicReading),
      howItShouldWork: clean(params.analysis.suggestedHook),
      scenes: cleanList(params.analysis.nextActions),
    },
    brandMatch: {
      enabled: cleanList(params.analysis.brandTerritories).length > 0 || Boolean(clean(params.analysis.commercialPotential)),
      territories: cleanList(params.analysis.brandTerritories),
      whyBrandsWouldFit: clean(params.analysis.commercialPotential),
    },
    evidence: {
      transcript: null,
      ocr: [],
      frames: [],
      technicalSignals: [],
    },
    evidenceAnchors: params.analysis.evidenceAnchors,
    ...(params.analysis.contentContext ? { contentContext: params.analysis.contentContext } : {}),
    ...(params.analysis.narrativeCoherence ? { narrativeCoherence: params.analysis.narrativeCoherence } : {}),
    ...(params.analysis.contentPotentialScan ? { contentPotentialScan: params.analysis.contentPotentialScan } : {}),
    profileSignals: cleanList(params.analysis.creatorSignals).map((value) => ({
      type: "positioning_signal",
      value,
      confidence: "medium",
      shouldPersistLater: false,
    })),
    confidence: confidenceFromAnalysis(params.analysis),
  };
}

export function buildRealProviderDiagnosisArtifacts(params: {
  analysisId: string;
  providerAnalysis: VideoNarrativeAiAnalysis;
  creatorGoal: string;
  selectedGoalOption: string;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
  createdAt: string;
}) {
  const analysis = mapRealProviderAnalysisToVideoNarrativeAnalysis({
    id: params.analysisId,
    analysis: params.providerAnalysis,
    createdAt: params.createdAt,
  });
  const seed = buildPostCreationVideoSeedFromAnalysis({
    id: `${params.analysisId}-seed`,
    analysis,
    creatorQuestion: params.creatorGoal,
    createdAt: params.createdAt,
  });
  const strategicDiagnosis = buildVideoNarrativeStrategicDiagnosis({
    accessLevel: params.accessLevel,
    analysis,
    seed,
    creatorQuestion: params.creatorGoal,
    instagramContext: {
      connected: params.instagramConnected,
    },
  });
  const evolvingDiagnosis = buildVideoNarrativeEvolvingDiagnosis({
    diagnosis: strategicDiagnosis,
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
    analyzedVideosCount: 1,
    createdAt: params.createdAt,
  });
  const accessRules = buildVideoNarrativeAccessTierDiagnosisRules({
    evolvingDiagnosis,
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
  });
  const presentation = buildVideoNarrativeDiagnosisPresentation({
    diagnosis: strategicDiagnosis,
    evolvingDiagnosis,
    accessRules,
  });

  return {
    analysis,
    seed,
    strategicDiagnosis,
    evolvingDiagnosis,
    presentation,
  };
}
