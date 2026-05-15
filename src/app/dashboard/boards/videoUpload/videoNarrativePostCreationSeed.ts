import {
  VideoNarrativeAnalysis,
  VideoNarrativeConfidence,
  sanitizeVideoNarrativeAnalysisText,
} from "./videoNarrativeAnalysisTypes";

export type PostCreationVideoSeedSource = "video_narrative_analysis";

export type PostCreationVideoSeedConfidence = VideoNarrativeConfidence;

export type PostCreationVideoSeedBlueprintDraft = {
  whatToPost: string | null;
  whyThisPath: string | null;
  howItShouldWork: string | null;
  scenes: string[];
};

export type PostCreationVideoSeedScriptDirection = {
  opening: string | null;
  development: string[];
  closing: string | null;
  tone: string | null;
};

export type PostCreationVideoSeedFollowUpQuestion = {
  id: string;
  question: string;
  reason: string;
};

export type PostCreationVideoSeed = {
  id: string;
  source: "video_narrative_analysis";
  analysisId: string;
  creatorQuestion: string | null;
  initialIdea: string | null;
  detectedNarrative: string | null;
  suggestedFormat: string | null;
  suggestedProposal: string | null;
  strategicDiagnosis: string | null;
  blueprintDraft: PostCreationVideoSeedBlueprintDraft;
  scriptDirection: PostCreationVideoSeedScriptDirection;
  brandMatchHints: string[];
  followUpQuestions: PostCreationVideoSeedFollowUpQuestion[];
  evidenceSummary: string | null;
  confidence: PostCreationVideoSeedConfidence;
  createdAt: string | null;
};

function cleanText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return sanitizeVideoNarrativeAnalysisText(value);
}

function cleanTexts(values: string[]): string[] {
  return values.map((value) => cleanText(value)).filter((value): value is string => Boolean(value));
}

export function createEmptyPostCreationVideoSeed(params: {
  id: string;
  analysisId: string;
  createdAt?: string | null;
}): PostCreationVideoSeed {
  return {
    id: params.id,
    source: "video_narrative_analysis",
    analysisId: params.analysisId,
    creatorQuestion: null,
    initialIdea: null,
    detectedNarrative: null,
    suggestedFormat: null,
    suggestedProposal: null,
    strategicDiagnosis: null,
    blueprintDraft: {
      whatToPost: null,
      whyThisPath: null,
      howItShouldWork: null,
      scenes: [],
    },
    scriptDirection: {
      opening: null,
      development: [],
      closing: null,
      tone: null,
    },
    brandMatchHints: [],
    followUpQuestions: [],
    evidenceSummary: null,
    confidence: "unknown",
    createdAt: params.createdAt ?? null,
  };
}

function buildStrategicDiagnosis(analysis: VideoNarrativeAnalysis): string | null {
  const strength = cleanText(analysis.diagnosis.strengths[0]);
  const weakness = cleanText(analysis.diagnosis.weaknesses[0]);
  const adjustment = cleanText(analysis.diagnosis.recommendedAdjustments[0]);
  const parts: string[] = [];

  if (strength) parts.push(`Ponto forte: ${strength}.`);
  if (weakness) parts.push(`Ponto de atenção: ${weakness}.`);
  if (adjustment) parts.push(`Ajuste sugerido: ${adjustment}.`);

  return parts.length > 0 ? parts.join(" ") : null;
}

function buildScriptDirection(analysis: VideoNarrativeAnalysis): PostCreationVideoSeedScriptDirection {
  const recommendedAdjustment = cleanText(analysis.diagnosis.recommendedAdjustments[0]);
  const detectedHook = cleanText(analysis.hook.detected);
  const closingScene = analysis.sceneStructure.find(
    (scene) => scene.role === "call_to_action" || scene.role === "closing",
  );
  const blueprintScenes = cleanTexts(analysis.blueprintSuggestion.scenes);
  const fallbackScenes = cleanTexts(analysis.sceneStructure.map((scene) => scene.description));

  return {
    opening: analysis.hook.strength === "weak" && recommendedAdjustment ? recommendedAdjustment : detectedHook,
    development: blueprintScenes.length > 0 ? blueprintScenes : fallbackScenes,
    closing: cleanText(closingScene?.description),
    tone: cleanText(analysis.d2cClassification.tone),
  };
}

function buildBrandMatchHints(analysis: VideoNarrativeAnalysis): string[] {
  if (!analysis.brandMatch.enabled) return [];

  const hints = cleanTexts(analysis.brandMatch.territories);
  const reason = cleanText(analysis.brandMatch.whyBrandsWouldFit);
  return reason ? [...hints, reason] : hints;
}

