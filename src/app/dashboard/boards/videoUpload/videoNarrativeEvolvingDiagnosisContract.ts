import {
  sanitizeVideoNarrativeDiagnosisText,
  type VideoNarrativeDiagnosisAccessLevel,
  type VideoNarrativeDiagnosisCreatorSignal,
  type VideoNarrativeStrategicDiagnosis,
} from "./videoNarrativeDiagnosisLearningModel";
import type {
  VideoNarrativeCreatorProfile,
  VideoNarrativeCreatorProfileSignal,
  VideoNarrativeCreatorProfileSignalCategory,
} from "./videoNarrativeCreatorProfileContract";

export type VideoNarrativeCreatorStrategicLevelId =
  | "first_reading"
  | "initial_patterns"
  | "narrative_in_formation"
  | "commercial_potential_mapped"
  | "strategically_mapped_creator";

export interface VideoNarrativeCreatorStrategicLevel {
  id: VideoNarrativeCreatorStrategicLevelId;
  label: string;
  description: string;
  position: number;
}

export interface VideoNarrativeCreatorProfileImpact {
  summary: string;
  depth: "limited" | "moderate" | "deep" | "instagram_contextual";
  usefulSignalsCount: number;
  recurringSignalsCount: number;
  newSignalsCount: number;
  recurringPatternsCount: number;
  profileSignalsUsed: boolean;
}

export interface VideoNarrativeUnlockedSignal {
  id: string;
  label: string;
  category: VideoNarrativeCreatorProfileSignalCategory | VideoNarrativeDiagnosisCreatorSignal["type"];
  value: string;
  source: "current_video" | "creator_profile";
  recurrenceCount: number;
}

export interface VideoNarrativePendingSignal {
  id: string;
  label: string;
  category:
    | VideoNarrativeCreatorProfileSignalCategory
    | "performance_context"
    | "instagram_context";
  reason: string;
  unlockPath: "answer_more_quiz" | "analyze_more_videos" | "upgrade" | "connect_instagram";
}

export interface VideoNarrativeNextSignalToUnlock {
  id: string;
  label: string;
  action: string;
  expectedSignal:
    | VideoNarrativeCreatorProfileSignalCategory
    | "performance_context"
    | "instagram_context";
}

export interface VideoNarrativeEvolvingDiagnosisOpportunity {
  id: string;
  type: "brand_territory" | "collab_type" | "content_pattern" | "performance_context";
  label: string;
  description: string;
  confidence: "low" | "medium" | "high";
  realMatchAvailable: false;
  requiresPremium: boolean;
  requiresInstagram: boolean;
}

export interface VideoNarrativeEvolvingDiagnosisUnlock {
  id: string;
  label: string;
  description: string;
  reason: "requires_premium" | "requires_instagram_connection" | "requires_more_context";
}

export interface VideoNarrativeEvolvingDiagnosisAccessSummary {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  isLimited: boolean;
  instagramConnected: boolean;
  precision: "initial" | "profile_based" | "instagram_contextual";
  message: string;
}

export interface VideoNarrativeEvolvingDiagnosisInput {
  diagnosis: VideoNarrativeStrategicDiagnosis;
  creatorProfile?: VideoNarrativeCreatorProfile | null;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected?: boolean;
  analyzedVideosCount?: number;
  createdAt?: string | null;
}

export interface VideoNarrativeEvolvingDiagnosis {
  id: string;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  videoDiagnosisId: string;
  currentLevel: VideoNarrativeCreatorStrategicLevel;
  nextLevel: VideoNarrativeCreatorStrategicLevel | null;
  profileImpact: VideoNarrativeCreatorProfileImpact;
  unlockedSignals: VideoNarrativeUnlockedSignal[];
  pendingSignals: VideoNarrativePendingSignal[];
  nextSignalsToUnlock: VideoNarrativeNextSignalToUnlock[];
  recurringPatterns: string[];
  opportunities: VideoNarrativeEvolvingDiagnosisOpportunity[];
  subscriptionUnlocks: VideoNarrativeEvolvingDiagnosisUnlock[];
  instagramUnlocks: VideoNarrativeEvolvingDiagnosisUnlock[];
  accessSummary: VideoNarrativeEvolvingDiagnosisAccessSummary;
  createdAt: string | null;
}

