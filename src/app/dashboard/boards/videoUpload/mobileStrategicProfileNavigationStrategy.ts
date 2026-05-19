import type {
  MobileStrategicProfile,
  MobileStrategicProfileNavigationModel,
} from "./mobileStrategicProfileMapping";
import { sanitizeMobileStrategicProfileText } from "./mobileStrategicProfileStateContract";

export type MobileStrategicProfileNavigationSurface =
  | "preview"
  | "future_mobile_app"
  | "production_dashboard";

export type MobileStrategicProfileNavigationDestinationId =
  | "profile"
  | "community"
  | "media_kit"
  | "diagnosis"
  | "commercial"
  | "videos"
  | "uploads"
  | "campaigns"
  | "calculator"
  | "crm"
  | "collabs"
  | "settings";

export type MobileStrategicProfileNavigationRiskSeverity = "high" | "medium" | "low";

export interface MobileStrategicProfileNavigationStrategyInput {
  profile: MobileStrategicProfile;
  isAuthenticated: boolean;
  profileHref?: string | null;
  analyzeVideoHref?: string | null;
  communityHref?: string | null;
  loginHref?: string | null;
  loginIntentProfileHref?: string | null;
  loginIntentAnalyzeHref?: string | null;
  activationWidgetPresent?: boolean;
  currentSurface?: MobileStrategicProfileNavigationSurface;
  createdAt?: string | null;
}

export interface MobileStrategicProfileNavigationDestination {
  id: Extract<MobileStrategicProfileNavigationDestinationId, "profile" | "community">;
  label: "Perfil" | "Comunidade";
  role: "destination";
  href: string | null;
  active: boolean;
  description: string;
  existingResource: boolean;
}

export interface MobileStrategicProfileNavigationAction {
  id: "analyze_video";
  label: "+";
  helper: "Analisar vídeo";
  role: "central_action";
  href: string | null;
  destinationAfterCompletion: "profile";
  temporary: true;
  description: string;
}

export interface MobileStrategicProfileNavigationAuthRedirect {
  id: "profile_auth" | "analyze_video_auth" | "community_auth";
  source: "profile" | "analyze_video" | "community";
  intent: "strategic_profile" | "analyze_video" | "community";
  href: string | null;
  description: string;
}

export interface MobileStrategicProfileNavigationForbiddenDestination {
  id: Exclude<MobileStrategicProfileNavigationDestinationId, "profile" | "community">;
  label: string;
  reason: string;
}

export interface MobileStrategicProfileNavigationFutureDecision {
  id: string;
  title: string;
  description: string;
}

export interface MobileStrategicProfileNavigationRisk {
  id:
    | "activation_widget_overlap"
    | "sidebar_mobile_conflict"
    | "duplicated_media_kit_entry"
    | "duplicated_community_entry"
    | "analyze_video_becoming_tab"
    | "profile_becoming_dashboard"
    | "video_history_pressure";
  severity: MobileStrategicProfileNavigationRiskSeverity;
  description: string;
}

export interface MobileStrategicProfileNavigationGuardrail {
  id:
    | "do_not_recreate_media_kit"
    | "do_not_recreate_community"
    | "do_not_add_video_history"
    | "do_not_make_analyze_video_a_tab"
    | "do_not_change_real_navigation_yet"
    | "keep_profile_as_mobile_home"
    | "keep_diagnosis_inside_profile"
    | "keep_commercial_inside_profile";
  description: string;
}

export interface MobileStrategicProfileNavigationStrategy {
  primaryDestinations: MobileStrategicProfileNavigationDestination[];
  centralAction: MobileStrategicProfileNavigationAction;
  secondaryDestinations: MobileStrategicProfileNavigationDestination[];
  authRedirects: MobileStrategicProfileNavigationAuthRedirect[];
  forbiddenDestinations: MobileStrategicProfileNavigationForbiddenDestination[];
  futureDecisions: MobileStrategicProfileNavigationFutureDecision[];
  risks: MobileStrategicProfileNavigationRisk[];
  guardrails: MobileStrategicProfileNavigationGuardrail[];
  sourceNavigation: MobileStrategicProfileNavigationModel;
  currentSurface: MobileStrategicProfileNavigationSurface;
  createdAt: string | null;
}

