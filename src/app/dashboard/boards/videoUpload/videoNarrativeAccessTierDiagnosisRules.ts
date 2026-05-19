import {
  sanitizeVideoNarrativeEvolvingDiagnosisText,
  type VideoNarrativeEvolvingDiagnosis,
  type VideoNarrativeEvolvingDiagnosisOpportunity,
} from "./videoNarrativeEvolvingDiagnosisContract";
import type { VideoNarrativeDiagnosisAccessLevel } from "./videoNarrativeDiagnosisLearningModel";

export type VideoNarrativeAccessTierValueLayer =
  | "first_reading"
  | "strategic_map"
  | "instagram_precision";

export type VideoNarrativeAccessTierSectionKey =
  | "main_video_reading"
  | "primary_adjustment"
  | "first_creator_signal"
  | "limited_profile_impact"
  | "full_profile_impact"
  | "unlocked_signals"
  | "pending_signals"
  | "next_signals"
  | "recurring_patterns"
  | "brand_opportunities"
  | "collab_opportunities"
  | "script_blueprint_depth"
  | "instagram_precision"
  | "performance_comparison";

export interface VideoNarrativeAccessTierVisibleSection {
  key: VideoNarrativeAccessTierSectionKey;
  label: string;
  description: string;
  limited: boolean;
}

export interface VideoNarrativeAccessTierLockedSection {
  key: VideoNarrativeAccessTierSectionKey;
  label: string;
  reason: VideoNarrativeAccessTierUpgradeReason | VideoNarrativeAccessTierInstagramReason;
  message: string;
}

export type VideoNarrativeAccessTierPrimaryCTAAction =
  | "upgrade"
  | "connect_instagram"
  | "generate_next_strategic_move";

export interface VideoNarrativeAccessTierPrimaryCTA {
  label: string;
  action: VideoNarrativeAccessTierPrimaryCTAAction;
  helper: string;
}

export interface VideoNarrativeAccessTierUpgradeReason {
  id:
    | "complete_strategic_map"
    | "full_recurring_patterns"
    | "full_brand_opportunities"
    | "full_collab_opportunities"
    | "script_blueprint_depth";
  label: string;
  description: string;
}

export interface VideoNarrativeAccessTierInstagramReason {
  id:
    | "instagram_precision"
    | "performance_comparison"
    | "audience_validated_formats";
  label: string;
  description: string;
}

export type VideoNarrativeAccessTierAvailabilityState =
  | "teaser_only"
  | "strategic_available"
  | "instagram_precision_available"
  | "unavailable";

export interface VideoNarrativeAccessTierCommercialAvailability {
  state: VideoNarrativeAccessTierAvailabilityState;
  hasSignals: boolean;
  label: string;
  description: string;
  realMatchAvailable: false;
}

export interface VideoNarrativeAccessTierCollabAvailability {
  state: VideoNarrativeAccessTierAvailabilityState;
  hasSignals: boolean;
  label: string;
  description: string;
  realMatchAvailable: false;
}

export interface VideoNarrativeAccessTierDiagnosisRulesInput {
  evolvingDiagnosis: VideoNarrativeEvolvingDiagnosis;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected?: boolean;
}

export interface VideoNarrativeAccessTierDiagnosisRules {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  valueLayer: VideoNarrativeAccessTierValueLayer;
  visibleSections: VideoNarrativeAccessTierVisibleSection[];
  lockedSections: VideoNarrativeAccessTierLockedSection[];
  primaryCTA: VideoNarrativeAccessTierPrimaryCTA;
  upgradeReasons: VideoNarrativeAccessTierUpgradeReason[];
  instagramReasons: VideoNarrativeAccessTierInstagramReason[];
  commercialAvailability: VideoNarrativeAccessTierCommercialAvailability;
  collabAvailability: VideoNarrativeAccessTierCollabAvailability;
  canShowFullProfileImpact: boolean;
  canShowFullRecurringPatterns: boolean;
  canShowFullBrandOpportunities: boolean;
  canShowFullCollabOpportunities: boolean;
  canShowInstagramPrecision: boolean;
  shouldTeaseSubscription: boolean;
  shouldTeaseInstagramConnection: boolean;
}

function clean(value: string): string {
  return sanitizeVideoNarrativeAccessTierDiagnosisRulesText(value);
}

export function sanitizeVideoNarrativeAccessTierDiagnosisRulesText(value: string): string {
  return sanitizeVideoNarrativeEvolvingDiagnosisText(value);
}