export const VIDEO_NARRATIVE_CREATOR_STRATEGIC_LEVELS: VideoNarrativeCreatorStrategicLevel[] = [
  {
    id: "first_reading",
    label: "Primeira leitura",
    description: "Primeira leitura estratégica do vídeo e dos sinais iniciais do creator.",
    position: 1,
  },
  {
    id: "initial_patterns",
    label: "Padrões iniciais",
    description: "Primeiros padrões de objetivo, formato ou gancho começam a aparecer.",
    position: 2,
  },
  {
    id: "narrative_in_formation",
    label: "Narrativa em formação",
    description: "O mapa estratégico já conecta objetivos, formatos e preferências narrativas.",
    position: 3,
  },
  {
    id: "commercial_potential_mapped",
    label: "Potencial comercial mapeado",
    description: "Territórios narrativos e oportunidades comerciais futuras ficam mais claros.",
    position: 4,
  },
  {
    id: "strategically_mapped_creator",
    label: "Creator estrategicamente mapeado",
    description: "O mapa estratégico combina recorrência, variedade e contexto para orientar decisões futuras.",
    position: 5,
  },
];

const CATEGORY_LABELS: Partial<Record<VideoNarrativeCreatorProfileSignalCategory, string>> = {
  content_goals: "objetivo de conteúdo",
  creative_preferences: "preferência criativa",
  commercial_preferences: "preferência comercial",
  recurring_pains: "dor recorrente",
  hook_preferences: "preferência de gancho",
  format_preferences: "preferência de formato",
  brand_territories: "território de marca",
  collab_preferences: "preferência de collab",
  production_constraints: "restrição de produção",
  audience_relationship: "relação com audiência",
  positioning_signals: "sinal de posicionamento",
  instagram_patterns: "padrão de Instagram",
  unknown: "sinal em análise",
};

const BLOCKED_TERMS = [
  "viralizar garantido",
  "treinado permanentemente",
  "resposta correta",
  "patrocínio garantido",
  "marca garantida",
  "match comprovado",
  "garantido",
  "certeza",
  "comprovado",
  "score",
  "nota",
  "pontuação",
  "pontos",
  "moedas",
  "ranking",
  "acerto",
  "gabarito",
  "venceu",
  "perdeu",
];

function levelById(id: VideoNarrativeCreatorStrategicLevelId): VideoNarrativeCreatorStrategicLevel {
  const level = VIDEO_NARRATIVE_CREATOR_STRATEGIC_LEVELS.find((item) => item.id === id);
  if (level) return level;

  return {
    id: "first_reading",
    label: "Primeira leitura",
    description: "Primeira leitura estratégica do vídeo e dos sinais iniciais do creator.",
    position: 1,
  };
}

function nextLevelFor(level: VideoNarrativeCreatorStrategicLevel): VideoNarrativeCreatorStrategicLevel | null {
  return VIDEO_NARRATIVE_CREATOR_STRATEGIC_LEVELS.find((item) => item.position === level.position + 1) ?? null;
}

