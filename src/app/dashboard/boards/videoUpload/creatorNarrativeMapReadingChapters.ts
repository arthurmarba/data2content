import type {
  CreatorVideoNarrativeDiagnosisDocument,
  CreatorVideoNarrativeEvidenceAnchors,
  CreatorVideoNarrativeDiagnosisProfileContribution,
} from "./creatorVideoNarrativeDiagnosisTypes";

export type CreatorNarrativeMapReadingChapterId =
  | "pattern"
  | "tension"
  | "movement"
  | "territory"
  | "video_reveal"
  | "profile_impact"
  | "opportunities";

export type CreatorNarrativeMapReadingChapterTone =
  | "mirror"
  | "attention"
  | "action"
  | "opportunity"
  | "neutral";

export interface CreatorNarrativeMapReadingChapter {
  id: CreatorNarrativeMapReadingChapterId;
  title: string;
  preview: string;
  fullReading: string;
  evidence: string[];
  action?: string | null;
  badgeLabel?: string | null;
  tone: CreatorNarrativeMapReadingChapterTone;
  locked?: boolean;
}

export interface CreatorNarrativeMapReadingPresentation {
  id: string;
  diagnosisId: string;
  headline: string;
  subheadline: string;
  statusLabel: string;
  chapters: CreatorNarrativeMapReadingChapter[];
  primaryAction: {
    label: string;
    intent: "analyze_another_video" | "connect_instagram" | "upgrade" | "open_full_reading";
    helper: string | null;
  };
  evidenceSummaryItems: string[];
  safetyNote?: string | null;
  createdAt: string | null;
}

export type CreatorNarrativeMapReadingDiagnosisShape = Pick<
  CreatorVideoNarrativeDiagnosisDocument,
  | "diagnosisId"
  | "status"
  | "videoReading"
  | "speechReading"
  | "productionReading"
  | "commercialReading"
  | "strategicRecommendation"
  | "profileContribution"
  | "evidenceAnchors"
  | "createdAt"
>;

export interface BuildCreatorNarrativeMapReadingPresentationInput {
  diagnosis: CreatorNarrativeMapReadingDiagnosisShape;
  accessLevel?: "free" | "premium" | "instagram_optimized";
  instagramConnected?: boolean;
  analyzedVideosCount?: number;
}

const TITLE_LIMIT = 56;
const PREVIEW_LIMIT = 180;
const FULL_READING_LIMIT = 900;
const ACTION_LIMIT = 180;
const MAX_EVIDENCE_ITEMS = 4;

const EMPTY_READING = "Ainda nao ha dado suficiente para uma leitura especifica.";

const UNSAFE_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/data:[^;]+;base64,[A-Za-z0-9+/=]+/gi, "referencia removida"],
  [/[A-Za-z0-9+/=]{1200,}/g, "referencia removida"],
  [/https?:\/\/[^\s"'<>]+/gi, "referencia removida"],
  [/\b(?:uploads|video-narrative|mobile-strategic-profile|tmp|temporary)\/[A-Za-z0-9._/-]+\.(mp4|mov|webm|mkv)\b/gi, "referencia removida"],
  [/\b(?:objectKey|signedUrl|signed URL|uploadUrl|thumbnailUrl|localPath|storageProviderPath)\b/gi, "referencia removida"],
  [/\b(?:storage|raw response|Gemini)\b/gi, "leitura estruturada"],
  [/\b(?:score|nota|pontos)\b/gi, "leitura"],
  [/\bviralizar\b/gi, "crescer com consistencia"],
  [/\bgarantid[oa]\b/gi, "possivel"],
  [/\bcerteza\b/gi, "hipotese"],
  [/\bcomprovad[oa]\b/gi, "em observacao"],
  [/\bmatch\s+real\b/gi, "fit narrativo possivel"],
  [/\bmatch\s+comprovado\b/gi, "fit narrativo possivel"],
  [/\bpubli\s+garantida\b/gi, "oportunidade em formacao"],
];

function cleanText(value: string | null | undefined, fallback = EMPTY_READING): string {
  const raw = value?.trim() || fallback;
  const cleaned = UNSAFE_TEXT_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    raw,
  );

  return cleaned.replace(/\s+/g, " ").trim();
}