function hasOpportunities(
  diagnosis: VideoNarrativeEvolvingDiagnosis,
  type: VideoNarrativeEvolvingDiagnosisOpportunity["type"],
): boolean {
  return diagnosis.opportunities.some((opportunity) => opportunity.type === type);
}

function visibleSection(
  key: VideoNarrativeAccessTierSectionKey,
  label: string,
  description: string,
  limited: boolean,
): VideoNarrativeAccessTierVisibleSection {
  return {
    key,
    label: clean(label),
    description: clean(description),
    limited,
  };
}

function upgradeReason(
  id: VideoNarrativeAccessTierUpgradeReason["id"],
  label: string,
  description: string,
): VideoNarrativeAccessTierUpgradeReason {
  return {
    id,
    label: clean(label),
    description: clean(description),
  };
}

function instagramReason(
  id: VideoNarrativeAccessTierInstagramReason["id"],
  label: string,
  description: string,
): VideoNarrativeAccessTierInstagramReason {
  return {
    id,
    label: clean(label),
    description: clean(description),
  };
}

function lockedSection(
  key: VideoNarrativeAccessTierSectionKey,
  label: string,
  reason: VideoNarrativeAccessTierUpgradeReason | VideoNarrativeAccessTierInstagramReason,
  message: string,
): VideoNarrativeAccessTierLockedSection {
  return {
    key,
    label: clean(label),
    reason,
    message: clean(message),
  };
}

function buildUpgradeReasons(accessLevel: VideoNarrativeDiagnosisAccessLevel): VideoNarrativeAccessTierUpgradeReason[] {
  if (accessLevel !== "free") return [];

  return [
    upgradeReason(
      "complete_strategic_map",
      "Mapa estratégico completo",
      "Libera a leitura completa entre vídeos, sinais e próximos movimentos.",
    ),
    upgradeReason(
      "full_recurring_patterns",
      "Padrões recorrentes completos",
      "Mostra mais recorrência e variedade do creator ao longo das análises.",
    ),
    upgradeReason(
      "full_brand_opportunities",
      "Oportunidades futuras de marca",
      "Aprofunda territórios de marca e fit narrativo sem criar match real.",
    ),
    upgradeReason(
      "full_collab_opportunities",
      "Tipos de collab possíveis",
      "Organiza tipos de colaboração futura sem sugerir creators reais.",
    ),
    upgradeReason(
      "script_blueprint_depth",
      "Blueprint e roteiro completos",
      "Aprofunda os caminhos de execução quando o diagnóstico base tiver material suficiente.",
    ),
  ];
}

function buildInstagramReasons(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
}): VideoNarrativeAccessTierInstagramReason[] {
  if (params.accessLevel === "instagram_optimized" && params.instagramConnected) return [];

  return [
    instagramReason(
      "instagram_precision",
      "Leitura mais precisa com Instagram",
      "Adiciona contexto futuro de Instagram para calibrar a leitura sem prometer performance.",
    ),
    instagramReason(
      "performance_comparison",
      "Comparação com performance",
      "Ajuda a comparar narrativa e formato com sinais futuros do perfil.",
    ),
    instagramReason(
      "audience_validated_formats",
      "Formatos validados pela audiência",
      "Ajuda a entender quais formatos e narrativas parecem mais coerentes com o histórico futuro.",
    ),
  ];
}