function normalize(value: string | null | undefined): string {
  return sanitizeVideoNarrativeEvolvingDiagnosisText(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slug(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function clean(value: string | null | undefined): string | null {
  const sanitized = sanitizeVideoNarrativeEvolvingDiagnosisText(value ?? "");
  return sanitized ? sanitized : null;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function usefulProfileSignals(profile?: VideoNarrativeCreatorProfile | null): VideoNarrativeCreatorProfileSignal[] {
  return (profile?.signals ?? []).filter((signal) =>
    signal.value.trim() &&
    signal.status !== "archived" &&
    signal.status !== "weak",
  );
}

function hasCategory(
  signals: VideoNarrativeCreatorProfileSignal[],
  category: VideoNarrativeCreatorProfileSignalCategory,
): boolean {
  return signals.some((signal) => signal.category === category);
}

function diagnosisSignalsForCategory(
  signals: VideoNarrativeDiagnosisCreatorSignal[],
  type: VideoNarrativeDiagnosisCreatorSignal["type"],
): boolean {
  return signals.some((signal) => signal.type === type && signal.value.trim());
}

function hasAnySignal(params: {
  profileSignals: VideoNarrativeCreatorProfileSignal[];
  diagnosisSignals: VideoNarrativeDiagnosisCreatorSignal[];
  profileCategory: VideoNarrativeCreatorProfileSignalCategory;
  diagnosisType: VideoNarrativeDiagnosisCreatorSignal["type"];
}): boolean {
  return hasCategory(params.profileSignals, params.profileCategory) ||
    diagnosisSignalsForCategory(params.diagnosisSignals, params.diagnosisType);
}

function computeLevel(input: {
  usefulSignalsCount: number;
  recurringSignalsCount: number;
  categoriesCount: number;
  hasContentGoal: boolean;
  hasHookPreference: boolean;
  hasFormatPreference: boolean;
  hasBrandTerritory: boolean;
  hasCollabPreference: boolean;
  hasCommercialSignal: boolean;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
  analyzedVideosCount: number;
}): VideoNarrativeCreatorStrategicLevel {
  if (input.usefulSignalsCount === 0) return levelById("first_reading");

  const hasNarrativeBase =
    input.hasContentGoal &&
    (input.hasHookPreference || input.hasFormatPreference) &&
    input.categoriesCount >= 3;
  const hasCommercialBase =
    input.hasBrandTerritory &&
    input.hasCommercialSignal &&
    input.recurringSignalsCount >= 1 &&
    input.categoriesCount >= 4;
  const hasStrategicBase =
    hasCommercialBase &&
    input.hasCollabPreference &&
    input.recurringSignalsCount >= 3 &&
    input.categoriesCount >= 6 &&
    input.usefulSignalsCount >= 7 &&
    input.accessLevel === "instagram_optimized" &&
    input.instagramConnected;

  if (hasStrategicBase) return levelById("strategically_mapped_creator");
  if (hasCommercialBase && input.accessLevel !== "free") return levelById("commercial_potential_mapped");
  if (hasNarrativeBase) return levelById("narrative_in_formation");
  if (input.usefulSignalsCount >= 2 || (input.analyzedVideosCount >= 2 && input.categoriesCount >= 2)) {
    return levelById("initial_patterns");
  }

  return levelById("first_reading");
}

function buildUnlockedSignals(params: {
  diagnosis: VideoNarrativeStrategicDiagnosis;
  profileSignals: VideoNarrativeCreatorProfileSignal[];
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
}): VideoNarrativeUnlockedSignal[] {
  const fromDiagnosis = params.diagnosis.creatorSignals.slice(0, params.accessLevel === "free" ? 1 : 4).map((signal) => ({
    id: `current-${signal.type}-${slug(safeUnlockedSignalValue(signal.type, signal.value))}`,
    label: sanitizeVideoNarrativeEvolvingDiagnosisText(`Sinal do vídeo: ${safeUnlockedSignalValue(signal.type, signal.value)}`),
    category: signal.type,
    value: safeUnlockedSignalValue(signal.type, signal.value),
    source: "current_video" as const,
    recurrenceCount: 1,
  }));

  const profileLimit = params.accessLevel === "free" ? 1 : 6;
  const fromProfile = params.profileSignals.slice(0, profileLimit).map((signal) => ({
    id: `profile-${signal.id}`,
    label: sanitizeVideoNarrativeEvolvingDiagnosisText(`${CATEGORY_LABELS[signal.category] ?? "sinal"}: ${safeUnlockedProfileValue(signal.category, signal.value)}`),
    category: signal.category,
    value: safeUnlockedProfileValue(signal.category, signal.value),
    source: "creator_profile" as const,
    recurrenceCount: signal.recurrenceCount,
  }));

  return [...fromDiagnosis, ...fromProfile].filter((signal) => signal.value);
}

function safeUnlockedSignalValue(
  type: VideoNarrativeDiagnosisCreatorSignal["type"],
  value: string,
): string {
  if (type === "collab_preference") return "tipo de collab futura";
  return sanitizeVideoNarrativeEvolvingDiagnosisText(value);
}

function safeUnlockedProfileValue(
  category: VideoNarrativeCreatorProfileSignalCategory,
  value: string,
): string {
  if (category === "collab_preferences") return "tipo de collab futura";
  return sanitizeVideoNarrativeEvolvingDiagnosisText(value);
}

function buildPendingSignals(params: {
  hasFormatPreference: boolean;
  hasBrandTerritory: boolean;
  hasCollabPreference: boolean;
  instagramConnected: boolean;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
}): VideoNarrativePendingSignal[] {
  const pending: VideoNarrativePendingSignal[] = [];

  if (!params.hasFormatPreference) {
    pending.push({
      id: "pending-format-preference",
      label: "Preferência de formato",
      category: "format_preferences",
      reason: "Ainda falta entender quais formatos o creator tende a repetir com mais intenção.",
      unlockPath: "answer_more_quiz",
    });
  }

  if (!params.hasBrandTerritory) {
    pending.push({
      id: "pending-brand-territory",
      label: "Território de marca",
      category: "brand_territories",
      reason: "O fit narrativo comercial ainda precisa de mais sinais antes de orientar oportunidades futuras.",
      unlockPath: params.accessLevel === "free" ? "upgrade" : "analyze_more_videos",
    });
  }

  if (!params.hasCollabPreference) {
    pending.push({
      id: "pending-collab-preference",
      label: "Tipo de collab",
      category: "collab_preferences",
      reason: "Ainda falta mapear que tipo de colaboração combinaria com a narrativa do creator.",
      unlockPath: params.accessLevel === "free" ? "upgrade" : "analyze_more_videos",
    });
  }

  if (!params.instagramConnected) {
    pending.push({
      id: "pending-performance-context",
      label: "Contexto de performance",
      category: "performance_context",
      reason: "A leitura de performance depende de contexto futuro do Instagram para ficar mais precisa.",
      unlockPath: "connect_instagram",
    });
  }

  return pending.map((signal) => ({
    ...signal,
    label: sanitizeVideoNarrativeEvolvingDiagnosisText(signal.label),
    reason: sanitizeVideoNarrativeEvolvingDiagnosisText(signal.reason),
  }));
}

function buildNextSignalsToUnlock(pendingSignals: VideoNarrativePendingSignal[]): VideoNarrativeNextSignalToUnlock[] {
  return pendingSignals.slice(0, 4).map((signal) => ({
    id: `next-${signal.id}`,
    label: sanitizeVideoNarrativeEvolvingDiagnosisText(`Desbloquear ${signal.label.toLowerCase()}`),
    action: sanitizeVideoNarrativeEvolvingDiagnosisText(actionForUnlockPath(signal.unlockPath)),
    expectedSignal: signal.category,
  }));
}

function actionForUnlockPath(path: VideoNarrativePendingSignal["unlockPath"]): string {
  if (path === "connect_instagram") return "Conectar Instagram para comparar com contexto futuro de performance.";
  if (path === "upgrade") return "Liberar leitura premium para aprofundar o mapa estratégico.";
  if (path === "analyze_more_videos") return "Analisar mais vídeos para confirmar recorrência e variedade.";
  return "Responder perguntas rápidas para completar o diagnóstico.";
}

function buildRecurringPatterns(profileSignals: VideoNarrativeCreatorProfileSignal[]): string[] {
  return unique(
    profileSignals
      .filter((signal) => signal.recurrenceCount >= 2)
      .map((signal) =>
        sanitizeVideoNarrativeEvolvingDiagnosisText(`${CATEGORY_LABELS[signal.category] ?? "sinal"} recorrente: ${signal.value}`),
      ),
  ).slice(0, 6);
}

function buildOpportunities(params: {
  diagnosis: VideoNarrativeStrategicDiagnosis;
  profileSignals: VideoNarrativeCreatorProfileSignal[];
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
}): VideoNarrativeEvolvingDiagnosisOpportunity[] {
  const opportunities: VideoNarrativeEvolvingDiagnosisOpportunity[] = [];
  const brandTerritories = unique([
    ...params.diagnosis.brandPotential.territories,
    ...(params.profileSignals
      .filter((signal) => signal.category === "brand_territories")
      .map((signal) => signal.value)),
  ]).slice(0, params.accessLevel === "free" ? 2 : 5);

  brandTerritories.forEach((territory) => {
    opportunities.push({
      id: `brand-${slug(territory)}`,
      type: "brand_territory",
      label: sanitizeVideoNarrativeEvolvingDiagnosisText(`Território de marca possível: ${territory}`),
      description: sanitizeVideoNarrativeEvolvingDiagnosisText(
        "Indica fit narrativo como oportunidade futura; depende de performance real e contexto comercial para maior precisão.",
      ),
      confidence: params.accessLevel === "free" ? "low" : "medium",
      realMatchAvailable: false,
      requiresPremium: params.accessLevel === "free",
      requiresInstagram: false,
    });
  });

  const hasCollabSignal = params.profileSignals.some((signal) => signal.category === "collab_preferences") ||
    params.diagnosis.creatorSignals.some((signal) => signal.type === "collab_preference");
  if (hasCollabSignal || params.diagnosis.creatorIntent?.toLowerCase().includes("collab")) {
    [
      "complementary_authority",
      "practical_application",
      "audience_bridge",
      "format_contrast",
      "brand_safe_collab",
    ].slice(0, params.accessLevel === "free" ? 2 : 5).forEach((type) => {
      opportunities.push({
        id: `collab-${type}`,
        type: "collab_type",
        label: sanitizeVideoNarrativeEvolvingDiagnosisText(`Tipo de collab futuro: ${type.replace(/_/g, " ")}`),
        description: sanitizeVideoNarrativeEvolvingDiagnosisText(
          "Indica um caminho de colaboração futura sem sugerir nomes reais de creators ou criar match real.",
        ),
        confidence: "low",
        realMatchAvailable: false,
        requiresPremium: params.accessLevel === "free",
        requiresInstagram: false,
      });
    });
  }

  if (params.instagramConnected && params.accessLevel === "instagram_optimized") {
    opportunities.push({
      id: "performance-context-future",
      type: "performance_context",
      label: "Comparação futura com Instagram disponível no contexto",
      description: "A leitura pode considerar contexto futuro/mockado de Instagram, sem afirmar uso de dados reais nesta fase.",
      confidence: "medium",
      realMatchAvailable: false,
      requiresPremium: false,
      requiresInstagram: false,
    });
  }

  return opportunities;
}

function buildSubscriptionUnlocks(accessLevel: VideoNarrativeDiagnosisAccessLevel): VideoNarrativeEvolvingDiagnosisUnlock[] {
  if (accessLevel !== "free") return [];

  return [
    {
      id: "unlock-complete-evolution",
      label: "Evolução completa entre vídeos",
      description: "Libera leitura mais profunda do mapa estratégico conforme novos vídeos geram sinais recorrentes.",
      reason: "requires_premium",
    },
    {
      id: "unlock-commercial-map",
      label: "Potencial comercial completo",
      description: "Aprofunda territórios de marca e oportunidades futuras sem criar match real.",
      reason: "requires_premium",
    },
    {
      id: "unlock-collab-map",
      label: "Tipos de collab possíveis",
      description: "Organiza caminhos de colaboração futura sem sugerir creators reais.",
      reason: "requires_premium",
    },
    {
      id: "unlock-deeper-patterns",
      label: "Padrões recorrentes mais profundos",
      description: "Mostra mais sinais, variedade e recorrência do perfil narrativo.",
      reason: "requires_premium",
    },
  ];
}

function buildInstagramUnlocks(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
}): VideoNarrativeEvolvingDiagnosisUnlock[] {
  if (params.instagramConnected) return [];

  return [
    {
      id: "unlock-instagram-comparison",
      label: "Comparação com Instagram",
      description: "Conecta o diagnóstico ao contexto futuro de conteúdos e formatos do perfil.",
      reason: "requires_instagram_connection",
    },
    {
      id: "unlock-performance-precision",
      label: "Precisão por performance",
      description: "Ajuda a entender quais sinais narrativos combinam melhor com o histórico do perfil.",
      reason: "requires_instagram_connection",
    },
  ];
}

function buildAccessSummary(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
  profileSignalsUsed: boolean;
}): VideoNarrativeEvolvingDiagnosisAccessSummary {
  if (params.accessLevel === "instagram_optimized" && params.instagramConnected) {
    return {
      accessLevel: params.accessLevel,
      isLimited: false,
      instagramConnected: true,
      precision: "instagram_contextual",
      message: "Leitura mais precisa com contexto futuro/mockado de Instagram disponível, sem usar dados reais nesta fase.",
    };
  }

  if (params.accessLevel === "premium") {
    return {
      accessLevel: params.accessLevel,
      isLimited: false,
      instagramConnected: params.instagramConnected,
      precision: params.profileSignalsUsed ? "profile_based" : "initial",
      message: "Mapa estratégico premium liberado sem depender de Instagram real.",
    };
  }

  return {
    accessLevel: params.accessLevel,
    isLimited: true,
    instagramConnected: params.instagramConnected,
    precision: "initial",
    message: "Primeira leitura útil e limitada; a evolução completa do mapa estratégico fica desbloqueável.",
  };
}

function buildProfileImpact(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
  usefulSignalsCount: number;
  recurringSignalsCount: number;
  newSignalsCount: number;
  recurringPatternsCount: number;
  profileSignalsUsed: boolean;
  diagnosis: VideoNarrativeStrategicDiagnosis;
}): VideoNarrativeCreatorProfileImpact {
  const depth: VideoNarrativeCreatorProfileImpact["depth"] =
    params.accessLevel === "instagram_optimized" && params.instagramConnected
      ? "instagram_contextual"
      : params.accessLevel === "premium"
        ? "deep"
        : params.accessLevel === "instagram_optimized"
          ? "deep"
          : "limited";

  const firstReading = clean(params.diagnosis.mainNarrative ?? params.diagnosis.whatVideoCommunicates) ??
    "primeira leitura estratégica";
  const adjustment = clean(params.diagnosis.recommendedAdjustment);
  const summary =
    params.accessLevel === "free"
      ? `Este vídeo adiciona uma primeira leitura ao mapa estratégico: ${firstReading}${adjustment ? `. Ajuste principal: ${adjustment}` : ""}.`
      : `Este vídeo atualiza o mapa estratégico com ${params.newSignalsCount} sinais do diagnóstico, ${params.usefulSignalsCount} sinais úteis no perfil e ${params.recurringSignalsCount} sinais recorrentes.`;

  return {
    summary: sanitizeVideoNarrativeEvolvingDiagnosisText(summary),
    depth,
    usefulSignalsCount: params.accessLevel === "free"
      ? Math.min(params.usefulSignalsCount, 2)
      : params.usefulSignalsCount,
    recurringSignalsCount: params.accessLevel === "free"
      ? Math.min(params.recurringSignalsCount, 1)
      : params.recurringSignalsCount,
    newSignalsCount: params.accessLevel === "free"
      ? Math.min(params.newSignalsCount, 1)
      : params.newSignalsCount,
    recurringPatternsCount: params.accessLevel === "free"
      ? Math.min(params.recurringPatternsCount, 1)
      : params.recurringPatternsCount,
    profileSignalsUsed: params.profileSignalsUsed,
  };
}

export function sanitizeVideoNarrativeEvolvingDiagnosisText(value: string): string {
  let sanitized = sanitizeVideoNarrativeDiagnosisText(value);
  sanitized = sanitized.replace(/\bAIza[0-9A-Za-z_-]{8,}/g, "[redigido]");
  sanitized = sanitized.replace(/\b(?:GEMINI_API_KEY|GOOGLE_GENAI_API_KEY|API_KEY)=\S+/g, "[redigido]");
  sanitized = sanitized.replace(/\b[A-Za-z0-9+/]{120,}={0,2}\b/g, "[redigido]");
  sanitized = sanitized.replace(/\bhttps?:\/\/\S*(?:\?|&)(?:token|signature|sig|X-Amz-Signature|Expires)=\S*/gi, "[redigido]");

  BLOCKED_TERMS.forEach((term) => {
    sanitized = sanitized.replace(new RegExp(term.replace(/\s+/g, "\\s+"), "gi"), "[redigido]");
  });

  return sanitized.trim();
}

export function buildVideoNarrativeEvolvingDiagnosis(
  input: VideoNarrativeEvolvingDiagnosisInput,
): VideoNarrativeEvolvingDiagnosis {
  const profileSignals = usefulProfileSignals(input.creatorProfile);
  const diagnosisSignals = input.diagnosis.creatorSignals.filter((signal) => signal.value.trim());
  const instagramConnected = Boolean(input.instagramConnected);
  const analyzedVideosCount = Math.max(0, input.analyzedVideosCount ?? 0);
  const categories = new Set(profileSignals.map((signal) => signal.category));
  diagnosisSignals.forEach((signal) => categories.add(signal.type as VideoNarrativeCreatorProfileSignalCategory));

  const hasContentGoal = hasAnySignal({
    profileSignals,
    diagnosisSignals,
    profileCategory: "content_goals",
    diagnosisType: "content_goal",
  });
  const hasHookPreference = hasAnySignal({
    profileSignals,
    diagnosisSignals,
    profileCategory: "hook_preferences",
    diagnosisType: "hook_preference",
  });
  const hasFormatPreference = hasAnySignal({
    profileSignals,
    diagnosisSignals,
    profileCategory: "format_preferences",
    diagnosisType: "format_preference",
  });
  const hasBrandTerritory = hasAnySignal({
    profileSignals,
    diagnosisSignals,
    profileCategory: "brand_territories",
    diagnosisType: "brand_territory",
  }) || input.diagnosis.brandPotential.territories.length > 0;
  const hasCollabPreference = hasAnySignal({
    profileSignals,
    diagnosisSignals,
    profileCategory: "collab_preferences",
    diagnosisType: "collab_preference",
  });
  const hasCommercialSignal = hasAnySignal({
    profileSignals,
    diagnosisSignals,
    profileCategory: "commercial_preferences",
    diagnosisType: "commercial_preference",
  }) || input.diagnosis.brandPotential.enabled;

  const recurringSignalsCount = profileSignals.filter((signal) => signal.recurrenceCount >= 2).length;
  const usefulSignalsCount = profileSignals.length + diagnosisSignals.length;
  const currentLevel = computeLevel({
    usefulSignalsCount,
    recurringSignalsCount,
    categoriesCount: categories.size,
    hasContentGoal,
    hasHookPreference,
    hasFormatPreference,
    hasBrandTerritory,
    hasCollabPreference,
    hasCommercialSignal,
    accessLevel: input.accessLevel,
    instagramConnected,
    analyzedVideosCount,
  });
  const recurringPatterns = buildRecurringPatterns(profileSignals);
  const unlockedSignals = buildUnlockedSignals({
    diagnosis: input.diagnosis,
    profileSignals,
    accessLevel: input.accessLevel,
  });
  const pendingSignals = buildPendingSignals({
    hasFormatPreference,
    hasBrandTerritory,
    hasCollabPreference,
    instagramConnected,
    accessLevel: input.accessLevel,
  });

  return {
    id: `evolving-diagnosis-${input.diagnosis.id}`,
    accessLevel: input.accessLevel,
    videoDiagnosisId: input.diagnosis.id,
    currentLevel,
    nextLevel: nextLevelFor(currentLevel),
    profileImpact: buildProfileImpact({
      accessLevel: input.accessLevel,
      instagramConnected,
      usefulSignalsCount,
      recurringSignalsCount,
      newSignalsCount: diagnosisSignals.length,
      recurringPatternsCount: recurringPatterns.length,
      profileSignalsUsed: profileSignals.length > 0,
      diagnosis: input.diagnosis,
    }),
    unlockedSignals,
    pendingSignals,
    nextSignalsToUnlock: buildNextSignalsToUnlock(pendingSignals),
    recurringPatterns: input.accessLevel === "free" ? recurringPatterns.slice(0, 1) : recurringPatterns,
    opportunities: buildOpportunities({
      diagnosis: input.diagnosis,
      profileSignals,
      accessLevel: input.accessLevel,
      instagramConnected,
    }),
    subscriptionUnlocks: buildSubscriptionUnlocks(input.accessLevel),
    instagramUnlocks: buildInstagramUnlocks({
      accessLevel: input.accessLevel,
      instagramConnected,
    }),
    accessSummary: buildAccessSummary({
      accessLevel: input.accessLevel,
      instagramConnected,
      profileSignalsUsed: profileSignals.length > 0,
    }),
    createdAt: input.createdAt ?? input.diagnosis.createdAt ?? null,
  };
}
