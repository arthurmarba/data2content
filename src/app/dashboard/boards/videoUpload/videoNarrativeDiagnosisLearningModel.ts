import {
  sanitizeVideoNarrativeAnalysisText,
  type VideoNarrativeAnalysis,
  type VideoNarrativeContentContext,
  type VideoNarrativeCoherence,
} from "./videoNarrativeAnalysisTypes";
import { buildData2ContentNarrativeContract } from "./data2contentNarrativeContract";
import type { CreatorVideoNarrativeEvidenceAnchors } from "./creatorVideoNarrativeDiagnosisTypes";
import type { PostCreationVideoSeed } from "./videoNarrativePostCreationSeed";

export type VideoNarrativeDiagnosisAccessLevel = "free" | "premium" | "instagram_optimized";

export type VideoNarrativeDiagnosisSectionKey =
  | "main_narrative"
  | "what_video_communicates"
  | "creator_intent"
  | "strategic_reading"
  | "strength"
  | "weakness"
  | "recommended_adjustment"
  | "suggested_hook"
  | "brand_potential"
  | "blueprint"
  | "script_direction"
  | "next_actions"
  | "instagram_comparison"
  | "performance_context"
  | "creator_profile_learning";

export type VideoNarrativeDiagnosisLockedReason =
  | "requires_premium"
  | "requires_instagram_connection"
  | "requires_more_context";

export interface VideoNarrativeDiagnosisLockedSection {
  key: VideoNarrativeDiagnosisSectionKey;
  title: string;
  reason: VideoNarrativeDiagnosisLockedReason;
  message: string;
}

export type VideoNarrativeDiagnosisCreatorSignalType =
  | "content_goal"
  | "creative_preference"
  | "commercial_preference"
  | "recurring_pain"
  | "hook_preference"
  | "format_preference"
  | "brand_territory"
  | "collab_preference"
  | "production_constraint"
  | "audience_relationship"
  | "positioning_signal"
  | "unknown";

export type VideoNarrativeDiagnosisCreatorSignalSource =
  | "creator_question"
  | "quiz_answer"
  | "video_analysis"
  | "seed"
  | "instagram_context"
  | "diagnosis_inference";

export interface VideoNarrativeDiagnosisCreatorSignal {
  id: string;
  type: VideoNarrativeDiagnosisCreatorSignalType;
  value: string;
  source: VideoNarrativeDiagnosisCreatorSignalSource;
  confidence: "low" | "medium" | "high";
  evidence: string | null;
  shouldPersistLater: boolean;
}

export interface VideoNarrativeDiagnosisQuizAnswer {
  questionId: string;
  key: string;
  value: string | string[] | boolean | null;
  label?: string | null;
}

export interface VideoNarrativeCreatorProfileContext {
  knownSignals: VideoNarrativeDiagnosisCreatorSignal[];
  recurringNarratives?: string[];
  recurringPainPoints?: string[];
  preferredFormats?: string[];
  preferredBrandTerritories?: string[];
}

export interface VideoNarrativeInstagramContext {
  connected: boolean;
  topNarratives?: string[];
  topFormats?: string[];
  topContexts?: string[];
  strongestMetricsSummary?: string | null;
  brandTerritories?: string[];
}

export interface VideoNarrativeDiagnosisInput {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  analysis: VideoNarrativeAnalysis;
  seed: PostCreationVideoSeed;
  creatorQuestion?: string | null;
  quizAnswers?: VideoNarrativeDiagnosisQuizAnswer[];
  creatorProfile?: VideoNarrativeCreatorProfileContext | null;
  instagramContext?: VideoNarrativeInstagramContext | null;
}

export interface VideoNarrativeDiagnosisBrandPotential {
  enabled: boolean;
  territories: string[];
  whyItFits: string | null;
  locked: boolean;
}

export interface VideoNarrativeDiagnosisBlueprint {
  whatToPost: string | null;
  whyThisPath: string | null;
  howItShouldWork: string | null;
  scenes: string[];
  locked: boolean;
}

export interface VideoNarrativeDiagnosisNextAction {
  id: string;
  label: string;
  description: string | null;
  locked: boolean;
}