function limitText(value: string, maxLength: number): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;

  const slice = text.slice(0, Math.max(0, maxLength - 3)).trim();
  return `${slice.replace(/[,.!?;:]$/g, "")}...`;
}

function firstText(values: Array<string | null | undefined>, fallback = EMPTY_READING): string {
  return cleanText(values.find((value) => value?.trim()), fallback);
}

function evidenceFrom(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();

  return values
    .map((value) => limitText(cleanText(value, ""), PREVIEW_LIMIT))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_EVIDENCE_ITEMS);
}

function speechAnchorLabel(anchor: CreatorVideoNarrativeEvidenceAnchors["speechQuotes"][number]): string {
  return anchor.source === "creator_spoken"
    ? `Fala: "${anchor.quote}"`
    : `Sugestão de fala: "${anchor.quote}"`;
}

function anchorForChapter(
  anchors: CreatorVideoNarrativeEvidenceAnchors | undefined,
  chapterId: CreatorNarrativeMapReadingChapterId,
): string | null {
  const speech = anchors?.speechQuotes.find((anchor) => anchor.chapterHint === chapterId);
  if (speech) return speechAnchorLabel(speech);

  const scene = anchors?.sceneAnchors.find((anchor) => anchor.chapterHint === chapterId);
  if (scene) return `Cena: ${scene.description}`;

  if (chapterId === "profile_impact" && anchors?.profilePatternAnchors?.[0]) {
    return `Perfil: ${anchors.profilePatternAnchors[0].whyThisVideoRelates}`;
  }

  if (chapterId === "opportunities" && anchors?.instagramAnchors?.[0]) {
    return `Instagram: ${anchors.instagramAnchors[0].evidenceSummary}`;
  }

  if (chapterId === "video_reveal" && anchors?.creatorIntentAnchor) {
    return `Intenção: ${anchors.creatorIntentAnchor.statedGoal}`;
  }

  return null;
}

function anchorSentence(anchor: string | null): string {
  if (!anchor) {
    return "Ainda falta uma fala ou cena curta suficiente para sustentar esta parte com precisão.";
  }
  return `Isso aparece em: ${anchor}.`;
}

function evidenceSummaryItemsFrom(anchors: CreatorVideoNarrativeEvidenceAnchors | undefined): string[] {
  if (!anchors) return [];
  return [
    ...anchors.speechQuotes.slice(0, 2).map(speechAnchorLabel),
    ...anchors.sceneAnchors.slice(0, 2).map((anchor) => `Cena: ${anchor.description}`),
    ...(anchors.creatorIntentAnchor ? [`Intenção: ${anchors.creatorIntentAnchor.statedGoal}`] : []),
    ...(anchors.instagramAnchors?.slice(0, 1).map((anchor) => `Instagram: ${anchor.evidenceSummary}`) ?? []),
  ].map((item) => limitText(item, PREVIEW_LIMIT)).slice(0, MAX_EVIDENCE_ITEMS);
}

function isoDate(value: Date | string | undefined): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  return null;
}

function isFirstReading(input: BuildCreatorNarrativeMapReadingPresentationInput): boolean {
  const count = input.analyzedVideosCount ?? 1;
  const contribution = input.diagnosis.profileContribution;
  return (
    count <= 1 ||
    contribution.type === "opens_new_hypothesis" ||
    contribution.type === "needs_more_samples" ||
    contribution.confidence === "low"
  );
}

function hasPatternSignal(input: BuildCreatorNarrativeMapReadingPresentationInput): boolean {
  const contribution = input.diagnosis.profileContribution;
  return (
    contribution.type === "confirms_existing_pattern" ||
    contribution.weight === "high" ||
    (contribution.confidence === "high" && (input.analyzedVideosCount ?? 1) > 1)
  );
}