function buildVisibleSections(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
  hasBrandSignals: boolean;
  hasCollabSignals: boolean;
}): VideoNarrativeAccessTierVisibleSection[] {
  if (params.accessLevel === "free") {
    const sections = [
      visibleSection(
        "main_video_reading",
        "Leitura principal do vídeo",
        "Mostra a primeira leitura estratégica que já ajuda a entender o vídeo.",
        false,
      ),
      visibleSection(
        "primary_adjustment",
        "Ajuste principal",
        "Mostra o ajuste mais importante para deixar a direção do conteúdo mais clara.",
        false,
      ),
      visibleSection(
        "first_creator_signal",
        "Primeiro sinal do mapa",
        "Mostra o primeiro sinal útil para o mapa estratégico do creator.",
        true,
      ),
      visibleSection(
        "limited_profile_impact",
        "Impacto limitado no perfil",
        "Resume como esse vídeo começa a alimentar o mapa estratégico.",
        true,
      ),
    ];

    if (params.hasBrandSignals) {
      sections.push(visibleSection(
        "brand_opportunities",
        "Teaser de território de marca",
        "Mostra indício de oportunidade futura sem match real.",
        true,
      ));
    }

    if (params.hasCollabSignals) {
      sections.push(visibleSection(
        "collab_opportunities",
        "Teaser de tipo de collab",
        "Mostra indício de colaboração futura sem sugerir creators reais.",
        true,
      ));
    }

    return sections;
  }

  const sections = [
    visibleSection("main_video_reading", "Leitura principal do vídeo", "Mantém a leitura estratégica do vídeo.", false),
    visibleSection("full_profile_impact", "Impacto completo no perfil", "Mostra como o vídeo altera o mapa estratégico.", false),
    visibleSection("unlocked_signals", "Sinais desbloqueados", "Mostra sinais já identificados no diagnóstico e no perfil.", false),
    visibleSection("pending_signals", "Sinais pendentes", "Mostra o que ainda precisa ser observado.", false),
    visibleSection("next_signals", "Próximos sinais", "Mostra os próximos sinais a desbloquear.", false),
    visibleSection("recurring_patterns", "Padrões recorrentes", "Mostra padrões que começam a se repetir.", false),
    visibleSection("brand_opportunities", "Oportunidades futuras de marca", "Mostra territórios e fit narrativo sem match real.", false),
    visibleSection("collab_opportunities", "Tipos de collab possíveis", "Mostra tipos de colaboração futura sem nomes reais.", false),
  ];

  if (params.accessLevel === "instagram_optimized" && params.instagramConnected) {
    sections.push(visibleSection(
      "instagram_precision",
      "Precisão contextual com Instagram",
      "Mostra camada de precisão contextual futura sem afirmar uso de dados reais nesta fase.",
      false,
    ));
  }

  return sections;
}

function buildLockedSections(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
  upgradeReasons: VideoNarrativeAccessTierUpgradeReason[];
  instagramReasons: VideoNarrativeAccessTierInstagramReason[];
}): VideoNarrativeAccessTierLockedSection[] {
  const locked: VideoNarrativeAccessTierLockedSection[] = [];

  if (params.accessLevel === "free") {
    params.upgradeReasons.forEach((reason) => {
      const keyByReason: Record<VideoNarrativeAccessTierUpgradeReason["id"], VideoNarrativeAccessTierSectionKey> = {
        complete_strategic_map: "full_profile_impact",
        full_recurring_patterns: "recurring_patterns",
        full_brand_opportunities: "brand_opportunities",
        full_collab_opportunities: "collab_opportunities",
        script_blueprint_depth: "script_blueprint_depth",
      };
      locked.push(lockedSection(
        keyByReason[reason.id],
        reason.label,
        reason,
        "Disponível no diagnóstico completo para aprofundar o mapa estratégico.",
      ));
    });
  }

  if (!params.instagramConnected) {
    params.instagramReasons.forEach((reason) => {
      const key = reason.id === "instagram_precision"
        ? "instagram_precision"
        : reason.id === "performance_comparison"
          ? "performance_comparison"
          : "recurring_patterns";
      locked.push(lockedSection(
        key,
        reason.label,
        reason,
        "Disponível com conexão de Instagram para adicionar contexto futuro de precisão.",
      ));
    });
  }

  return locked;
}

function buildPrimaryCTA(params: {
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
}): VideoNarrativeAccessTierPrimaryCTA {
  if (params.accessLevel === "free") {
    return {
      label: "Desbloquear diagnóstico completo",
      action: "upgrade",
      helper: clean("A primeira leitura já é útil; o diagnóstico completo aprofunda o mapa estratégico."),
    };
  }

  if (!params.instagramConnected) {
    return {
      label: "Conectar Instagram para aumentar precisão",
      action: "connect_instagram",
      helper: clean("Premium vende profundidade estratégica; Instagram adiciona contexto futuro de precisão."),
    };
  }

  return {
    label: "Gerar próximo movimento estratégico",
    action: "generate_next_strategic_move",
    helper: clean("Usa o mapa estratégico e contexto futuro de Instagram sem prometer performance."),
  };
}

function availabilityDescription(params: {
  kind: "brand" | "collab";
  state: VideoNarrativeAccessTierAvailabilityState;
}): string {
  if (params.state === "unavailable") {
    return params.kind === "brand"
      ? "Ainda não há sinal suficiente para território de marca."
      : "Ainda não há sinal suficiente para tipo de collab.";
  }
  if (params.state === "teaser_only") {
    return params.kind === "brand"
      ? "Mostra apenas teaser de território de marca possível, sem match real."
      : "Mostra apenas teaser de tipo de collab possível, sem creators reais.";
  }
  if (params.state === "instagram_precision_available") {
    return params.kind === "brand"
      ? "Mostra oportunidade futura com contexto de precisão do Instagram, sem match real."
      : "Mostra tipo de collab com maior contexto futuro, sem match real ou nomes reais.";
  }
  return params.kind === "brand"
    ? "Mostra oportunidade estratégica de marca por território e fit narrativo, sem match real."
    : "Mostra tipos de collab possíveis sem match, chat, notificação ou nomes reais.";
}

