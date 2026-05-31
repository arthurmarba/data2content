import type {
  CreatorNarrativeMapReadingChapter,
  CreatorNarrativeMapReadingPresentation,
} from "./creatorNarrativeMapReadingChapters";
import type {
  CreatorStrategicProfileSynthesis,
  CreatorStrategicProfileSynthesisSignal,
} from "./creatorStrategicProfileSynthesis";
import type { BrandNarrativeMatchResult } from "@/app/lib/brands/brandNarrativeMatchTypes";

export type NarrativeMapMobileTabId = "profile" | "readings" | "opportunities";

export interface NarrativeMapMobileMetric {
  id: string;
  label: string;
  value: string;
}

export interface NarrativeMapMobileAction {
  id: string;
  label: string;
  intent:
    | "analyze_new_video"
    | "open_full_diagnosis"
    | "open_reading"
    | "connect_instagram"
    | "upgrade"
    | "open_media_kit";
  priority: "primary" | "secondary" | "tertiary";
  disabled?: boolean;
  helper?: string | null;
}

export interface NarrativeMapMobileReadingItem {
  id: string;
  diagnosisId: string;
  rememberedAs: string;
  dateLabel: string;
  /** ISO timestamp — used by Diagnóstico shell for relative date rendering */
  createdAt?: string | null;
  contributionLabel: string;
  /** Raw contribution type — used by Diagnóstico cards to derive tone strip and specific labels */
  contributionType?: string | null;
  profileImpactPreview: string;
  statusLabel: string;
  action: NarrativeMapMobileAction;
  /** Thumbnail URL for the reading. Set client-side from localStorage (persisted after analysis). May also be populated from DB in future. */
  thumbnailUrl?: string | null;
}

export interface NarrativeMapMobileOpportunityItem {
  id: string;
  title: string;
  preview: string;
  type: "brand_territory" | "collab_type" | "media_kit_bridge" | "instagram_precision";
  badgeLabel?: string | null;
  action?: NarrativeMapMobileAction | null;
  locked?: boolean;
  // Rich brand match fields — present only when brand matching is connected (Fase C/D)
  brandCategory?: string[];
  matchedSignals?: string[];
  rationale?: string | null;
  insertionAngle?: string | null;
  suggestedDeliverables?: string[];
}

export interface NarrativeMapMobileViewModel {
  id: string;
  profileHeader: {
    displayName: string;
    displayHandle: string | null;
    statusLabel: string;
    metrics: NarrativeMapMobileMetric[];
  };
  hero: {
    title: string;
    headline: string;
    subheadline: string;
    badgeLabel?: string | null;
  };
  tabs: Array<{
    id: NarrativeMapMobileTabId;
    label: string;
    active: boolean;
  }>;
  profile: {
    chapters: CreatorNarrativeMapReadingChapter[];
    primaryAction: NarrativeMapMobileAction;
    secondaryAction: NarrativeMapMobileAction | null;
  };
  readings: {
    title: string;
    description: string;
    items: NarrativeMapMobileReadingItem[];
    emptyState?: {
      title: string;
      description: string;
      action: NarrativeMapMobileAction;
    } | null;
  };
  opportunities: {
    title: string;
    description: string;
    items: NarrativeMapMobileOpportunityItem[];
    emptyState?: {
      title: string;
      description: string;
      action?: NarrativeMapMobileAction | null;
    } | null;
  };
  safetyNote?: string | null;
}

export interface NarrativeMapMobileRecentReadingInput {
  diagnosisId: string;
  rememberedAs: string;
  createdAt?: string | Date | null;
  profileContribution: {
    type: string;
    confidence: string;
    weight: string;
    profileImpactPreview: string;
  };
}