function contributionLabel(contribution: CreatorVideoNarrativeDiagnosisProfileContribution): string {
  const labels: Record<CreatorVideoNarrativeDiagnosisProfileContribution["type"], string> = {
    confirms_existing_pattern: "Padrão reforçado",
    opens_new_hypothesis: "Hipótese inicial",
    isolated_strong_video: "Vídeo forte isolado",
    creative_deviation: "Desvio criativo",
    commercial_signal: "Sinal comercial",
    weak_positioning_signal: "Sinal fraco",
    needs_more_samples: "Precisa repetir",
  };

  return labels[contribution.type];
}

function buildChapter(params: {
  id: CreatorNarrativeMapReadingChapterId;
  title: string;
  preview: string;
  fullReading: string;
  evidence: Array<string | null | undefined>;
  action?: string | null;
  badgeLabel?: string | null;
  tone: CreatorNarrativeMapReadingChapterTone;
  locked?: boolean;
}): CreatorNarrativeMapReadingChapter {
  return {
    id: params.id,
    title: limitText(params.title, TITLE_LIMIT),
    preview: limitText(params.preview, PREVIEW_LIMIT),
    fullReading: limitText(params.fullReading, FULL_READING_LIMIT),
    evidence: evidenceFrom(params.evidence),
    action: params.action ? limitText(params.action, ACTION_LIMIT) : null,
    badgeLabel: params.badgeLabel ? limitText(params.badgeLabel, 40) : null,
    tone: params.tone,
    locked: params.locked ?? false,
  };
}

function buildStatus(input: BuildCreatorNarrativeMapReadingPresentationInput): Pick<
  CreatorNarrativeMapReadingPresentation,
  "headline" | "subheadline" | "statusLabel"
> {
  if (input.instagramConnected) {
    return {
      statusLabel: "Cruzado com Instagram",
      headline: "Seu mapa ganhou contexto",
      subheadline:
        "Esta leitura pode ser comparada com sinais do perfil e da audiencia, sem prometer desempenho.",
    };
  }

  if (hasPatternSignal(input)) {
    return {
      statusLabel: "Padrão em formação",
      headline: "Um padrão começa a aparecer",
      subheadline:
        "Este vídeo reforça uma leitura que ja aparece em outros sinais, mas a síntese do Perfil continua separada.",
    };
  }

  return {
    statusLabel: "Primeira leitura",
    headline: "Seu mapa começou",
    subheadline: "Este vídeo já mostra um primeiro sinal, mas ainda é cedo para chamar de padrão.",
  };
}

function buildPrimaryAction(
  input: BuildCreatorNarrativeMapReadingPresentationInput,
): CreatorNarrativeMapReadingPresentation["primaryAction"] {
  if (!input.instagramConnected && input.accessLevel === "instagram_optimized") {
    return {
      label: "Conectar Instagram",
      intent: "connect_instagram",
      helper: "A leitura fica mais precisa quando pode comparar sinais do perfil e da audiencia.",
    };
  }

  if (input.accessLevel === "free" && (input.analyzedVideosCount ?? 1) > 1) {
    return {
      label: "Abrir mapa mais completo",
      intent: "upgrade",
      helper: "Um mapa mais completo ajuda a organizar sinais que ja comecam a se repetir.",
    };
  }

  return {
    label: "Analisar outro vídeo",
    intent: "analyze_another_video",
    helper: "Mais vídeos ajudam a separar hipótese inicial de padrão recorrente.",
  };
}