function clean(value: string | null | undefined): string | null {
  const sanitized = sanitizeMobileStrategicProfileText(value ?? "").trim();
  return sanitized || null;
}

function destinationHref(inputHref: string | null | undefined, fallbackHref: string | null | undefined): string | null {
  return clean(inputHref) ?? clean(fallbackHref);
}

function loginIntentHref(params: {
  explicitHref: string | null | undefined;
  loginHref: string | null | undefined;
  intent: "strategic_profile" | "analyze_video";
}): string | null {
  const explicitHref = clean(params.explicitHref);
  if (explicitHref) return explicitHref;

  const loginHref = clean(params.loginHref);
  if (!loginHref) return null;
  const separator = loginHref.includes("?") ? "&" : "?";
  return `${loginHref}${separator}intent=${params.intent}`;
}

function forbiddenDestination(
  id: MobileStrategicProfileNavigationForbiddenDestination["id"],
  label: string,
  reason: string,
): MobileStrategicProfileNavigationForbiddenDestination {
  return { id, label, reason };
}

function risk(
  id: MobileStrategicProfileNavigationRisk["id"],
  severity: MobileStrategicProfileNavigationRiskSeverity,
  description: string,
): MobileStrategicProfileNavigationRisk {
  return { id, severity, description };
}

function guardrail(
  id: MobileStrategicProfileNavigationGuardrail["id"],
  description: string,
): MobileStrategicProfileNavigationGuardrail {
  return { id, description };
}