export interface BuildNarrativeMapMobileViewModelInput {
  displayName: string;
  displayHandle?: string | null;
  currentPresentation: CreatorNarrativeMapReadingPresentation;
  recentReadings?: NarrativeMapMobileRecentReadingInput[];
  profileSynthesis?: CreatorStrategicProfileSynthesis | null;
  accessLevel?: "free" | "premium" | "instagram_optimized";
  instagramConnected?: boolean;
  mediaKitAvailable?: boolean;
  activeTab?: NarrativeMapMobileTabId;
  /** Real brand matches from brandNarrativeMatcher — replaces raw commercialTerritories in opportunities tab */
  brandMatches?: BrandNarrativeMatchResult[] | null;
}

const SAFE_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/https?:\/\/[^\s"'<>]+/gi, "referencia removida"],
  [/\b(?:objectKey|signedUrl|uploadUrl|thumbnailUrl|localPath|storageProviderPath)\b/gi, "referencia removida"],
  [/\b(?:storage|raw response|Gemini)\b/gi, "leitura"],
  [/\b(?:score|nota)\b/gi, "leitura"],
  [/\bviralizar\b/gi, "crescer com consistencia"],
  [/\bgarantid[oa]\b/gi, "possivel"],
  [/\bcerteza\b/gi, "hipotese"],
  [/\bcomprovad[oa]\b/gi, "em observacao"],
  [/\bmatch\s+real\b/gi, "fit narrativo possivel"],
  [/\bpubli\s+garantida\b/gi, "oportunidade em formacao"],
];

function cleanText(value: string | null | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  return SAFE_TEXT_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), raw)
    .replace(/\s+/g, " ")
    .trim();
}

