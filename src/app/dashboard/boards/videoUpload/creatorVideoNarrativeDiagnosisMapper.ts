import type {
  CreatorVideoNarrativeDiagnosisContributionType,
  CreatorVideoNarrativeDiagnosisInput,
  CreatorVideoNarrativeDiagnosisSource,
  CreatorVideoNarrativeDiagnosisVideoMetadata,
} from "./creatorVideoNarrativeDiagnosisTypes";
import { sanitizeCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisSanitizer";
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
  const narrative = firstText([
    params.strategicDiagnosis.mainNarrative,
    params.strategicDiagnosis.whatVideoCommunicates,
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

export function mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
  params: CreatorVideoNarrativeDiagnosisMapperParams,
): CreatorVideoNarrativeDiagnosisInput {
  assertNoRawModelPayload(params);

  const strategic = params.strategicDiagnosis;
  const evolving = params.evolvingDiagnosis;
  const presentation = params.presentation;
  const seed = params.seed;
  const territories = commercialTerritories({ strategicDiagnosis: strategic, evolvingDiagnosis: evolving });
  const primaryAdjustment = firstText(
    [strategic.recommendedAdjustment, presentation.priorityCards.find((card) => card.id === "primary-adjustment")?.body],
    "Deixar mais claro o que a pessoa deve perceber nos primeiros segundos.",
  );
  const nextExperiment = firstText(
    [strategic.nextActions[0]?.description, seed?.blueprintDraft.whatToPost, evolving.nextSignalsToUnlock[0]?.action],
    "Testar uma abertura mais direta e comparar a resposta em novas leituras.",
  );

  const mapped: CreatorVideoNarrativeDiagnosisInput = {
    userId: params.userId,
    diagnosisId: strategic.id,
    status: "completed",
    source: params.source,
    videoMetadata: mapSafeMetadata(params),
    creatorGoal: clean(params.creatorGoal, "Entender o que este video revela estrategicamente."),
    selectedGoalOption: clean(params.selectedGoalOption, "strategic_reading"),
    videoReading: {
      title: shortText(firstText([strategic.mainNarrative, presentation.hero.title], "Leitura estrategica do video"), 140),
      rememberedAs: safeRememberedAs(params),
      summary: firstText([strategic.whatVideoCommunicates, presentation.priorityCards[0]?.body], "Este video traz uma leitura inicial para o mapa estrategico."),
      whatVideoReveals: firstText([evolving.profileImpact.summary, strategic.strength], "Este video revela um sinal inicial sobre a narrativa do creator."),
      mainNarrative: firstText([strategic.mainNarrative, seed?.detectedNarrative], "Narrativa em formacao."),
      creatorIntent: firstText([strategic.creatorIntent, params.creatorGoal], "Entender a direcao estrategica deste video."),
      dominantInsight: firstText([strategic.strategicReading, strategic.strength], "A leitura principal ainda precisa de mais contexto para ganhar peso."),
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
      summary: FALLBACK.productionLimited,
      framing: "Sem leitura especifica suficiente de enquadramento nesta camada estruturada.",
      lighting: "Sem leitura especifica suficiente de luz nesta camada estruturada.",
      audio: "Sem leitura especifica suficiente de audio nesta camada estruturada.",
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
      whatToRepeat: firstText([strategic.strength, strategic.mainNarrative], "Repetir o sinal mais claro que este video ja comunica."),
      whatToAvoid: firstText([strategic.weakness], "Evitar transformar uma leitura isolada em conclusao geral do Perfil."),
      successSignal: "Observar se o mesmo sinal aparece de novo em proximas leituras e respostas da audiencia.",
    },
    profileContribution: mapProfileContribution({
      strategicDiagnosis: strategic,
      evolvingDiagnosis: evolving,
    }),
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
    schemaVersion: sanitized.schemaVersion,
  };
}
