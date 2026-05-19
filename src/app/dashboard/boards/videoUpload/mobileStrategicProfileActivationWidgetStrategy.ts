import { sanitizeMobileStrategicProfileText } from "./mobileStrategicProfileStateContract";

export type MobileStrategicProfileActivationWidgetSurface =
  | "production_dashboard"
  | "strategic_profile_preview"
  | "future_mobile_app";

export type MobileStrategicProfileActivationWidgetViewport = "mobile" | "desktop";

export type MobileStrategicProfileActivationWidgetPolicy =
  | "keep_current_for_production"
  | "hide_on_future_mobile_app"
  | "convert_to_profile_card"
  | "desktop_only"
  | "reserve_safe_area_above_bottom_nav"
  | "defer_until_navigation_integration";

export type MobileStrategicProfileActivationWidgetRiskSeverity = "high" | "medium" | "low";

export interface MobileStrategicProfileActivationWidgetStrategyInput {
  currentSurface: MobileStrategicProfileActivationWidgetSurface;
  viewport: MobileStrategicProfileActivationWidgetViewport;
  hasBottomNav?: boolean;
  hasCentralAnalyzeAction?: boolean;
  hasMediaKitModal?: boolean;
  hasAnalyzeFlow?: boolean;
  activationWidgetVisible?: boolean;
  activationWidgetCompletionVisible?: boolean;
  profileAvailability?: "auth_gate" | "construction" | "active" | null;
  createdAt?: string | null;
}

export interface MobileStrategicProfileActivationWidgetConflict {
  id:
    | "bottom_nav_overlap"
    | "central_action_competition"
    | "media_kit_modal_overlap"
    | "analyze_flow_distraction"
    | "profile_cta_duplication"
    | "safe_area_collision";
  surface: MobileStrategicProfileActivationWidgetSurface;
  description: string;
}

export interface MobileStrategicProfileActivationWidgetRisk {
  id:
    | "bottom_nav_overlap"
    | "central_action_competition"
    | "media_kit_modal_overlap"
    | "analyze_flow_distraction"
    | "onboarding_cta_duplication"
    | "z_index_conflict"
    | "safe_area_collision"
    | "production_regression";
  severity: MobileStrategicProfileActivationWidgetRiskSeverity;
  description: string;
}

export interface MobileStrategicProfileActivationWidgetFutureDecision {
  id:
    | "hide_with_feature_flag"
    | "convert_to_profile_card"
    | "desktop_only"
    | "safe_area_reposition"
    | "construction_state_only"
    | "profile_checklist";
  title: string;
  description: string;
}

export interface MobileStrategicProfileActivationWidgetGuardrail {
  id:
    | "do_not_change_activation_widget_now"
    | "do_not_overlap_bottom_nav"
    | "do_not_compete_with_central_plus"
    | "do_not_block_media_kit_modal"
    | "do_not_interrupt_analyze_flow"
    | "prefer_profile_card_for_mobile_onboarding"
    | "keep_desktop_behavior_until_integration"
    | "require_feature_flag_before_real_change";
  description: string;
}

export interface MobileStrategicProfileActivationWidgetStrategy {
  currentSurface: MobileStrategicProfileActivationWidgetSurface;
  viewport: MobileStrategicProfileActivationWidgetViewport;
  recommendedPolicy: MobileStrategicProfileActivationWidgetPolicy;
  conflicts: MobileStrategicProfileActivationWidgetConflict[];
  risks: MobileStrategicProfileActivationWidgetRisk[];
  guardrails: MobileStrategicProfileActivationWidgetGuardrail[];
  futureDecisions: MobileStrategicProfileActivationWidgetFutureDecision[];
  shouldChangeProductionNow: boolean;
  shouldHideInFutureMobileApp: boolean;
  shouldConvertToProfileCard: boolean;
  shouldKeepDesktopOnly: boolean;
  shouldReserveSafeArea: boolean;
  createdAt: string | null;
}

function clean(value: string | null | undefined): string | null {
  const sanitized = sanitizeMobileStrategicProfileText(value ?? "").trim();
  return sanitized || null;
}

function conflict(
  id: MobileStrategicProfileActivationWidgetConflict["id"],
  surface: MobileStrategicProfileActivationWidgetSurface,
  description: string,
): MobileStrategicProfileActivationWidgetConflict {
  return { id, surface, description };
}

function risk(
  id: MobileStrategicProfileActivationWidgetRisk["id"],
  severity: MobileStrategicProfileActivationWidgetRiskSeverity,
  description: string,
): MobileStrategicProfileActivationWidgetRisk {
  return { id, severity, description };
}

function guardrail(
  id: MobileStrategicProfileActivationWidgetGuardrail["id"],
  description: string,
): MobileStrategicProfileActivationWidgetGuardrail {
  return { id, description };
}

function decidePolicy(
  input: MobileStrategicProfileActivationWidgetStrategyInput,
): MobileStrategicProfileActivationWidgetPolicy {
  if (input.currentSurface === "production_dashboard") {
    return input.viewport === "desktop" ? "keep_current_for_production" : "defer_until_navigation_integration";
  }

  if (input.currentSurface === "strategic_profile_preview") {
    return "defer_until_navigation_integration";
  }

  if (input.viewport === "desktop") {
    return "desktop_only";
  }

  if (input.profileAvailability === "construction") {
    return "convert_to_profile_card";
  }

  if (input.hasBottomNav || input.hasCentralAnalyzeAction) {
    return "hide_on_future_mobile_app";
  }

  return "reserve_safe_area_above_bottom_nav";
}

