import type {
  CreatorVideoNarrativeDiagnosisContributionType,
  CreatorVideoNarrativeEvidenceAnchors,
  CreatorVideoNarrativeEvidenceChapterHint,
  CreatorVideoNarrativeDiagnosisInput,
  CreatorVideoNarrativeDiagnosisSource,
  CreatorVideoNarrativeDiagnosisVideoMetadata,
  VideoNarrativeContentContext,
  VideoNarrativeCoherence,
} from "./creatorVideoNarrativeDiagnosisTypes";
import type { VideoNarrativeContentPotentialScan } from "./videoNarrativeContentPotentialScan";
import { sanitizeCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisSanitizer";
import {
  buildData2ContentNarrativeContract,
  compactD2CNextExperiment,
  compactD2CTension,
} from "./data2contentNarrativeContract";
import type { VideoNarrativeStrategicDiagnosis } from "./videoNarrativeDiagnosisLearningModel";
import type { VideoNarrativeEvolvingDiagnosis } from "./videoNarrativeEvolvingDiagnosisContract";
import type { VideoNarrativeDiagnosisPresentation } from "./videoNarrativeDiagnosisPresentationModel";
import type { PostCreationVideoSeed } from "./videoNarrativePostCreationSeed";

export interface CreatorVideoNarrativeDiagnosisMapperParams {
  userId: string;
  source: CreatorVideoNarrativeDiagnosisSource;
  creatorGoal: string;
  selectedGoalOption: string;
  safeVideoMetadata?: CreatorVideoNarrativeDiagnosisVideoMetadata & Record<string, unknown>;
  strategicDiagnosis: VideoNarrativeStrategicDiagnosis;
  evolvingDiagnosis: VideoNarrativeEvolvingDiagnosis;
  presentation: VideoNarrativeDiagnosisPresentation;
  seed?: PostCreationVideoSeed | null;
  createdAt?: Date | string | null;
  analyzedAt?: Date | string | null;
}

const FALLBACK = {
  speechLimited: "A leitura de fala ainda e limitada para este video; vale confirmar abertura, ritmo e fechamento em novas amostras.",
  productionLimited: "A leitura de producao ainda e limitada; os proximos videos ajudam a separar escolha criativa de restricao tecnica.",
  commercialLimited: "Existe apenas uma oportunidade futura em observacao, sem encaixe comercial real ou promessa comercial.",
};

const BLOCKED_OUTPUT_TERMS: Array<[RegExp, string]> = [
  [/data:[^;]+;base64,[A-Za-z0-9+/=]+/gi, "[base64-redacted]"],
  [/\b(?:uploads|video-narrative|mobile-strategic-profile|tmp|temporary)\/[A-Za-z0-9._/-]+\.(mp4|mov|webm|mkv)\b/gi, "[object-key-redacted]"],
  [/https?:\/\/[^\s"'<>]+[?&](x-amz-signature|x-goog-signature|signature|expires|token|policy|x-amz-credential)=\S*/gi, "[signed-url-redacted]"],
  [/\bviralizar\b/gi, "crescer com consistencia"],
  [/\bscore\b/gi, "leitura"],
  [/\bnota\b/gi, "leitura"],
  [/\bmatch\s+real\b/gi, "territorio possivel"],
  [/\bmatch\s+comprovado\b/gi, "fit narrativo"],
  [/\bpubli\s+garantida\b/gi, "oportunidade futura"],
  [/\bpatroc[ií]nio\s+garantido\b/gi, "oportunidade futura"],
  [/\bgarantid[oa]\b/gi, "possivel"],
  [/\bcerteza\b/gi, "hipotese"],
  [/\bGemini\b/g, "modelo"],
  [/\bstorage\b/gi, "referencia temporaria"],
  [/\braw response\b/gi, "resposta estruturada"],
  [/\bobjectKey\b/g, "referencia removida"],
  [/\bsigned URL\b/gi, "referencia removida"],
];

const DANGEROUS_PARAM_KEYS = new Set([
  "rawGeminiResponse",
  "rawModelResponse",
  "geminiResponse",
  "providerResponse",
  "modelResponse",
]);

function assertNoRawModelPayload(value: unknown, path = "params"): void {
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DANGEROUS_PARAM_KEYS.has(key)) {
      throw new Error(`Mapper de leitura de video nao aceita raw model output em ${path}.${key}`);
    }
    assertNoRawModelPayload(child, `${path}.${key}`);
  }
}

function clean(value: string | null | undefined, fallback = ""): string {
  const raw = value?.trim() || fallback;
  const normalized = BLOCKED_OUTPUT_TERMS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    raw,
  );
  return normalized.replace(/\s+/g, " ").trim();
}

