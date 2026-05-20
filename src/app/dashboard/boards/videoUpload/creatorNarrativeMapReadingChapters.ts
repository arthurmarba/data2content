import type {
  CreatorVideoNarrativeDiagnosisDocument,
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
  evidence: string[];
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
  const firstReading = isFirstReading(input);
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
        ? "Você parece estar abrindo uma primeira pista, não uma conclusão sobre o Perfil. Neste vídeo, a leitura mostra um sinal útil, mas ainda precisa aparecer em novas amostras para virar padrão. O próximo movimento é repetir a intenção narrativa em formatos próximos e observar o que volta com força."
        : `Você parece ter mais força quando ${cleanText(video.mainNarrative).toLowerCase()}. Isso aparece neste vídeo como ${cleanText(video.dominantInsight).toLowerCase()}. O próximo movimento é repetir esse eixo em novas cenas para entender se ele sustenta o Perfil.`,
      evidence: [video.mainNarrative, video.dominantInsight, contribution.reason],
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
      fullReading: `A narrativa ganha clareza quando o conflito aparece cedo. Neste vídeo, a tensão principal passa por ${cleanText(recommendation.whatToAvoid).toLowerCase()}. O ajuste é tornar o incômodo mais visível antes de explicar demais a cena.`,
      evidence: [speech.openingRead, production.firstFrame, recommendation.whatToAvoid],
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
      fullReading: `O próximo teste deve ser simples: ${cleanText(recommendation.nextExperiment).toLowerCase()}. A evidência a observar é ${cleanText(recommendation.successSignal).toLowerCase()}. Isso transforma a leitura em movimento prático, sem tratar um vídeo isolado como verdade final.`,
      evidence: [recommendation.nextExperiment, recommendation.successSignal, recommendation.mainAdjustment],
      action: recommendation.nextExperiment,
      badgeLabel: "Próximo teste",
      tone: "action",
    }),
    buildChapter({
      id: "territory",
      title: "Seu território",
      preview: territoryText,
      fullReading: `${territoryText} A leitura comercial aqui é de fit narrativo: ${cleanText(commercial.whyItCouldFitBrands).toLowerCase()}. Isso nao indica marca fechada; indica um campo para testar linguagem, formato e repetição.`,
      evidence: [commercial.summary, ...territories, commercial.whyItCouldFitBrands],
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
      fullReading: `Este vídeo revela ${cleanText(video.whatVideoReveals).toLowerCase()}. A intenção percebida é ${cleanText(video.creatorIntent).toLowerCase()}. Como leitura isolada, ele documenta um sinal; como Perfil, ele ainda precisa ser comparado com novas leituras.`,
      evidence: [video.summary, video.whatVideoReveals, video.creatorIntent],
      action: recommendation.whatToRepeat,
      badgeLabel: "Leitura",
      tone: "neutral",
    }),
    buildChapter({
      id: "profile_impact",
      title: "Como pesa no Perfil",
      preview: contribution.profileImpactPreview,
      fullReading: `${cleanText(contribution.reason)} Esta contribuição tem confiança ${contribution.confidence} e peso ${contribution.weight}. Ela não atualiza a narrativa principal sozinha; apenas organiza o que o agregador futuro deve considerar.`,
      evidence: [contribution.reason, contribution.profileImpactPreview],
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
      fullReading: `A oportunidade aqui ainda é um território em formação. ${cleanText(commercial.adAdaptationIdea)} O limite importante é: ${cleanText(commercial.limitations).toLowerCase()}. O caminho é testar o fit narrativo antes de falar em parceria real.`,
      evidence: [commercial.summary, commercial.adAdaptationIdea, commercial.limitations, ...territories],
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
    safetyNote: "A D2C guarda a leitura estratégica, não o vídeo.",
    createdAt: isoDate(diagnosis.createdAt),
  };
}
