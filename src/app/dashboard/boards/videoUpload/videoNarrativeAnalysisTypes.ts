export type VideoNarrativeHookStrength = "weak" | "medium" | "strong" | "unknown";

export type VideoNarrativeConfidence = "low" | "medium" | "high" | "unknown";

export type VideoNarrativeSceneRole =
  | "hook"
  | "context"
  | "development"
  | "proof"
  | "turning_point"
  | "call_to_action"
  | "closing"
  | "unknown";

export type VideoNarrativeD2CFormat = "reel" | "photo" | "carousel" | "long_video" | "unknown";

export type VideoNarrativeD2CProposal =
  | "tips"
  | "review"
  | "humor_scene"
  | "positioning_authority"
  | "behind_the_scenes"
  | "comparison"
  | "announcement"
  | "comment_to_post"
  | "ad_adaptation"
  | "collab_narrative"
  | "unknown";

export type VideoNarrativeHook = {
  detected: string | null;
  strength: VideoNarrativeHookStrength;
  why: string | null;
};

export type VideoNarrativeScene = {
  id: string;
  timestampLabel: string | null;
  role: VideoNarrativeSceneRole;
  description: string;
  suggestedAdjustment: string | null;
};

export type VideoNarrativeD2CClassification = {
  format: VideoNarrativeD2CFormat;
  proposal: VideoNarrativeD2CProposal;
  context: string | null;
  tone: string | null;
  reference: string | null;
  intent: string | null;
  narrative: string | null;
};

export type VideoNarrativeDiagnosis = {
  strengths: string[];
  weaknesses: string[];
  recommendedAdjustments: string[];
};

export type VideoNarrativeBlueprintSuggestion = {
  whatToPost: string | null;
  whyThisPath: string | null;
  howItShouldWork: string | null;
  scenes: string[];
};

export type VideoNarrativeBrandMatch = {
  enabled: boolean;
  territories: string[];
  whyBrandsWouldFit: string | null;
};

export type VideoNarrativeEvidence = {
  transcript: string | null;
  ocr: string[];
  frames: string[];
  technicalSignals: string[];
};

export type VideoNarrativeProfileSignal = {
  type:
    | "recurring_theme"
    | "content_strength"
    | "brand_territory"
    | "audience_goal"
    | "positioning_signal"
    | "creative_gap"
    | "unknown";
  value: string;
  confidence: VideoNarrativeConfidence;
  shouldPersistLater: boolean;
};

export type VideoNarrativeAnalysis = {
  id: string;
  sourceType: "video_narrative_analysis";
  summary: string | null;
  hook: VideoNarrativeHook;
  spokenTopics: string[];
  onScreenText: string[];
  visualElements: string[];
  sceneStructure: VideoNarrativeScene[];
  d2cClassification: VideoNarrativeD2CClassification;
  diagnosis: VideoNarrativeDiagnosis;
  blueprintSuggestion: VideoNarrativeBlueprintSuggestion;
  brandMatch: VideoNarrativeBrandMatch;
  evidence: VideoNarrativeEvidence;
  evidenceAnchors?: CreatorVideoNarrativeEvidenceAnchors;
  profileSignals: VideoNarrativeProfileSignal[];
  confidence: VideoNarrativeConfidence;
  createdAt: string | null;
};

export function createEmptyVideoNarrativeAnalysis(params: {
  id: string;
  createdAt?: string | null;
}): VideoNarrativeAnalysis {
  return {
    id: params.id,
    sourceType: "video_narrative_analysis",
    summary: null,
    hook: {
      detected: null,
      strength: "unknown",
      why: null,
    },
    spokenTopics: [],
    onScreenText: [],
    visualElements: [],
    sceneStructure: [],
    d2cClassification: {
      format: "unknown",
      proposal: "unknown",
      context: null,
      tone: null,
      reference: null,
      intent: null,
      narrative: null,
    },
    diagnosis: {
      strengths: [],
      weaknesses: [],
      recommendedAdjustments: [],
    },
    blueprintSuggestion: {
      whatToPost: null,
      whyThisPath: null,
      howItShouldWork: null,
      scenes: [],
    },
    brandMatch: {
      enabled: false,
      territories: [],
      whyBrandsWouldFit: null,
    },
    evidence: {
      transcript: null,
      ocr: [],
      frames: [],
      technicalSignals: [],
    },
    evidenceAnchors: undefined,
    profileSignals: [],
    confidence: "unknown",
    createdAt: params.createdAt ?? null,
  };
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasTextIn(values: string[]): boolean {
  return values.some((value) => hasText(value));
}

export function hasUsefulVideoNarrativeAnalysis(analysis: VideoNarrativeAnalysis): boolean {
  return Boolean(
    hasText(analysis.summary) ||
      hasText(analysis.hook.detected) ||
      analysis.sceneStructure.some((scene) => hasText(scene.description)) ||
      hasText(analysis.d2cClassification.narrative) ||
      hasTextIn(analysis.diagnosis.strengths) ||
      hasTextIn(analysis.diagnosis.weaknesses) ||
      hasTextIn(analysis.diagnosis.recommendedAdjustments) ||
      hasText(analysis.blueprintSuggestion.whatToPost) ||
      hasText(analysis.evidence.transcript) ||
      hasTextIn(analysis.visualElements) ||
      hasTextIn(analysis.spokenTopics),
  );
}

export function getVideoNarrativePrimaryDirection(analysis: VideoNarrativeAnalysis): string | null {
  return (
    analysis.blueprintSuggestion.whatToPost?.trim() ||
    analysis.d2cClassification.narrative?.trim() ||
    analysis.summary?.trim() ||
    analysis.hook.detected?.trim() ||
    null
  );
}

export function getVideoNarrativeSuggestedNextStep(analysis: VideoNarrativeAnalysis): string {
  if (!hasUsefulVideoNarrativeAnalysis(analysis)) {
    return "Trazer mais contexto antes de transformar o vídeo em pauta.";
  }

  if (analysis.hook.strength === "weak") {
    return "Reforçar o gancho antes de transformar o vídeo em roteiro.";
  }

  if (hasText(analysis.blueprintSuggestion.whatToPost)) {
    return "Usar a sugestão de blueprint como ponto de partida.";
  }

  if (analysis.brandMatch.enabled) {
    return "Avaliar o encaixe da narrativa com territórios de marca.";
  }

  return "Transformar a leitura narrativa em uma pauta mais clara.";
}

export function sanitizeVideoNarrativeAnalysisText(value: string): string {
  return value
    .replace(/viralizar garantido/gi, "ampliar chance de clareza")
    .replace(/sempre performa/gi, "tende a funcionar melhor")
    .replace(/garantido/gi, "indicado")
    .replace(/certeza/gi, "leitura")
    .replace(/comprovado/gi, "observado")
    .trim();
}
import type { CreatorVideoNarrativeEvidenceAnchors } from "./creatorVideoNarrativeDiagnosisTypes";