export function buildCreatorNarrativeMapReadingPresentation(
  input: BuildCreatorNarrativeMapReadingPresentationInput,
): CreatorNarrativeMapReadingPresentation {
  const diagnosis = input.diagnosis;
  const video = diagnosis.videoReading;
  const speech = diagnosis.speechReading;
  const production = diagnosis.productionReading;
  const commercial = diagnosis.commercialReading;
  const recommendation = diagnosis.strategicRecommendation;
  const contribution = diagnosis.profileContribution;
  const anchors = diagnosis.evidenceAnchors;
  const firstReading = isFirstReading(input);
  const patternAnchor = anchorForChapter(anchors, "pattern");
  const tensionAnchor = anchorForChapter(anchors, "tension");
  const movementAnchor = anchorForChapter(anchors, "movement");
  const territoryAnchor = anchorForChapter(anchors, "territory");
  const videoRevealAnchor = anchorForChapter(anchors, "video_reveal");
  const profileImpactAnchor = anchorForChapter(anchors, "profile_impact");
  const opportunitiesAnchor = anchorForChapter(anchors, "opportunities");
  const patternPreview = firstReading
    ? "Ainda é cedo para cravar um padrão. Este vídeo abre uma hipótese inicial para acompanhar nas próximas leituras."
    : firstText([video.mainNarrative, contribution.profileImpactPreview]);
  const territories = commercial.brandTerritories.map((territory) => cleanText(territory, "")).filter(Boolean);
  const territoryText = territories.length > 0
    ? `Sua narrativa conversa com ${territories.slice(0, 3).join(", ")} como território de oportunidade futura.`
    : "Ainda nao ha território comercial forte. O caminho é observar se este tipo de leitura se repete.";
  const status = buildStatus(input);

  const chapters: CreatorNarrativeMapReadingChapter[] = [
    buildChapter({
      id: "pattern",
      title: "Seu padrão",
      preview: patternPreview,
      fullReading: firstReading
        ? `Você parece estar abrindo uma primeira pista, não uma conclusão sobre o Perfil. ${anchorSentence(patternAnchor)} O que isso revela é um sinal útil, mas ainda precisa aparecer em novas amostras para virar padrão. Por isso, teste a mesma intenção narrativa em formatos próximos e observe o que volta com força.`
        : `Você parece ter mais força quando ${cleanText(video.mainNarrative).toLowerCase()}. ${anchorSentence(patternAnchor)} O que isso revela é ${cleanText(video.dominantInsight).toLowerCase()}. Por isso, repita esse eixo em novas cenas para entender se ele sustenta o Perfil.`,
      evidence: [patternAnchor, video.mainNarrative, video.dominantInsight, contribution.reason],
      action: recommendation.whatToRepeat,
      badgeLabel: firstReading ? "Hipótese" : "Padrão",
      tone: "mirror",
    }),
    buildChapter({
      id: "tension",
      title: "Sua tensão",
      preview: firstText([
        recommendation.whatToAvoid,
        speech.openingRead,
        production.firstFrame,
      ], "A ideia existe, mas a tensão ainda precisa aparecer mais cedo."),
      fullReading: `Você parece ganhar clareza quando o conflito aparece cedo. ${anchorSentence(tensionAnchor)} O que isso revela é que a tensão principal passa por ${cleanText(recommendation.whatToAvoid).toLowerCase()}. Por isso, torne o incômodo mais visível antes de explicar demais a cena.`,
      evidence: [tensionAnchor, speech.openingRead, production.firstFrame, recommendation.whatToAvoid],
      action: recommendation.mainAdjustment,
      badgeLabel: "Ajuste",
      tone: "attention",
    }),
    buildChapter({
      id: "movement",
      title: "Seu movimento",
      preview: firstText([
        recommendation.nextExperiment,
        recommendation.mainAdjustment,
      ], "Testar uma abertura mais direta e comparar se a leitura fica mais clara."),
      fullReading: `Você parece pronto para transformar a leitura em teste. ${anchorSentence(movementAnchor)} O que isso revela é um caminho prático: ${cleanText(recommendation.nextExperiment).toLowerCase()}. Por isso, observe ${cleanText(recommendation.successSignal).toLowerCase()}, sem tratar um vídeo isolado como verdade final.`,
      evidence: [movementAnchor, recommendation.nextExperiment, recommendation.successSignal, recommendation.mainAdjustment],
      action: recommendation.nextExperiment,
      badgeLabel: "Próximo teste",
      tone: "action",
    }),
    buildChapter({
      id: "territory",
      title: "Seu território",
      preview: territoryText,
      fullReading: `Você parece se aproximar de um território, não de uma promessa comercial. ${anchorSentence(territoryAnchor)} O que isso revela é fit narrativo possível: ${cleanText(commercial.whyItCouldFitBrands).toLowerCase()}. Por isso, teste linguagem, formato e repetição antes de falar em marca fechada.`,
      evidence: [territoryAnchor, commercial.summary, ...territories, commercial.whyItCouldFitBrands],
      action: commercial.adAdaptationIdea,
      badgeLabel: "Território",
      tone: "opportunity",
    }),
    buildChapter({
      id: "video_reveal",
      title: "O que este vídeo revela",
      preview: firstText([
        video.whatVideoReveals,
        video.summary,
      ], "Este vídeo adiciona uma leitura inicial ao mapa narrativo."),
      fullReading: `Você parece estar mostrando mais do que o tema do vídeo. ${anchorSentence(videoRevealAnchor)} O que isso revela é ${cleanText(video.whatVideoReveals).toLowerCase()}. Por isso, compare a intenção percebida, ${cleanText(video.creatorIntent).toLowerCase()}, com novas leituras antes de transformar isso em Perfil.`,
      evidence: [videoRevealAnchor, video.summary, video.whatVideoReveals, video.creatorIntent],
      action: recommendation.whatToRepeat,
      badgeLabel: "Leitura",
      tone: "neutral",
    }),
    buildChapter({
      id: "profile_impact",
      title: "Como pesa no Perfil",
      preview: contribution.profileImpactPreview,
      fullReading: `Você parece adicionar um sinal ao Perfil, não uma conclusão final. ${anchorSentence(profileImpactAnchor)} O que isso revela é: ${cleanText(contribution.reason).toLowerCase()} Por isso, trate esta leitura como insumo para o agregador futuro, sem atualizar a narrativa principal sozinha.`,
      evidence: [profileImpactAnchor, contribution.reason, contribution.profileImpactPreview],
      action: firstReading
        ? "Analise mais vídeos para entender se este sinal se repete."
        : "Compare este sinal com novas leituras antes de transformar em narrativa principal.",
      badgeLabel: contributionLabel(contribution),
      tone: contribution.type === "commercial_signal" ? "opportunity" : "mirror",
    }),
    buildChapter({
      id: "opportunities",
      title: "Oportunidades em formação",
      preview: firstText([
        commercial.adAdaptationIdea,
        territoryText,
      ], "A oportunidade ainda esta em formação e depende de repetição narrativa."),
      fullReading: `Você parece ter um território em formação, ainda dependente de repetição. ${anchorSentence(opportunitiesAnchor)} O que isso revela é uma adaptação possível: ${cleanText(commercial.adAdaptationIdea).toLowerCase()} Por isso, teste o fit narrativo antes de falar em parceria real; o limite é ${cleanText(commercial.limitations).toLowerCase()}.`,
      evidence: [opportunitiesAnchor, commercial.summary, commercial.adAdaptationIdea, commercial.limitations, ...territories],
      action: recommendation.nextExperiment,
      badgeLabel: "Em formação",
      tone: "opportunity",
    }),
  ];

  return {
    id: `narrative-map-reading-${diagnosis.diagnosisId}`,
    diagnosisId: diagnosis.diagnosisId,
    headline: status.headline,
    subheadline: status.subheadline,
    statusLabel: status.statusLabel,
    chapters,
    primaryAction: buildPrimaryAction(input),
    evidenceSummaryItems: evidenceSummaryItemsFrom(anchors),
    safetyNote: "A D2C guarda a leitura estratégica, não o vídeo.",
    createdAt: isoDate(diagnosis.createdAt),
  };
}