export function buildMobileStrategicProfileActivationWidgetStrategy(
  input: MobileStrategicProfileActivationWidgetStrategyInput,
): MobileStrategicProfileActivationWidgetStrategy {
  const recommendedPolicy = decidePolicy(input);
  const mobile = input.viewport === "mobile";
  const futureMobile = input.currentSurface === "future_mobile_app";
  const preview = input.currentSurface === "strategic_profile_preview";
  const production = input.currentSurface === "production_dashboard";

  const conflicts: MobileStrategicProfileActivationWidgetConflict[] = [];
  if (input.hasBottomNav) {
    conflicts.push(conflict("bottom_nav_overlap", input.currentSurface, "Widget de ativação pode ocupar a mesma área da bottom nav."));
  }
  if (input.hasCentralAnalyzeAction) {
    conflicts.push(conflict("central_action_competition", input.currentSurface, "Widget de ativação pode competir com a ação central +."));
  }
  if (input.hasMediaKitModal) {
    conflicts.push(conflict("media_kit_modal_overlap", input.currentSurface, "Widget de ativação pode competir em camada visual com o modal de Mídia Kit."));
  }
  if (input.hasAnalyzeFlow) {
    conflicts.push(conflict("analyze_flow_distraction", input.currentSurface, "Widget de ativação pode tirar foco do fluxo de análise."));
  }
  if (input.activationWidgetCompletionVisible || input.profileAvailability === "construction") {
    conflicts.push(conflict("profile_cta_duplication", input.currentSurface, "Widget de ativação pode duplicar CTAs do Perfil em construção."));
  }
  if (mobile && input.activationWidgetVisible) {
    conflicts.push(conflict("safe_area_collision", input.currentSurface, "Widget de ativação pode colidir com safe area no mobile."));
  }

  const shouldHideInFutureMobileApp = futureMobile && mobile && Boolean(input.hasBottomNav || input.hasCentralAnalyzeAction);
  const shouldConvertToProfileCard = futureMobile && mobile && input.profileAvailability === "construction";
  const shouldKeepDesktopOnly = input.viewport === "desktop" && (production || futureMobile);
  const shouldReserveSafeArea = mobile && Boolean(input.activationWidgetVisible || input.hasBottomNav);

  return {
    currentSurface: input.currentSurface,
    viewport: input.viewport,
    recommendedPolicy,
    conflicts,
    risks: [
      risk("bottom_nav_overlap", "high", "Bottom nav e widget de ativação podem disputar a área inferior mobile."),
      risk("central_action_competition", "high", "Ação central + pode perder prioridade visual se o widget flutuante continuar no mesmo espaço."),
      risk("media_kit_modal_overlap", "medium", "Modal de Mídia Kit pode competir com camada visual do widget."),
      risk("analyze_flow_distraction", "medium", "Fluxo de análise pode perder foco se houver chamada de ativação simultânea."),
      risk("onboarding_cta_duplication", "medium", "CTAs de onboarding podem duplicar CTAs do Perfil Estratégico."),
      risk("z_index_conflict", "medium", "Camadas flutuantes podem gerar conflito visual em mobile."),
      risk("safe_area_collision", "high", "Área segura inferior do celular pode ser ocupada por nav e widget ao mesmo tempo."),
      risk("production_regression", "high", "Alterar o widget real antes da integração pode quebrar a experiência atual."),
    ],
    guardrails: [
      guardrail("do_not_change_activation_widget_now", "Não alterar o widget de ativação real neste PR."),
      guardrail("do_not_overlap_bottom_nav", "Não deixar widget flutuante competir com bottom nav futura."),
      guardrail("do_not_compete_with_central_plus", "Não competir com a ação central +."),
      guardrail("do_not_block_media_kit_modal", "Não bloquear ou sobrepor o modal de Mídia Kit."),
      guardrail("do_not_interrupt_analyze_flow", "Não interromper o fluxo de análise."),
      guardrail("prefer_profile_card_for_mobile_onboarding", "Preferir card interno do Perfil para onboarding mobile."),
      guardrail("keep_desktop_behavior_until_integration", "Preservar desktop até integração real com feature flag."),
      guardrail("require_feature_flag_before_real_change", "Toda alteração real deve passar por feature flag."),
    ],
    futureDecisions: [
      {
        id: "hide_with_feature_flag",
        title: "Ocultar no app mobile futuro",
        description: "Ocultar o widget flutuante por feature flag quando a navegação app-first estiver ativa.",
      },
      {
        id: "convert_to_profile_card",
        title: "Transformar em card interno",
        description: "Mover ativação para card interno do Perfil em estados de construção.",
      },
      {
        id: "desktop_only",
        title: "Manter apenas desktop",
        description: "Preservar comportamento desktop se a experiência mobile exigir bottom nav limpa.",
      },
      {
        id: "safe_area_reposition",
        title: "Reposicionar com safe area",
        description: "Reposicionar acima da bottom nav se o widget seguir visível no mobile.",
      },
      {
        id: "construction_state_only",
        title: "Mostrar só em construção",
        description: "Exibir ativação apenas em account_only/construction se continuar útil.",
      },
      {
        id: "profile_checklist",
        title: "Checklist dentro do Perfil",
        description: "Substituir widget flutuante por checklist contextual dentro do Perfil.",
      },
    ],
    shouldChangeProductionNow: false,
    shouldHideInFutureMobileApp,
    shouldConvertToProfileCard,
    shouldKeepDesktopOnly,
    shouldReserveSafeArea,
    createdAt: clean(input.createdAt),
  };
}