function resolveAvailabilityState(params: {
  hasSignals: boolean;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
}): VideoNarrativeAccessTierAvailabilityState {
  if (!params.hasSignals) return "unavailable";
  if (params.accessLevel === "free") return "teaser_only";
  if (params.accessLevel === "instagram_optimized" && params.instagramConnected) {
    return "instagram_precision_available";
  }
  return "strategic_available";
}

function buildCommercialAvailability(params: {
  hasSignals: boolean;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
}): VideoNarrativeAccessTierCommercialAvailability {
  const state = resolveAvailabilityState(params);

  return {
    state,
    hasSignals: params.hasSignals,
    label: clean(state === "unavailable" ? "Sem território de marca suficiente" : "Território de marca e fit narrativo"),
    description: clean(availabilityDescription({ kind: "brand", state })),
    realMatchAvailable: false,
  };
}

function buildCollabAvailability(params: {
  hasSignals: boolean;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected: boolean;
}): VideoNarrativeAccessTierCollabAvailability {
  const state = resolveAvailabilityState(params);

  return {
    state,
    hasSignals: params.hasSignals,
    label: clean(state === "unavailable" ? "Sem tipo de collab suficiente" : "Tipo de collab futuro"),
    description: clean(availabilityDescription({ kind: "collab", state })),
    realMatchAvailable: false,
  };
}

function sanitizeRules(rules: VideoNarrativeAccessTierDiagnosisRules): VideoNarrativeAccessTierDiagnosisRules {
  return JSON.parse(sanitizeVideoNarrativeEvolvingDiagnosisText(JSON.stringify(rules))) as VideoNarrativeAccessTierDiagnosisRules;
}

export function buildVideoNarrativeAccessTierDiagnosisRules(
  input: VideoNarrativeAccessTierDiagnosisRulesInput,
): VideoNarrativeAccessTierDiagnosisRules {
  const instagramConnected = Boolean(input.instagramConnected);
  const hasBrandSignals = hasOpportunities(input.evolvingDiagnosis, "brand_territory");
  const hasCollabSignals = hasOpportunities(input.evolvingDiagnosis, "collab_type");
  const canShowInstagramPrecision = input.accessLevel === "instagram_optimized" && instagramConnected;
  const upgradeReasons = buildUpgradeReasons(input.accessLevel);
  const instagramReasons = buildInstagramReasons({ accessLevel: input.accessLevel, instagramConnected });
  const valueLayer: VideoNarrativeAccessTierValueLayer = canShowInstagramPrecision
    ? "instagram_precision"
    : input.accessLevel === "free"
      ? "first_reading"
      : "strategic_map";

  const rules: VideoNarrativeAccessTierDiagnosisRules = {
    accessLevel: input.accessLevel,
    valueLayer,
    visibleSections: buildVisibleSections({
      accessLevel: input.accessLevel,
      instagramConnected,
      hasBrandSignals,
      hasCollabSignals,
    }),
    lockedSections: buildLockedSections({
      accessLevel: input.accessLevel,
      instagramConnected,
      upgradeReasons,
      instagramReasons,
    }),
    primaryCTA: buildPrimaryCTA({ accessLevel: input.accessLevel, instagramConnected }),
    upgradeReasons,
    instagramReasons,
    commercialAvailability: buildCommercialAvailability({
      hasSignals: hasBrandSignals,
      accessLevel: input.accessLevel,
      instagramConnected,
    }),
    collabAvailability: buildCollabAvailability({
      hasSignals: hasCollabSignals,
      accessLevel: input.accessLevel,
      instagramConnected,
    }),
    canShowFullProfileImpact: input.accessLevel !== "free",
    canShowFullRecurringPatterns: input.accessLevel !== "free",
    canShowFullBrandOpportunities: input.accessLevel !== "free" && hasBrandSignals,
    canShowFullCollabOpportunities: input.accessLevel !== "free" && hasCollabSignals,
    canShowInstagramPrecision,
    shouldTeaseSubscription: input.accessLevel === "free" && upgradeReasons.length > 0,
    shouldTeaseInstagramConnection: !instagramConnected && instagramReasons.length > 0,
  };

  return sanitizeRules(rules);
}