function dateLabel(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return "Sem data";
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function contributionLabel(type: string): string {
  const labels: Record<string, string> = {
    confirms_existing_pattern: "Narrativa reforçada",
    opens_new_hypothesis: "Hipótese em teste",
    isolated_strong_video: "Vídeo forte isolado",
    creative_deviation: "Desvio criativo",
    commercial_signal: "Fit narrativo possível",
    weak_positioning_signal: "Sinal fraco",
    needs_more_samples: "Precisa repetir",
  };

  return labels[type] ?? "Leitura documentada";
}

function action(params: NarrativeMapMobileAction): NarrativeMapMobileAction {
  return {
    ...params,
    helper: params.helper ? cleanText(params.helper, "") : null,
  };
}

function countPatternReadings(readings: NarrativeMapMobileRecentReadingInput[]): number {
  return readings.filter((reading) =>
    ["confirms_existing_pattern", "opens_new_hypothesis"].includes(reading.profileContribution.type),
  ).length;
}

function opportunityChapters(presentation: CreatorNarrativeMapReadingPresentation): CreatorNarrativeMapReadingChapter[] {
  return presentation.chapters.filter((chapter) => chapter.id === "territory" || chapter.id === "opportunities");
}

function synthesisStatusLabel(synthesis: CreatorStrategicProfileSynthesis | null | undefined): string | null {
  if (!synthesis) return null;
  const labels: Record<CreatorStrategicProfileSynthesis["status"], string> = {
    empty: "Sem leituras",
    first_reading: "Primeira leitura",
    signals_emerging: "Sinais em formação",
    pattern_in_formation: "Padrão em formação",
    profile_consistent: "Perfil consistente",
  };
  return labels[synthesis.status];
}

function synthesisHeadline(synthesis: CreatorStrategicProfileSynthesis | null | undefined, fallback: string): string {
  if (!synthesis) return fallback;
  if (synthesis.status === "empty" || synthesis.status === "first_reading") return "Seu mapa começou";
  if (synthesis.status === "signals_emerging") return "Um sinal começa a aparecer";
  return "Um padrão começa a se repetir";
}

function synthesisSubheadline(synthesis: CreatorStrategicProfileSynthesis | null | undefined, fallback: string): string {
  if (!synthesis) return fallback;
  if (synthesis.status === "empty") {
    return "Analise um vídeo para criar a primeira leitura documentada do Perfil.";
  }
  if (synthesis.status === "first_reading") {
    return "Primeiro sinal: ainda é cedo para chamar de padrão, mas a leitura já orienta o próximo teste.";
  }
  if (synthesis.status === "signals_emerging") {
    return "Duas leituras começam a apontar uma direção, ainda em formação.";
  }
  return synthesis.mainNarrative?.summary ?? "As leituras começam a mostrar uma narrativa recorrente, sem virar promessa definitiva.";
}

function synthesisChapter(params: {
  id: CreatorNarrativeMapReadingChapter["id"];
  title: string;
  signal?: CreatorStrategicProfileSynthesisSignal | null;
  fallback: string;
  action?: string | null;
  tone: CreatorNarrativeMapReadingChapter["tone"];
}): CreatorNarrativeMapReadingChapter {
  const signal = params.signal;
  return {
    id: params.id,
    title: params.title,
    preview: cleanText(signal?.summary, params.fallback),
    fullReading: cleanText(
      signal
        ? `${signal.summary} Essa leitura aparece em ${signal.evidenceCount} vídeo(s) documentado(s), ainda como síntese dry-run.`
        : params.fallback,
      params.fallback,
    ),
    evidence: signal ? [`${signal.evidenceCount} leitura(s) documentada(s)`] : [],
    action: params.action,
    badgeLabel: signal ? `${signal.evidenceCount} sinais` : "Em formação",
    tone: params.tone,
    locked: false,
  };
}

function profileChaptersFromSynthesis(
  synthesis: CreatorStrategicProfileSynthesis | null | undefined,
  fallbackChapters: CreatorNarrativeMapReadingChapter[],
): CreatorNarrativeMapReadingChapter[] {
  if (!synthesis) return fallbackChapters;

  return [
    synthesisChapter({
      id: "pattern",
      title: "Seu padrão",
      signal: synthesis.mainNarrative ?? synthesis.recurringPatterns[0] ?? synthesis.testedNarratives[0],
      fallback: synthesis.status === "empty"
        ? "O Perfil ainda precisa da primeira leitura documentada."
        : "Primeiro sinal em observação; ainda é cedo para chamar de padrão.",
      action: synthesis.nextStrategicMove?.description ?? null,
      tone: "mirror",
    }),
    synthesisChapter({
      id: "tension",
      title: "Sua tensão",
      signal: synthesis.recurringTensions[0],
      fallback: "Ainda não há tensão recorrente suficiente entre as leituras.",
      action: synthesis.nextStrategicMove?.reason ?? null,
      tone: "attention",
    }),
    synthesisChapter({
      id: "movement",
      title: "Seu movimento",
      signal: synthesis.strengths[0],
      fallback: synthesis.nextStrategicMove?.description ?? "A próxima leitura ajuda a separar hipótese de padrão.",
      action: synthesis.nextStrategicMove?.description ?? null,
      tone: "action",
    }),
    synthesisChapter({
      id: "territory",
      title: "Seu território",
      signal: synthesis.commercialTerritories[0] ?? synthesis.collabTerritories[0],
      fallback: "Territórios em formação aparecem quando sinais comerciais se repetem.",
      action: "Use apenas como direção para Mídia Kit, sem tratar como oportunidade fechada.",
      tone: "opportunity",
    }),
  ];
}

function buildOpportunities(input: BuildNarrativeMapMobileViewModelInput): NarrativeMapMobileOpportunityItem[] {
  if (input.profileSynthesis) {
    // When real brand matches are available, use them instead of raw synthesis commercialTerritories
    if (input.brandMatches && input.brandMatches.length > 0) {
      const brandItems = input.brandMatches.map((match, index): NarrativeMapMobileOpportunityItem => ({
        id: `brand-match-${index}-${match.brandId}`,
        title: match.brandName,
        preview: cleanText(match.rationale, "Fit narrativo possível com base no perfil."),
        type: "brand_territory",
        badgeLabel: match.category[0] ?? null,
        action: null,
        brandCategory: match.category,
        matchedSignals: match.matchedSignals,
        rationale: match.rationale,
        insertionAngle: match.insertionAngle,
        suggestedDeliverables: match.suggestedDeliverables,
      }));
      const collabItems = input.profileSynthesis.collabTerritories.map((territory, index): NarrativeMapMobileOpportunityItem => ({
        id: `synthesis-collab-${index}`,
        title: cleanText(territory.label, "Tipo de collab possível"),
        preview: cleanText(territory.summary, "Tipo de collab possível, ainda sem parceria real."),
        type: "collab_type",
        badgeLabel: `${territory.evidenceCount} sinais`,
        action: null,
      }));
      return [...brandItems, ...collabItems];
    }

    // Fallback: synthesis-only (no brand matching or < signals_emerging)
    const commercialItems = input.profileSynthesis.commercialTerritories.map((territory, index): NarrativeMapMobileOpportunityItem => ({
      id: `synthesis-commercial-${index}`,
      title: cleanText(territory.label, "Território em formação"),
      preview: cleanText(territory.summary, "Fit narrativo possível para observar em novas leituras."),
      type: "brand_territory",
      badgeLabel: `${territory.evidenceCount} sinais`,
      action: null,
    }));
    const collabItems = input.profileSynthesis.collabTerritories.map((territory, index): NarrativeMapMobileOpportunityItem => ({
      id: `synthesis-collab-${index}`,
      title: cleanText(territory.label, "Tipo de collab possível"),
      preview: cleanText(territory.summary, "Tipo de collab possível, ainda sem parceria real."),
      type: "collab_type",
      badgeLabel: `${territory.evidenceCount} sinais`,
      action: null,
    }));
    const synthesisItems = [...commercialItems, ...collabItems];
    if (synthesisItems.length > 0) return synthesisItems;
  }

  const items = opportunityChapters(input.currentPresentation).map((chapter): NarrativeMapMobileOpportunityItem => ({
    id: `opportunity-${chapter.id}`,
    title: cleanText(chapter.title, "Oportunidade em formação"),
    preview: cleanText(chapter.preview, "Território possível para observar em novas leituras."),
    type: chapter.id === "territory" ? "brand_territory" : "collab_type",
    badgeLabel: chapter.badgeLabel ?? "Em formação",
    action: chapter.action
      ? action({
          id: `action-${chapter.id}`,
          label: "Ver caminho",
          intent: "open_full_diagnosis",
          priority: "tertiary",
          helper: chapter.action,
        })
      : null,
    locked: chapter.locked,
  }));

  if (input.instagramConnected) {
    items.push({
      id: "instagram-precision",
      title: "Leitura com mais contexto",
      preview: "O Instagram ajuda a comparar esta leitura com sinais do Perfil e da audiencia.",
      type: "instagram_precision",
      badgeLabel: "Precisão",
      action: null,
    });
  }

  if (input.mediaKitAvailable) {
    items.push({
      id: "media-kit-bridge",
      title: "Mídia Kit",
      preview: "Seu perfil pronto para enviar às marcas.",
      type: "media_kit_bridge",
      badgeLabel: "Apresentação",
      action: action({
        id: "open-media-kit",
        label: "Abrir Mídia Kit",
        intent: "open_media_kit",
        priority: "secondary",
        helper: "Mostra o perfil para conversas comerciais futuras.",
      }),
    });
  }

  return items;
}

export function buildNarrativeMapMobileViewModel(
  input: BuildNarrativeMapMobileViewModelInput,
): NarrativeMapMobileViewModel {
  const recentReadings = input.recentReadings ?? [];
  const activeTab = input.activeTab ?? "profile";
  const opportunities = buildOpportunities(input);
  const synthesisLabel = synthesisStatusLabel(input.profileSynthesis);
  const primaryAction = action({
    id: "analyze-new-video",
    label: "Nova leitura",
    intent: "analyze_new_video",
    priority: "primary",
    helper: "Analise outro vídeo para separar hipótese inicial de padrão.",
  });
  const secondaryAction = action({
    id: "open-full-diagnosis",
    label: "Ler diagnóstico completo",
    intent: "open_full_diagnosis",
    priority: "secondary",
    helper: "Abre todos os capítulos em sequência.",
  });

  return {
    id: `narrative-map-mobile-${input.currentPresentation.diagnosisId}`,
    profileHeader: {
      displayName: cleanText(input.displayName, "Creator"),
      displayHandle: input.displayHandle ? cleanText(input.displayHandle, "") : null,
      statusLabel: synthesisLabel ?? input.currentPresentation.statusLabel,
      metrics: [
        { id: "readings", label: "Leituras", value: String(recentReadings.length) },
        {
          id: "patterns",
          label: "Padrões",
          value: String(input.profileSynthesis?.recurringPatterns.length ?? countPatternReadings(recentReadings)),
        },
        { id: "opportunities", label: "Oportunidades", value: String(opportunities.length) },
      ],
    },
    hero: {
      title: "Seu mapa narrativo",
      headline: synthesisHeadline(input.profileSynthesis, input.currentPresentation.headline),
      subheadline: synthesisSubheadline(input.profileSynthesis, input.currentPresentation.subheadline),
      badgeLabel: input.instagramConnected ? "Cruzado com Instagram" : synthesisLabel ?? input.currentPresentation.statusLabel,
    },
    tabs: [
      { id: "profile", label: "Mapa", active: activeTab === "profile" },
      { id: "readings", label: "Leituras", active: activeTab === "readings" },
      { id: "opportunities", label: "Oportunidades", active: activeTab === "opportunities" },
    ],
    profile: {
      chapters: profileChaptersFromSynthesis(
        input.profileSynthesis,
        input.currentPresentation.chapters.filter((chapter) =>
          ["pattern", "tension", "movement", "territory"].includes(chapter.id),
        ),
      ),
      primaryAction,
      secondaryAction,
    },
    readings: {
      title: "Leituras documentadas",
      description:
        "Cada vídeo enviado vira uma leitura. O Perfil junta essas leituras para separar padrão, hipótese, desvio criativo e oportunidade.",
      items: recentReadings.map((reading): NarrativeMapMobileReadingItem => ({
        id: `reading-${reading.diagnosisId}`,
        diagnosisId: reading.diagnosisId,
        rememberedAs: cleanText(reading.rememberedAs, "Vídeo analisado"),
        dateLabel: dateLabel(reading.createdAt),
        contributionLabel: contributionLabel(reading.profileContribution.type),
        contributionType: reading.profileContribution.type,
        createdAt: reading.createdAt instanceof Date
          ? reading.createdAt.toISOString()
          : reading.createdAt ?? null,
        profileImpactPreview: cleanText(
          reading.profileContribution.profileImpactPreview,
          "Sinal em observação para leituras futuras.",
        ),
        statusLabel: reading.profileContribution.confidence === "low" ? "Em observação" : "Leitura salva",
        action: action({
          id: `open-reading-${reading.diagnosisId}`,
          label: "Ver leitura",
          intent: "open_reading",
          priority: "tertiary",
          helper: null,
        }),
      })),
      emptyState:
        recentReadings.length === 0
          ? {
              title: "Nenhuma leitura documentada ainda",
              description: "Envie um vídeo para começar o mapa com um primeiro sinal.",
              action: primaryAction,
            }
          : null,
    },
    opportunities: {
      title: "Territórios em formação",
      description: "Fit narrativo possível, tipo de collab possível e ponte para Mídia Kit.",
      items: opportunities,
      emptyState:
        opportunities.length === 0
          ? {
              title: "Ainda não há território claro",
              description: "Mais leituras ajudam a diferenciar hipótese de caminho comercial.",
              action: input.instagramConnected ? null : action({
                id: "connect-instagram",
                label: "Conectar Instagram",
                intent: "connect_instagram",
                priority: "tertiary",
                helper: "Adiciona contexto para comparar sinais do Perfil.",
              }),
            }
          : null,
    },
    safetyNote: "A D2C guarda a leitura estratégica, não o vídeo.",
  };
}