export interface VideoNarrativeStrategicDiagnosis {
  id: string;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  mainNarrative: string | null;
  whatVideoCommunicates: string | null;
  creatorIntent: string | null;
  strategicReading: string | null;
  strength: string | null;
  weakness: string | null;
  recommendedAdjustment: string | null;
  suggestedHook: string | null;
  brandPotential: VideoNarrativeDiagnosisBrandPotential;
  blueprint: VideoNarrativeDiagnosisBlueprint;
  scriptDirection: {
    opening: string | null;
    development: string[];
    closing: string | null;
    tone: string | null;
    locked: boolean;
  };
  nextActions: VideoNarrativeDiagnosisNextAction[];
  lockedSections: VideoNarrativeDiagnosisLockedSection[];
  creatorSignals: VideoNarrativeDiagnosisCreatorSignal[];
  instagramComparison: {
    connected: boolean;
    summary: string | null;
    matchingNarratives: string[];
    matchingFormats: string[];
    locked: boolean;
  };
  evidenceAnchors?: CreatorVideoNarrativeEvidenceAnchors;
  /** Structured life-asset dimensions extracted from watching the video. */
  contentContext?: VideoNarrativeContentContext;
  /** Coherence verdict against the creator's confirmed top-performing pattern. */
  narrativeCoherence?: VideoNarrativeCoherence;
  contentPotentialScan?: import("./videoNarrativeContentPotentialScan").VideoNarrativeContentPotentialScan;
  createdAt: string | null;
}

export const VIDEO_NARRATIVE_DIAGNOSIS_FREE_UNLOCKED_SECTIONS: VideoNarrativeDiagnosisSectionKey[] = [
  "main_narrative",
  "what_video_communicates",
  "creator_intent",
  "strategic_reading",
  "strength",
  "weakness",
  "recommended_adjustment",
  "suggested_hook",
  "brand_potential",
  "blueprint",
  "next_actions",
];

export const VIDEO_NARRATIVE_DIAGNOSIS_PREMIUM_UNLOCKED_SECTIONS: VideoNarrativeDiagnosisSectionKey[] = [
  ...VIDEO_NARRATIVE_DIAGNOSIS_FREE_UNLOCKED_SECTIONS,
  "script_direction",
  "creator_profile_learning",
];

export const VIDEO_NARRATIVE_DIAGNOSIS_INSTAGRAM_UNLOCKED_SECTIONS: VideoNarrativeDiagnosisSectionKey[] = [
  ...VIDEO_NARRATIVE_DIAGNOSIS_PREMIUM_UNLOCKED_SECTIONS,
  "instagram_comparison",
  "performance_context",
];

const BLOCKED_TERMS = [
  "viralizar garantido",
  "treinado permanentemente",
  "resposta correta",
  "garantido",
  "certeza",
  "comprovado",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "venceu",
  "perdeu",
];

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function cleanText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return sanitizeVideoNarrativeDiagnosisText(value);
}

function cleanTexts(values: Array<string | null | undefined>): string[] {
  return values.map(cleanText).filter((value): value is string => Boolean(value));
}