export function buildMobileStrategicProfileNavigationStrategy(
  input: MobileStrategicProfileNavigationStrategyInput,
): MobileStrategicProfileNavigationStrategy {
  const profileHref = destinationHref(input.profileHref, input.profile.navigation.items.find((item) => item.id === "profile")?.href);
  const communityHref = destinationHref(input.communityHref, input.profile.communityBridge.href);
  const analyzeHref = destinationHref(input.analyzeVideoHref, input.profile.navigation.items.find((item) => item.id === "analyze_video")?.href);

  const primaryDestinations: MobileStrategicProfileNavigationDestination[] = [
    {
      id: "profile",
      label: "Perfil",
      role: "destination",
      href: profileHref,
      active: true,
      description: "Home mobile futura e lugar do Perfil Estratégico como Diagnóstico vivo.",
      existingResource: false,
    },
  ];

  const centralAction: MobileStrategicProfileNavigationAction = {
    id: "analyze_video",
    label: "+",
    helper: "Analisar vídeo",
    role: "central_action",
    href: analyzeHref,
    destinationAfterCompletion: "profile",
    temporary: true,
    description: "Ação central temporária para atualizar o Perfil; não é aba nem destino permanente.",
  };

  const secondaryDestinations: MobileStrategicProfileNavigationDestination[] = [
    {
      id: "community",
      label: "Comunidade",
      role: "destination",
      href: communityHref,
      active: false,
      description: "Destino existente da Comunidade Data2Content, sem recriar superfícies sociais novas.",
      existingResource: true,
    },
  ];

  const authRedirects: MobileStrategicProfileNavigationAuthRedirect[] = input.isAuthenticated
    ? []
    : [
        {
          id: "profile_auth",
          source: "profile",
          intent: "strategic_profile",
          href: loginIntentHref({
            explicitHref: input.loginIntentProfileHref,
            loginHref: input.loginHref,
            intent: "strategic_profile",
          }),
          description: "Perfil deve usar LoginClient com intenção de Perfil Estratégico em etapa futura.",
        },
        {
          id: "analyze_video_auth",
          source: "analyze_video",
          intent: "analyze_video",
          href: loginIntentHref({
            explicitHref: input.loginIntentAnalyzeHref,
            loginHref: input.loginHref,
            intent: "analyze_video",
          }),
          description: "Ação central deve usar LoginClient com intenção de análise narrativa em etapa futura.",
        },
        {
          id: "community_auth",
          source: "community",
          intent: "community",
          href: clean(input.loginHref),
          description: "Comunidade pode usar login/community existente, sem criar fluxo novo.",
        },
      ];

  return {
    primaryDestinations,
    centralAction,
    secondaryDestinations,
    authRedirects,
    forbiddenDestinations: [
      forbiddenDestination("media_kit", "Mídia Kit", "Mídia Kit existente deve ser bridge/modal dentro do Perfil, sem alterar a superfície real."),
      forbiddenDestination("diagnosis", "Diagnóstico", "Diagnóstico é aba interna do Perfil Estratégico, não tab global."),
      forbiddenDestination("commercial", "Comercial", "Comercial é aba interna do Perfil Estratégico, não tab global."),
      forbiddenDestination("videos", "Vídeos analisados", "A análise é temporária e não deve criar arquivo visual permanente."),
      forbiddenDestination("uploads", "Uploads", "Upload não é destino permanente da navegação mobile futura."),
      forbiddenDestination("campaigns", "Campanhas", "Campanhas ficam fora da navegação mobile enxuta neste momento."),
      forbiddenDestination("calculator", "Calculadora", "Calculadora fica fora da navegação mobile enxuta neste momento."),
      forbiddenDestination("crm", "CRM", "CRM fica fora da navegação mobile enxuta neste momento."),
      forbiddenDestination("collabs", "Collabs", "Collabs não entram como destino global nesta fase."),
      forbiddenDestination("settings", "Configurações", "Configurações não entram na bottom nav app-first inicial."),
    ],
    futureDecisions: [
      {
        id: "real_navigation_integration",
        title: "Integração com navegação real",
        description: "Definir etapa futura para integrar a bottom nav sem alterar sidebar/config neste PR.",
      },
      {
        id: "activation_widget_mobile_behavior",
        title: "ActivationPendingWidget no mobile",
        description: "Decidir entre ocultar por flag, transformar em card do Perfil, manter desktop, reposicionar ou condicionar ao onboarding.",
      },
      {
        id: "mobile_home_migration",
        title: "Migração da home mobile",
        description: "Migrar Perfil como home mobile sem quebrar o dashboard atual.",
      },
    ],
    risks: [
      ...(input.activationWidgetPresent
        ? [
            risk(
              "activation_widget_overlap",
              "high",
              "ActivationPendingWidget pode competir com bottom nav, ação central, CTAs do Perfil e modal de Mídia Kit.",
            ),
          ]
        : []),
      risk("sidebar_mobile_conflict", "high", "Sidebar/config atual tem comportamento mobile sensível e deve ser tratado em integração futura."),
      risk("duplicated_media_kit_entry", "medium", "Mídia Kit pode aparecer duplicado se virar item de navegação além do bridge/modal."),
      risk("duplicated_community_entry", "medium", "Comunidade pode aparecer duplicada entre navegação atual e bottom nav futura."),
      risk("analyze_video_becoming_tab", "high", "A ação + pode virar aba por pressão de produto, quebrando a decisão de ação temporária."),
      risk("profile_becoming_dashboard", "medium", "Perfil pode virar dashboard técnico se acumular métricas e módulos globais."),
      risk("video_history_pressure", "medium", "Pode surgir pressão para criar arquivo visual de análises, contrariando o diagnóstico vivo."),
    ],
    guardrails: [
      guardrail("do_not_recreate_media_kit", "Mídia Kit segue como recurso existente acessado por bridge/modal."),
      guardrail("do_not_recreate_community", "Comunidade segue como destino existente, sem superfícies sociais novas."),
      guardrail("do_not_add_video_history", "Não criar arquivo visual permanente de análises no Perfil mobile."),
      guardrail("do_not_make_analyze_video_a_tab", "+ / Analisar vídeo é ação central, não aba."),
      guardrail("do_not_change_real_navigation_yet", "Não alterar navegação real, sidebar/config, DashboardShell ou BoardShell neste PR."),
      guardrail("keep_profile_as_mobile_home", "Perfil é a home mobile futura."),
      guardrail("keep_diagnosis_inside_profile", "Diagnóstico fica dentro do Perfil."),
      guardrail("keep_commercial_inside_profile", "Comercial fica dentro do Perfil."),
    ],
    sourceNavigation: input.profile.navigation,
    currentSurface: input.currentSurface ?? "preview",
    createdAt: clean(input.createdAt),
  };
}