function buildFollowUpQuestions(analysis: VideoNarrativeAnalysis): PostCreationVideoSeedFollowUpQuestion[] {
  const questions: PostCreationVideoSeedFollowUpQuestion[] = [];

  if (!cleanText(analysis.hook.detected)) {
    questions.push({
      id: "hook",
      question: "Qual é a primeira frase ou cena que abre esse vídeo?",
      reason: "Ajuda a entender a força do gancho.",
    });
  }

  if (!cleanText(analysis.d2cClassification.narrative)) {
    questions.push({
      id: "narrative",
      question: "Qual narrativa você quer que esse vídeo comunique?",
      reason: "Ajuda a transformar o vídeo em uma pauta mais clara.",
    });
  }

  if (!cleanText(analysis.blueprintSuggestion.whatToPost)) {
    questions.push({
      id: "blueprint",
      question: "Que tipo de post você imagina criar a partir desse vídeo?",
      reason: "Ajuda a escolher o caminho do blueprint.",
    });
  }

  return questions.slice(0, 3);
}

function buildEvidenceSummary(analysis: VideoNarrativeAnalysis): string | null {
  const parts: string[] = [];

  if (cleanText(analysis.evidence.transcript)) parts.push("Há fala/transcrição disponível.");
  if (cleanTexts(analysis.evidence.ocr).length > 0) parts.push("Há texto na tela identificado.");
  if (cleanTexts(analysis.evidence.frames).length > 0) parts.push("Há contexto visual por cenas/frames.");
  if (cleanTexts(analysis.evidence.technicalSignals).length > 0) parts.push("Há sinais técnicos auxiliares.");

  return parts.length > 0 ? parts.join(" ") : null;
}

export function buildPostCreationVideoSeedFromAnalysis(params: {
  id: string;
  analysis: VideoNarrativeAnalysis;
  creatorQuestion?: string | null;
  createdAt?: string | null;
}): PostCreationVideoSeed {
  const { analysis } = params;

  return {
    id: params.id,
    source: "video_narrative_analysis",
    analysisId: analysis.id,
    creatorQuestion: params.creatorQuestion?.trim() || null,
    initialIdea:
      cleanText(analysis.blueprintSuggestion.whatToPost) ||
      cleanText(analysis.summary) ||
      cleanText(analysis.hook.detected),
    detectedNarrative: cleanText(analysis.d2cClassification.narrative) || cleanText(analysis.summary),
    suggestedFormat: analysis.d2cClassification.format === "unknown" ? null : analysis.d2cClassification.format,
    suggestedProposal: analysis.d2cClassification.proposal === "unknown" ? null : analysis.d2cClassification.proposal,
    strategicDiagnosis: buildStrategicDiagnosis(analysis),
    blueprintDraft: {
      whatToPost: cleanText(analysis.blueprintSuggestion.whatToPost),
      whyThisPath: cleanText(analysis.blueprintSuggestion.whyThisPath),
      howItShouldWork: cleanText(analysis.blueprintSuggestion.howItShouldWork),
      scenes: cleanTexts(analysis.blueprintSuggestion.scenes),
    },
    scriptDirection: buildScriptDirection(analysis),
    brandMatchHints: buildBrandMatchHints(analysis),
    followUpQuestions: buildFollowUpQuestions(analysis),
    evidenceSummary: buildEvidenceSummary(analysis),
    confidence: analysis.confidence,
    createdAt: params.createdAt ?? analysis.createdAt ?? null,
  };
}

export function hasUsefulPostCreationVideoSeed(seed: PostCreationVideoSeed): boolean {
  return Boolean(
    cleanText(seed.initialIdea) ||
      cleanText(seed.detectedNarrative) ||
      cleanText(seed.strategicDiagnosis) ||
      cleanText(seed.blueprintDraft.whatToPost) ||
      cleanText(seed.scriptDirection.opening) ||
      seed.scriptDirection.development.length > 0 ||
      seed.brandMatchHints.length > 0 ||
      seed.followUpQuestions.length > 0,
  );
}

export function getPostCreationVideoSeedPrimaryAction(seed: PostCreationVideoSeed): string {
  if (cleanText(seed.blueprintDraft.whatToPost)) {
    return "Transformar a sugestão de blueprint em roteiro.";
  }

  if (cleanText(seed.scriptDirection.opening)) {
    return "Usar a direção de abertura para construir o roteiro.";
  }

  if (cleanText(seed.detectedNarrative)) {
    return "Refinar a narrativa detectada antes de gerar o roteiro.";
  }

  if (seed.followUpQuestions.length > 0) {
    return "Responder às perguntas de refinamento antes de avançar.";
  }

  return "Trazer mais contexto antes de transformar o vídeo em pauta.";
}