function normalize(value: string): string {
  return sanitizeVideoNarrativeDiagnosisText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function answerValueToText(value: VideoNarrativeDiagnosisQuizAnswer["value"]): string | null {
  if (Array.isArray(value)) return cleanTexts(value).join(", ") || null;
  if (typeof value === "boolean") return value ? "sim" : "não";
  return cleanText(value ?? null);
}

function makeSignal(params: {
  type: VideoNarrativeDiagnosisCreatorSignalType;
  value: string | null | undefined;
  source: VideoNarrativeDiagnosisCreatorSignalSource;
  confidence?: "low" | "medium" | "high";
  evidence?: string | null;
}): VideoNarrativeDiagnosisCreatorSignal | null {
  const value = cleanText(params.value);
  if (!value) return null;

  return {
    id: `${params.source}-${params.type}-${normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "signal"}`,
    type: params.type,
    value,
    source: params.source,
    confidence: params.confidence ?? "medium",
    evidence: cleanText(params.evidence ?? null),
    shouldPersistLater: false,
  };
}

function firstUseful(values: Array<string | null | undefined>): string | null {
  return cleanTexts(values)[0] ?? null;
}

function getCreatorIntent(input: VideoNarrativeDiagnosisInput): string | null {
  const answer = (input.quizAnswers ?? []).find((item) =>
    ["objective", "intent", "goal"].includes(normalize(item.key)),
  );

  return firstUseful([
    answerValueToText(answer?.value ?? null),
    input.creatorQuestion,
    input.seed.creatorQuestion,
    input.analysis.d2cClassification.intent,
  ]);
}

function getMainNarrative(input: VideoNarrativeDiagnosisInput): string | null {
  return firstUseful([
    input.seed.detectedNarrative,
    input.analysis.d2cClassification.narrative,
    input.analysis.summary,
  ]);
}

function getWhatVideoCommunicates(mainNarrative: string | null, input: VideoNarrativeDiagnosisInput): string | null {
  const context = firstUseful([input.analysis.d2cClassification.context, input.analysis.summary, input.creatorQuestion]);
  if (!mainNarrative && !context) return null;

  const basis = mainNarrative ?? context;
  return sanitizeVideoNarrativeDiagnosisText(
    `Esse vídeo comunica uma direção de conteúdo ligada a ${basis}.`,
  );
}

function getStrategicReading(params: {
  mainNarrative: string | null;
  creatorIntent: string | null;
  input: VideoNarrativeDiagnosisInput;
  recommendedAdjustment: string | null;
}): string | null {
  const videoPart = params.mainNarrative ?? params.input.analysis.summary;
  const objectivePart = params.creatorIntent;
  const pathPart =
    params.recommendedAdjustment ??
    params.input.seed.strategicDiagnosis ??
    params.input.seed.initialIdea ??
    params.input.analysis.blueprintSuggestion.whatToPost;

  if (!videoPart && !objectivePart && !pathPart) return null;

  return cleanText([
    videoPart ? `Pelo vídeo, a leitura principal aponta para ${videoPart}.` : null,
    objectivePart ? `Pelo objetivo declarado, a análise deve priorizar ${objectivePart}.` : null,
    pathPart ? `O melhor caminho é ${pathPart}.` : null,
  ].filter(Boolean).join(" "));
}

function buildBrandPotential(input: VideoNarrativeDiagnosisInput): VideoNarrativeDiagnosisBrandPotential {
  const isFree = input.accessLevel === "free";
  const instagramTerritories =
    input.accessLevel === "instagram_optimized" && input.instagramContext?.connected
      ? input.instagramContext.brandTerritories ?? []
      : [];
  const territories = Array.from(new Set(cleanTexts([
    ...input.analysis.brandMatch.territories,
    ...input.seed.brandMatchHints,
    ...instagramTerritories,
  ])));

  return {
    enabled: input.analysis.brandMatch.enabled || territories.length > 0,
    territories: isFree ? territories.slice(0, 2) : territories,
    whyItFits: cleanText(input.analysis.brandMatch.whyBrandsWouldFit ?? input.seed.brandMatchHints[0] ?? null),
    locked: false,
  };
}

function buildBlueprint(input: VideoNarrativeDiagnosisInput): VideoNarrativeDiagnosisBlueprint {
  const isFree = input.accessLevel === "free";
  const whatToPost = firstUseful([input.seed.blueprintDraft.whatToPost, input.analysis.blueprintSuggestion.whatToPost]);
  const whyThisPath = firstUseful([input.seed.blueprintDraft.whyThisPath, input.analysis.blueprintSuggestion.whyThisPath]);
  const howItShouldWork = isFree
    ? null
    : firstUseful([input.seed.blueprintDraft.howItShouldWork, input.analysis.blueprintSuggestion.howItShouldWork]);
  const scenes = cleanTexts(input.seed.blueprintDraft.scenes.length ? input.seed.blueprintDraft.scenes : input.analysis.blueprintSuggestion.scenes);

  return {
    whatToPost,
    whyThisPath,
    howItShouldWork,
    scenes: isFree ? scenes.slice(0, 2) : scenes,
    locked: !whatToPost && !whyThisPath && scenes.length === 0,
  };
}

function buildNextActions(input: VideoNarrativeDiagnosisInput): VideoNarrativeDiagnosisNextAction[] {
  const actions: VideoNarrativeDiagnosisNextAction[] = [
    {
      id: "improve_hook",
      label: "Melhorar gancho",
      description: "Refinar a abertura antes de transformar o vídeo em roteiro.",
      locked: false,
    },
    {
      id: "turn_into_blueprint",
      label: "Transformar em blueprint",
      description: "Usar a leitura narrativa para estruturar uma pauta.",
      locked: false,
    },
    {
      id: "generate_script",
      label: "Gerar roteiro",
      description: "Converter o blueprint em direção de roteiro.",
      locked: input.accessLevel === "free",
    },
    {
      id: "ad_version",
      label: "Criar versão para publi",
      description: "Adaptar a narrativa para um encaixe comercial cuidadoso.",
      locked: input.accessLevel === "free",
    },
    {
      id: "explore_brands",
      label: "Explorar marcas potenciais",
      description: "Cruzar territórios de marca com a narrativa detectada.",
      locked: input.accessLevel === "free",
    },
  ];

  if (!input.instagramContext?.connected) {
    actions.push({
      id: "connect_instagram",
      label: "Conectar Instagram para otimizar diagnóstico",
      description: "Usar histórico futuro para comparar narrativas e formatos.",
      locked: input.accessLevel !== "instagram_optimized",
    });
  }

  return input.accessLevel === "free" ? actions.slice(0, 2) : actions;
}

function buildInstagramComparison(
  input: VideoNarrativeDiagnosisInput,
  mainNarrative: string | null,
): VideoNarrativeStrategicDiagnosis["instagramComparison"] {
  const connected = input.instagramContext?.connected === true;
  const unlocked = input.accessLevel === "instagram_optimized" && connected;
  if (!unlocked) {
    return { connected, summary: null, matchingNarratives: [], matchingFormats: [], locked: true };
  }

  const narrativeCandidates = cleanTexts([
    mainNarrative,
    ...(input.creatorProfile?.recurringNarratives ?? []),
  ]);
  const formatCandidates = cleanTexts([
    input.seed.suggestedFormat,
    input.analysis.d2cClassification.format === "unknown" ? null : input.analysis.d2cClassification.format,
    ...(input.creatorProfile?.preferredFormats ?? []),
  ]);
  const topNarratives = cleanTexts(input.instagramContext?.topNarratives ?? []);
  const topFormats = cleanTexts(input.instagramContext?.topFormats ?? []);

  const matchingNarratives = intersectByNormalized(narrativeCandidates, topNarratives);
  const matchingFormats = intersectByNormalized(formatCandidates, topFormats);
  const summary =
    matchingNarratives.length > 0 || matchingFormats.length > 0
      ? cleanText(`O vídeo conversa com padrões já vistos no histórico conectado: ${[...matchingNarratives, ...matchingFormats].join(", ")}.`)
      : "Ainda falta histórico suficiente para comparar esta narrativa com segurança.";

  return {
    connected,
    summary,
    matchingNarratives,
    matchingFormats,
    locked: false,
  };
}

function intersectByNormalized(left: string[], right: string[]): string[] {
  const rightNormalized = new Set(right.map(normalize));
  return left.filter((item) => rightNormalized.has(normalize(item)));
}

export function sanitizeVideoNarrativeDiagnosisText(value: string): string {
  let sanitized = sanitizeVideoNarrativeAnalysisText(value);
  sanitized = sanitized.replace(/\bAIza[0-9A-Za-z_-]{8,}/g, "[redigido]");
  sanitized = sanitized.replace(/\b(?:GEMINI_API_KEY|GOOGLE_GENAI_API_KEY)=\S+/g, "[redigido]");
  sanitized = sanitized.replace(/\b[A-Za-z0-9+/]{120,}={0,2}\b/g, "[redigido]");
  sanitized = sanitized.replace(/\bhttps?:\/\/\S*(?:\?|&)(?:token|signature|sig|X-Amz-Signature|Expires)=\S*/gi, "[redigido]");

  BLOCKED_TERMS.forEach((term) => {
    sanitized = sanitized.replace(new RegExp(term.replace(/\s+/g, "\\s+"), "gi"), "[redigido]");
  });

  return sanitized.trim();
}

export function getVideoNarrativeDiagnosisLockedSections(input: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected?: boolean;
}): VideoNarrativeDiagnosisLockedSection[] {
  const locked: VideoNarrativeDiagnosisLockedSection[] = [];

  if (input.accessLevel === "free") {
    locked.push(
      {
        key: "script_direction",
        title: "Direção de roteiro completa",
        reason: "requires_premium",
        message: "Disponível em planos com diagnóstico narrativo ampliado.",
      },
      {
        key: "creator_profile_learning",
        title: "Aprendizado progressivo do criador",
        reason: "requires_premium",
        message: "Os sinais podem ser usados como contexto interno futuro, sem persistência automática nesta fase.",
      },
    );
  }

  if (input.accessLevel !== "instagram_optimized" || input.instagramConnected !== true) {
    locked.push(
      {
        key: "instagram_comparison",
        title: "Comparação com Instagram",
        reason: "requires_instagram_connection",
        message: "Conectar Instagram no futuro permitirá comparar narrativa e formato com histórico do perfil.",
      },
      {
        key: "performance_context",
        title: "Contexto de performance",
        reason: "requires_instagram_connection",
        message: "O contexto de performance depende de Instagram conectado e não usa dados reais nesta fase.",
      },
    );
  }

  return locked.map((section) => ({
    ...section,
    title: sanitizeVideoNarrativeDiagnosisText(section.title),
    message: sanitizeVideoNarrativeDiagnosisText(section.message),
  }));
}