function firstText(values: Array<string | null | undefined>, fallback: string): string {
  return clean(values.find((value) => value?.trim()), fallback);
}

function shortText(value: string, maxLength: number): string {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function isShortSpeechCandidate(value: string | null | undefined): value is string {
  const text = clean(value ?? "");
  if (!text || text.length > 180) return false;
  if (text.split(/\s+/).length > 24) return false;
  if (/https?:\/\/|objectKey|signedUrl|uploadUrl|thumbnailUrl|localPath|storageProviderPath|raw response/i.test(text)) {
    return false;
  }
  return true;
}

function buildAiSuggestedQuoteAnchor(params: {
  quote: string | null | undefined;
  quoteRole: CreatorVideoNarrativeEvidenceAnchors["speechQuotes"][number]["quoteRole"];
  chapterHint: CreatorVideoNarrativeEvidenceChapterHint;
  whyItMatters: string;
}): CreatorVideoNarrativeEvidenceAnchors["speechQuotes"][number] | null {
  if (!isShortSpeechCandidate(params.quote)) return null;
  return {
    quote: shortText(params.quote, 180),
    source: "ai_suggested",
    quoteRole: params.quoteRole,
    whyItMatters: shortText(params.whyItMatters, 260),
    chapterHint: params.chapterHint,
  };
}

function dateFrom(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function dayMonth(value: Date | string | null | undefined): string {
  const date = dateFrom(value) ?? new Date();
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function words(value: string): Set<string> {
  return new Set(
    clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4),
  );
}

function hasCompatibleRecurringPattern(params: {
  recurringPatterns: string[];
  mainNarrative: string;
  strategicReading: string;
}): boolean {
  const candidateWords = new Set([...words(params.mainNarrative), ...words(params.strategicReading)]);
  if (candidateWords.size === 0) return false;

  return params.recurringPatterns.some((pattern) => {
    const patternWords = words(pattern);
    return [...patternWords].some((word) => candidateWords.has(word));
  });
}

function commercialTerritories(params: {
  strategicDiagnosis: VideoNarrativeStrategicDiagnosis;
  evolvingDiagnosis: VideoNarrativeEvolvingDiagnosis;
}): string[] {
  return Array.from(new Set([
    ...params.strategicDiagnosis.brandPotential.territories,
    ...params.evolvingDiagnosis.opportunities
      .filter((opportunity) => opportunity.type === "brand_territory")
      .map((opportunity) => opportunity.label),
  ].map((item) => clean(item)).filter(Boolean))).slice(0, 6);
}

function mapProfileContribution(params: {
  strategicDiagnosis: VideoNarrativeStrategicDiagnosis;
  evolvingDiagnosis: VideoNarrativeEvolvingDiagnosis;
}): CreatorVideoNarrativeDiagnosisInput["profileContribution"] {
  const mainNarrative = clean(params.strategicDiagnosis.mainNarrative ?? "");
  const strategicReading = clean(params.strategicDiagnosis.strategicReading ?? "");
  const recurringPatterns = params.evolvingDiagnosis.recurringPatterns.map((item) => clean(item)).filter(Boolean);
  const hasRecurringPattern = hasCompatibleRecurringPattern({
    recurringPatterns,
    mainNarrative,
    strategicReading,
  });
  const territories = commercialTerritories(params);
  const hasCommercialSignal = params.strategicDiagnosis.brandPotential.enabled || territories.length > 0;
  const hasStrongVideoReading = Boolean(
    params.strategicDiagnosis.strength ||
      params.strategicDiagnosis.recommendedAdjustment ||
      params.strategicDiagnosis.blueprint.whatToPost,
  );
  const currentLevel = params.evolvingDiagnosis.currentLevel.id;
  const isFirstReading =
    currentLevel === "first_reading" ||
    params.evolvingDiagnosis.profileImpact.usefulSignalsCount <= 1 ||
    params.evolvingDiagnosis.profileImpact.recurringSignalsCount === 0;

  let type: CreatorVideoNarrativeDiagnosisContributionType = "needs_more_samples";
  let confidence: "low" | "medium" | "high" = "low";
  let weight: "low" | "medium" | "high" = "low";
  let reason = "Este video adiciona uma leitura inicial, mas ainda precisa de mais amostras antes de virar padrao.";
  let profileImpactPreview = "Entra como sinal em observacao para uma sintese futura do Perfil.";

  if (!mainNarrative && !strategicReading) {
    type = "weak_positioning_signal";
    reason = "A narrativa principal ainda esta pouco definida para influenciar o Perfil geral.";
    profileImpactPreview = "Ajuda a mostrar uma lacuna, mas nao muda a narrativa principal do Perfil.";
  } else if (hasRecurringPattern) {
    type = "confirms_existing_pattern";
    confidence = "high";
    weight = "high";
    reason = `Este video reforca um sinal recorrente ja visivel: ${shortText(recurringPatterns[0] ?? "padrao narrativo em formacao", 110)}.`;
    profileImpactPreview = "Reforca uma narrativa em formacao, mas ainda depende da sintese futura do Perfil.";
  } else if (hasCommercialSignal && !hasRecurringPattern && !isFirstReading) {
    type = "commercial_signal";
    confidence = "medium";
    weight = "medium";
    reason = "O video abre um territorio comercial possivel sem indicar encaixe comercial real ou oportunidade fechada.";
    profileImpactPreview = "Pode alimentar uma oportunidade futura se o mesmo territorio aparecer em mais leituras.";
  } else if (isFirstReading) {
    type = hasStrongVideoReading ? "opens_new_hypothesis" : "needs_more_samples";
    confidence = "low";
    weight = "low";
    reason = "Como primeira leitura, o video levanta uma hipotese sem definir o Perfil geral.";
    profileImpactPreview = "Cria uma primeira pista para acompanhar nas proximas analises.";
  } else if (hasStrongVideoReading && params.evolvingDiagnosis.profileImpact.recurringSignalsCount === 0) {
    type = "isolated_strong_video";
    confidence = "medium";
    weight = "low";
    reason = "A leitura do video e forte isoladamente, mas ainda nao aparece como recorrencia no Perfil.";
    profileImpactPreview = "Pode virar padrao se se repetir; por enquanto fica como leitura isolada.";
  } else if (params.evolvingDiagnosis.pendingSignals.some((signal) => signal.unlockPath === "analyze_more_videos")) {
    type = "opens_new_hypothesis";
    confidence = "medium";
    weight = "low";
    reason = "O video aponta uma direcao nova que ainda precisa de repeticao para ganhar peso.";
    profileImpactPreview = "Abre uma hipotese para o agregador futuro avaliar com mais videos.";
  }

  return {
    type,
    confidence,
    weight,
    reason,
    profileImpactPreview,
  };
}

function safeRememberedAs(params: CreatorVideoNarrativeDiagnosisMapperParams): string {
  const fromPresentation = params.presentation.priorityCards.find((card) => card.id === "main-reading")?.body;
  const contract = buildData2ContentNarrativeContract({
    videoSubject: params.strategicDiagnosis.whatVideoCommunicates,
    mainNarrative: params.strategicDiagnosis.mainNarrative,
    whatVideoCommunicates: params.strategicDiagnosis.whatVideoCommunicates,
    strategicReading: params.strategicDiagnosis.strategicReading,
    strength: params.strategicDiagnosis.strength,
    attentionPoint: params.strategicDiagnosis.weakness,
    recommendedAdjustment: params.strategicDiagnosis.recommendedAdjustment,
    creatorSignals: params.strategicDiagnosis.creatorSignals.map((signal) => signal.value),
    brandTerritories: params.strategicDiagnosis.brandPotential.territories,
  });
  const narrative = firstText([
    contract.videoSubject,
    contract.centralNarrativeCandidate,
    fromPresentation,
  ], "");

  if (narrative) return shortText(`Video sobre ${narrative.replace(/^esse video comunica\s+/i, "")}`, 120);
  return `Video analisado em ${dayMonth(params.analyzedAt ?? params.createdAt ?? params.strategicDiagnosis.createdAt)}`;
}

function mapSafeMetadata(params: CreatorVideoNarrativeDiagnosisMapperParams): CreatorVideoNarrativeDiagnosisInput["videoMetadata"] {
  return {
    ...params.safeVideoMetadata,
    analyzedAt: dateFrom(params.analyzedAt) ?? params.safeVideoMetadata?.analyzedAt,
    uploadedAt: params.safeVideoMetadata?.uploadedAt,
  };
}

function mapEvidenceAnchors(params: {
  creatorGoal: string;
  strategicDiagnosis: VideoNarrativeStrategicDiagnosis;
  evolvingDiagnosis: VideoNarrativeEvolvingDiagnosis;
  rememberedAs: string;
  profileContribution: CreatorVideoNarrativeDiagnosisInput["profileContribution"];
}): CreatorVideoNarrativeEvidenceAnchors {
  const providerAnchors = params.strategicDiagnosis.evidenceAnchors;
  const hasProviderAnchors = Boolean(
    providerAnchors &&
      (
        providerAnchors.speechQuotes.length > 0 ||
        providerAnchors.sceneAnchors.length > 0 ||
        providerAnchors.creatorIntentAnchor ||
        (providerAnchors.profilePatternAnchors?.length ?? 0) > 0 ||
        (providerAnchors.instagramAnchors?.length ?? 0) > 0
      ),
  );
  if (providerAnchors && hasProviderAnchors) {
    return {
      speechQuotes: providerAnchors.speechQuotes.slice(0, 4),
      sceneAnchors: providerAnchors.sceneAnchors.slice(0, 4),
      creatorIntentAnchor: providerAnchors.creatorIntentAnchor ?? null,
      profilePatternAnchors: providerAnchors.profilePatternAnchors ?? [],
      instagramAnchors: providerAnchors.instagramAnchors ?? [],
    };
  }

  const speechQuotes = [
    buildAiSuggestedQuoteAnchor({
      quote: params.strategicDiagnosis.suggestedHook,
      quoteRole: "hook",
      chapterHint: "tension",
      whyItMatters: "E uma sugestao de abertura para explicitar a promessa da cena; nao e tratada como fala real do creator.",
    }),
    buildAiSuggestedQuoteAnchor({
      quote: params.strategicDiagnosis.scriptDirection.opening,
      quoteRole: "promise",
      chapterHint: "movement",
      whyItMatters: "Serve como teste de frase para deixar a virada narrativa mais visivel.",
    }),
  ].filter((item): item is CreatorVideoNarrativeEvidenceAnchors["speechQuotes"][number] => Boolean(item));

  const sceneAnchors: CreatorVideoNarrativeEvidenceAnchors["sceneAnchors"] = params.rememberedAs
    ? [{
        description: shortText(params.rememberedAs, 260),
        source: "derived_scene",
        momentRole: "opening",
        whyItMatters: "Resume a cena documentada sem salvar video, thumbnail ou transcricao longa.",
        chapterHint: "pattern",
      }]
    : [];

  const creatorIntentAnchor = clean(params.creatorGoal)
    ? {
        source: "creator_goal" as const,
        statedGoal: shortText(params.creatorGoal, 260),
        interpretedGoal: shortText(params.strategicDiagnosis.creatorIntent ?? params.creatorGoal, 260),
        whyItMatters: "Ajuda a comparar a intencao declarada com a leitura do video.",
      }
    : null;

  const profilePatternAnchors = params.profileContribution.reason
    ? [{
        patternLabel: shortText(params.profileContribution.profileImpactPreview, 180),
        whyThisVideoRelates: shortText(params.profileContribution.reason, 260),
        evidenceCount: Math.max(1, params.evolvingDiagnosis.profileImpact.usefulSignalsCount),
      }]
    : [];

  const instagramAnchors = params.strategicDiagnosis.instagramComparison.connected
    ? [
        ...params.strategicDiagnosis.instagramComparison.matchingNarratives.map((signal) => ({
          signalLabel: shortText(signal, 180),
          whyItMatters: "Sinal do Instagram usado apenas como precisao contextual, nao como aba nova.",
          evidenceSummary: shortText(params.strategicDiagnosis.instagramComparison.summary ?? signal, 260),
        })),
        ...params.strategicDiagnosis.instagramComparison.matchingFormats.map((signal) => ({
          signalLabel: shortText(signal, 180),
          whyItMatters: "Formato observado no Instagram para comparar recorrencia narrativa.",
          evidenceSummary: shortText(params.strategicDiagnosis.instagramComparison.summary ?? signal, 260),
        })),
      ].slice(0, 4)
    : [];

  return {
    speechQuotes: speechQuotes.slice(0, 4),
    sceneAnchors: sceneAnchors.slice(0, 4),
    creatorIntentAnchor,
    profilePatternAnchors,
    instagramAnchors,
  };
}

export function mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
  params: CreatorVideoNarrativeDiagnosisMapperParams,
): CreatorVideoNarrativeDiagnosisInput {
  assertNoRawModelPayload(params);

  const strategic = params.strategicDiagnosis;
  const evolving = params.evolvingDiagnosis;
  const presentation = params.presentation;
  const seed = params.seed;
  const territories = commercialTerritories({ strategicDiagnosis: strategic, evolvingDiagnosis: evolving });
  const narrativeContract = buildData2ContentNarrativeContract({
    videoSubject: strategic.whatVideoCommunicates,
    mainNarrative: strategic.mainNarrative,
    whatVideoCommunicates: strategic.whatVideoCommunicates,
    creatorIntent: strategic.creatorIntent,
    strategicReading: strategic.strategicReading,
    strength: strategic.strength,
    attentionPoint: strategic.weakness,
    recommendedAdjustment: strategic.recommendedAdjustment,
    suggestedHook: strategic.suggestedHook,
    creatorSignals: strategic.creatorSignals.map((signal) => signal.value),
    brandTerritories: territories,
    nextActions: strategic.nextActions.map((action) => action.description).filter((value): value is string => Boolean(value)),
  });
  const primaryAdjustment = firstText(
    [
      narrativeContract.tension,
      compactD2CTension([strategic.recommendedAdjustment, presentation.priorityCards.find((card) => card.id === "primary-adjustment")?.body]),
    ],
    "Deixar mais claro o que a pessoa deve perceber nos primeiros segundos.",
  );
  const nextExperiment = firstText(
    [
      narrativeContract.nextExperiment,
      compactD2CNextExperiment([
        strategic.nextActions[0]?.description,
        seed?.blueprintDraft.whatToPost,
        evolving.nextSignalsToUnlock[0]?.action,
      ]),
    ],
    "Testar uma abertura mais direta e comparar a resposta em novas leituras.",
  );
  const profileContribution = mapProfileContribution({
    strategicDiagnosis: strategic,
    evolvingDiagnosis: evolving,
  });
  const rememberedAs = safeRememberedAs(params);

  const mapped: CreatorVideoNarrativeDiagnosisInput = {
    userId: params.userId,
    diagnosisId: strategic.id,
    status: "completed",
    source: params.source,
    videoMetadata: mapSafeMetadata(params),
    creatorGoal: clean(params.creatorGoal, "Entender o que este video revela estrategicamente."),
    selectedGoalOption: clean(params.selectedGoalOption, "strategic_reading"),
    videoReading: {
      title: shortText(firstText([narrativeContract.centralNarrativeCandidate, presentation.hero.title], "Leitura estrategica do video"), 140),
      rememberedAs,
      summary: firstText([narrativeContract.strategicThesis, strategic.whatVideoCommunicates, presentation.priorityCards[0]?.body], "Este video traz uma leitura inicial para o mapa estrategico."),
      whatVideoReveals: firstText([narrativeContract.creatorPointOfView, evolving.profileImpact.summary, strategic.strength], "Este video revela um sinal inicial sobre a narrativa do creator."),
      mainNarrative: firstText([narrativeContract.centralNarrativeCandidate, strategic.mainNarrative, seed?.detectedNarrative], "Narrativa em formacao."),
      creatorIntent: firstText([strategic.creatorIntent, params.creatorGoal], "Entender a direcao estrategica deste video."),
      dominantInsight: firstText([narrativeContract.strategicThesis, strategic.strategicReading, strategic.strength], "A leitura principal ainda precisa de mais contexto para ganhar peso."),
    },
    speechReading: {
      summary: firstText([strategic.suggestedHook, seed?.scriptDirection.opening], FALLBACK.speechLimited),
      openingRead: firstText([strategic.suggestedHook, seed?.scriptDirection.opening], "A abertura pode ficar mais explicita para orientar a leitura."),
      clarityRead: firstText([strategic.strength, strategic.whatVideoCommunicates], "A clareza ainda precisa ser confirmada em novas leituras."),
      pacingRead: firstText([seed?.scriptDirection.tone], "O ritmo de fala ainda nao tem leitura especifica suficiente."),
      suggestedLine: firstText([strategic.suggestedHook, seed?.scriptDirection.opening], "Comece pelo ponto que a audiencia reconhece de imediato."),
      suggestedOpening: firstText([seed?.scriptDirection.opening, strategic.suggestedHook], "Abrir com uma tensao simples antes da explicacao."),
      suggestedClosing: firstText([seed?.scriptDirection.closing], "Fechar com um proximo passo claro para a audiencia."),
    },
    productionReading: {
      // summary: derived from weakness/adjustment (captures what needs improvement) instead of the
      // old hardcoded generic string so the Execução card shows real per-reading text.
      summary: firstText(
        [strategic.weakness, strategic.recommendedAdjustment, strategic.whatVideoCommunicates],
        FALLBACK.productionLimited,
      ),
      // framing: scene descriptions imply visual composition choices
      framing: firstText(
        [strategic.blueprint.scenes[0], seed?.blueprintDraft.scenes[0], strategic.blueprint.whatToPost, seed?.blueprintDraft.whatToPost],
        "O enquadramento segue a narrativa detectada; confirmar composicao em novas leituras.",
      ),
      // lighting: strength captures what's working well visually (includes lighting/visual quality)
      lighting: firstText(
        [strategic.strength],
        "A iluminacao nao tem leitura especifica; o que funciona neste video apoia a narrativa visual.",
      ),
      // audio: script tone/opening delivery is the closest proxy for audio quality
      audio: firstText(
        [strategic.scriptDirection.tone, seed?.scriptDirection.tone, strategic.scriptDirection.opening],
        "O audio nao tem leitura isolada; o ritmo de fala segue o tom narrativo detectado.",
      ),
      editingRhythm: firstText([seed?.blueprintDraft.howItShouldWork], "O ritmo de edicao ainda precisa ser observado em mais detalhes."),
      firstFrame: firstText([strategic.suggestedHook], "O primeiro frame deve antecipar melhor a promessa do video."),
      visualClarity: firstText([strategic.whatVideoCommunicates], "A clareza visual ainda precisa ser confirmada por leitura de producao mais completa."),
    },
    commercialReading: {
      summary: territories.length > 0
        ? "O video sugere territorios comerciais futuros, sem encaixe comercial real ou promessa de publi."
        : FALLBACK.commercialLimited,
      brandTerritories: territories,
      whyItCouldFitBrands: firstText(
        [strategic.brandPotential.whyItFits, evolving.opportunities.find((item) => item.type === "brand_territory")?.description],
        "Pode fazer sentido como territorio futuro se a narrativa se repetir e ganhar contexto.",
      ),
      adAdaptationIdea: firstText(
        [strategic.nextActions.find((action) => action.id === "ad_version")?.description, strategic.blueprint.whatToPost],
        "Adaptar a leitura para uma versao com problema, contexto e escolha do creator.",
      ),
      limitations: "Nao ha encaixe comercial real, promessa comercial ou validacao de marca nesta etapa.",
    },
    strategicRecommendation: {
      mainAdjustment: primaryAdjustment,
      nextExperiment,
      whatToRepeat: firstText([narrativeContract.centralNarrativeCandidate, strategic.strength, strategic.mainNarrative], "Repetir o sinal mais claro que este video ja comunica."),
      whatToAvoid: firstText([strategic.weakness], "Evitar transformar uma leitura isolada em conclusao geral do Perfil."),
      successSignal: "Observar se o mesmo sinal aparece de novo em proximas leituras e respostas da audiencia.",
    },
    profileContribution,
    evidenceAnchors: mapEvidenceAnchors({
      creatorGoal: params.creatorGoal,
      strategicDiagnosis: strategic,
      evolvingDiagnosis: evolving,
      rememberedAs,
      profileContribution,
    }),
    ...(strategic.contentContext ? { contentContext: strategic.contentContext as VideoNarrativeContentContext } : {}),
    ...(strategic.narrativeCoherence ? { narrativeCoherence: strategic.narrativeCoherence as VideoNarrativeCoherence } : {}),
    ...(strategic.contentPotentialScan ? { contentPotentialScan: strategic.contentPotentialScan as VideoNarrativeContentPotentialScan } : {}),
    schemaVersion: "creator_video_narrative_diagnosis_v1",
  };

  const sanitized = sanitizeCreatorVideoNarrativeDiagnosisInput(mapped);

  return {
    userId: sanitized.userId,
    diagnosisId: sanitized.diagnosisId,
    status: sanitized.status,
    source: sanitized.source,
    videoMetadata: sanitized.videoMetadata,
    creatorGoal: sanitized.creatorGoal,
    selectedGoalOption: sanitized.selectedGoalOption,
    videoReading: sanitized.videoReading,
    speechReading: sanitized.speechReading,
    productionReading: sanitized.productionReading,
    commercialReading: sanitized.commercialReading,
    strategicRecommendation: sanitized.strategicRecommendation,
    profileContribution: sanitized.profileContribution,
    evidenceAnchors: sanitized.evidenceAnchors,
    ...(sanitized.contentContext ? { contentContext: sanitized.contentContext } : {}),
    ...(sanitized.narrativeCoherence ? { narrativeCoherence: sanitized.narrativeCoherence } : {}),
    ...(sanitized.contentPotentialScan ? { contentPotentialScan: sanitized.contentPotentialScan } : {}),
    schemaVersion: sanitized.schemaVersion,
  };
}