export function extractVideoNarrativeCreatorSignals(
  input: VideoNarrativeDiagnosisInput,
): VideoNarrativeDiagnosisCreatorSignal[] {
  const signals: Array<VideoNarrativeDiagnosisCreatorSignal | null> = [];
  const question = cleanText(input.creatorQuestion ?? input.seed.creatorQuestion);
  const normalizedQuestion = question ? normalize(question) : "";

  (input.quizAnswers ?? []).forEach((answer) => {
    const key = normalize(answer.key);
    const value = answerValueToText(answer.value);
    if (!value) return;

    if (["objective", "intent", "goal"].includes(key)) signals.push(makeSignal({ type: "content_goal", value, source: "quiz_answer", confidence: "high", evidence: answer.label ?? answer.questionId }));
    else if (key.includes("hook")) signals.push(makeSignal({ type: "hook_preference", value, source: "quiz_answer", evidence: answer.label ?? answer.questionId }));
    else if (key.includes("format")) signals.push(makeSignal({ type: "format_preference", value, source: "quiz_answer", evidence: answer.label ?? answer.questionId }));
    else if (key.includes("brand")) signals.push(makeSignal({ type: "brand_territory", value, source: "quiz_answer", evidence: answer.label ?? answer.questionId }));
    else if (key.includes("collab")) signals.push(makeSignal({ type: "collab_preference", value, source: "quiz_answer", evidence: answer.label ?? answer.questionId }));
    else if (key.includes("effort")) signals.push(makeSignal({ type: "production_constraint", value, source: "quiz_answer", evidence: answer.label ?? answer.questionId }));
    else if (key.includes("narrative")) signals.push(makeSignal({ type: "creative_preference", value, source: "quiz_answer", evidence: answer.label ?? answer.questionId }));
  });

  if (question) {
    if (normalizedQuestion.includes("gancho")) signals.push(makeSignal({ type: "recurring_pain", value: "hook_improvement", source: "creator_question", evidence: question }));
    if (/(marca|publi|brand)/.test(normalizedQuestion)) signals.push(makeSignal({ type: "commercial_preference", value: "brand_or_adaptation_interest", source: "creator_question", evidence: question }));
    if (/(collab|colaboracao)/.test(normalizedQuestion)) signals.push(makeSignal({ type: "collab_preference", value: "collaboration_interest", source: "creator_question", evidence: question }));
    if (normalizedQuestion.includes("vale postar")) signals.push(makeSignal({ type: "content_goal", value: "validate_before_posting", source: "creator_question", evidence: question }));
  }

  input.analysis.profileSignals.forEach((signal) => {
    signals.push(makeSignal({
      type: signal.type === "brand_territory" ? "brand_territory" : "positioning_signal",
      value: signal.value,
      source: "video_analysis",
      confidence: signal.confidence === "unknown" ? "low" : signal.confidence,
      evidence: input.analysis.summary,
    }));
  });

  cleanTexts(input.seed.brandMatchHints).forEach((hint) => {
    signals.push(makeSignal({ type: "brand_territory", value: hint, source: "seed", evidence: input.seed.initialIdea }));
  });

  if (input.instagramContext?.connected) {
    cleanTexts(input.instagramContext.topNarratives ?? []).forEach((item) => {
      signals.push(makeSignal({ type: "positioning_signal", value: item, source: "instagram_context", confidence: "low", evidence: input.instagramContext?.strongestMetricsSummary ?? null }));
    });
    cleanTexts(input.instagramContext.brandTerritories ?? []).forEach((item) => {
      signals.push(makeSignal({ type: "brand_territory", value: item, source: "instagram_context", confidence: "low", evidence: input.instagramContext?.strongestMetricsSummary ?? null }));
    });
  }

  return signals.filter((signal): signal is VideoNarrativeDiagnosisCreatorSignal => Boolean(signal));
}

export function buildVideoNarrativeStrategicDiagnosis(
  input: VideoNarrativeDiagnosisInput,
): VideoNarrativeStrategicDiagnosis {
  const rawMainNarrative = getMainNarrative(input);
  const creatorIntent = getCreatorIntent(input);
  const strength = firstUseful(input.analysis.diagnosis.strengths);
  const weakness = firstUseful(input.analysis.diagnosis.weaknesses);
  const recommendedAdjustment = firstUseful([input.analysis.diagnosis.recommendedAdjustments[0], input.seed.strategicDiagnosis]);
  const suggestedHook =
    input.analysis.hook.strength === "weak" && recommendedAdjustment
      ? recommendedAdjustment
      : firstUseful([input.seed.scriptDirection.opening, input.analysis.hook.detected]);
  const brandPotential = buildBrandPotential(input);
  const hasNarrativeContractInput = Boolean(firstUseful([
    rawMainNarrative,
    input.analysis.summary,
    input.analysis.d2cClassification.context,
    input.analysis.blueprintSuggestion.whyThisPath,
    strength,
    weakness,
    recommendedAdjustment,
    input.analysis.profileSignals[0]?.value,
    input.analysis.spokenTopics[0],
    brandPotential.territories[0],
  ]));
  const narrativeContract = hasNarrativeContractInput ? buildData2ContentNarrativeContract({
    videoSubject: input.analysis.d2cClassification.context ?? input.analysis.summary,
    mainNarrative: rawMainNarrative,
    whatVideoCommunicates: input.analysis.summary ?? input.analysis.d2cClassification.context,
    creatorIntent,
    strategicReading: input.analysis.blueprintSuggestion.whyThisPath ?? input.seed.strategicDiagnosis,
    strength,
    attentionPoint: weakness,
    recommendedAdjustment,
    suggestedHook,
    creatorSignals: [
      ...input.analysis.spokenTopics,
      ...input.analysis.profileSignals.map((signal) => signal.value),
    ],
    brandTerritories: brandPotential.territories,
    nextActions: input.analysis.blueprintSuggestion.scenes,
  }) : null;
  const mainNarrative = cleanText(narrativeContract?.centralNarrativeCandidate ?? rawMainNarrative);
  const blueprint = buildBlueprint(input);
  const instagramComparison = buildInstagramComparison(input, mainNarrative);
  const scriptUnlocked = input.accessLevel !== "free";

  return {
    id: `video-narrative-diagnosis-${input.analysis.id}`,
    accessLevel: input.accessLevel,
    mainNarrative,
    whatVideoCommunicates: cleanText(narrativeContract?.creatorPointOfView ?? getWhatVideoCommunicates(mainNarrative, input)),
    creatorIntent,
    strategicReading: cleanText(narrativeContract?.strategicThesis ?? getStrategicReading({
      mainNarrative,
      creatorIntent,
      input,
      recommendedAdjustment,
    })),
    strength,
    weakness,
    recommendedAdjustment: cleanText(narrativeContract?.tension ?? recommendedAdjustment),
    suggestedHook,
    brandPotential,
    blueprint,
    scriptDirection: {
      opening: scriptUnlocked ? cleanText(input.seed.scriptDirection.opening) : null,
      development: scriptUnlocked ? cleanTexts(input.seed.scriptDirection.development) : [],
      closing: scriptUnlocked ? cleanText(input.seed.scriptDirection.closing) : null,
      tone: scriptUnlocked ? cleanText(input.seed.scriptDirection.tone) : null,
      locked: !scriptUnlocked,
    },
    nextActions: buildNextActions(input),
    lockedSections: getVideoNarrativeDiagnosisLockedSections({
      accessLevel: input.accessLevel,
      instagramConnected: input.instagramContext?.connected,
    }),
    creatorSignals: extractVideoNarrativeCreatorSignals(input),
    instagramComparison,
    evidenceAnchors: input.analysis.evidenceAnchors,
    ...(input.analysis.contentContext ? { contentContext: input.analysis.contentContext } : {}),
    ...(input.analysis.narrativeCoherence ? { narrativeCoherence: input.analysis.narrativeCoherence } : {}),
    ...(input.analysis.contentPotentialScan ? { contentPotentialScan: input.analysis.contentPotentialScan } : {}),
    createdAt: input.analysis.createdAt ?? input.seed.createdAt ?? null,
  };
}

export function hasUsefulVideoNarrativeStrategicDiagnosis(
  diagnosis: VideoNarrativeStrategicDiagnosis,
): boolean {
  return Boolean(
    hasText(diagnosis.mainNarrative) ||
      hasText(diagnosis.strategicReading) ||
      hasText(diagnosis.recommendedAdjustment) ||
      hasText(diagnosis.blueprint.whatToPost) ||
      hasText(diagnosis.suggestedHook),
  );
}
