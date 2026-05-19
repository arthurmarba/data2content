import type { VideoNarrativeDiagnosisAccessLevel } from "./videoNarrativeDiagnosisLearningModel";
import {
  sanitizeVideoNarrativeDiagnosisPresentationText,
  type VideoNarrativeDiagnosisPresentation,
} from "./videoNarrativeDiagnosisPresentationModel";

export type MobileStrategicProfileAuthState = "anonymous" | "authenticated";
export type MobileStrategicProfileAvailability = "auth_gate" | "construction" | "active";
export type MobileStrategicProfileReadinessState =
  | "account_only"
  | "first_diagnosis_pending"
  | "first_reading_ready"
  | "instagram_connected"
  | "strategic_profile_active";
export type MobileStrategicProfileDiagnosisState =
  | "empty"
  | "first_reading"
  | "limited"
  | "complete"
  | "instagram_optimized";
export type MobileStrategicProfileMediaKitState =
  | "unavailable"
  | "connect_instagram_required"
  | "available";
export type MobileStrategicProfileInstagramState = "disconnected" | "connected" | "reconnect_required";
export type MobileStrategicProfileSubscriptionState = "free" | "premium" | "trial" | "inactive";
export type MobileStrategicProfilePrimaryIntent =
  | "view_profile"
  | "analyze_video"
  | "connect_instagram"
  | "share_media_kit"
  | "upgrade"
  | "continue_diagnosis";

export interface MobileStrategicProfileRecommendedAction {
  id: string;
  intent: MobileStrategicProfilePrimaryIntent;
  label: string;
  description: string;
  priority: "primary" | "secondary";
  disabled: boolean;
}

export interface MobileStrategicProfileStatusPill {
  id: string;
  label: string;
  tone: "neutral" | "construction" | "active" | "premium" | "instagram" | "warning";
}

export interface MobileStrategicProfileStateSummary {
  title: string;
  description: string;
  helper: string | null;
}

export interface MobileStrategicProfileStateInput {
  isAuthenticated: boolean;
  userName?: string | null;
  userHandle?: string | null;
  userImage?: string | null;
  instagramConnected?: boolean;
  instagramUsername?: string | null;
  hasMediaKit?: boolean;
  mediaKitShareUrl?: string | null;
  accessLevel?: VideoNarrativeDiagnosisAccessLevel | null;
  planStatus?: string | null;
  hasPremiumAccess?: boolean;
  diagnosisPresentation?: VideoNarrativeDiagnosisPresentation | null;
  primaryIntent?: MobileStrategicProfilePrimaryIntent;
  createdAt?: string | null;
}

export interface MobileStrategicProfileState {
  authState: MobileStrategicProfileAuthState;
  profileAvailability: MobileStrategicProfileAvailability;
  readinessState: MobileStrategicProfileReadinessState;
  diagnosisState: MobileStrategicProfileDiagnosisState;
  mediaKitState: MobileStrategicProfileMediaKitState;
  instagramState: MobileStrategicProfileInstagramState;
  subscriptionState: MobileStrategicProfileSubscriptionState;
  primaryIntent: MobileStrategicProfilePrimaryIntent;
  displayName: string;
  displayHandle: string | null;
  userImage: string | null;
  statusPills: MobileStrategicProfileStatusPill[];
  recommendedActions: MobileStrategicProfileRecommendedAction[];
  summary: MobileStrategicProfileStateSummary;
  createdAt: string | null;
}

function clean(value: string | null | undefined, fallback = ""): string {
  const sanitized = sanitizeMobileStrategicProfileText(value ?? "");
  return sanitized.trim() || fallback;
}

function sentence(value: string, maxLength = 160): string {
  const sanitized = clean(value).replace(/\s+/g, " ").trim();
  if (sanitized.length <= maxLength) return sanitized;
  return `${sanitized.slice(0, maxLength - 1).trim()}…`;
}

function action(params: {
  id: string;
  intent: MobileStrategicProfilePrimaryIntent;
  label: string;
  description: string;
  priority: "primary" | "secondary";
  disabled?: boolean;
}): MobileStrategicProfileRecommendedAction {
  return {
    id: clean(params.id),
    intent: params.intent,
    label: sentence(params.label, 64),
    description: sentence(params.description, 150),
    priority: params.priority,
    disabled: params.disabled ?? false,
  };
}

function pill(
  id: string,
  label: string,
  tone: MobileStrategicProfileStatusPill["tone"],
): MobileStrategicProfileStatusPill {
  return {
    id: clean(id),
    label: sentence(label, 56),
    tone,
  };
}

function resolveSubscriptionState(input: MobileStrategicProfileStateInput): MobileStrategicProfileSubscriptionState {
  const normalizedPlan = clean(input.planStatus).toLowerCase();
  if (input.hasPremiumAccess || input.accessLevel === "premium" || input.accessLevel === "instagram_optimized") {
    return "premium";
  }
  if (normalizedPlan.includes("trial")) return "trial";
  if (normalizedPlan === "inactive" || normalizedPlan === "canceled" || normalizedPlan === "cancelled") return "inactive";
  return "free";
}

function resolveInstagramState(input: MobileStrategicProfileStateInput): MobileStrategicProfileInstagramState {
  const normalizedUsername = clean(input.instagramUsername);
  if (input.instagramConnected) return "connected";
  if (normalizedUsername) return "reconnect_required";
  return "disconnected";
}

function resolveMediaKitState(input: MobileStrategicProfileStateInput): MobileStrategicProfileMediaKitState {
  if (input.hasMediaKit || clean(input.mediaKitShareUrl)) return "available";
  if (input.instagramConnected || input.instagramUsername) return "unavailable";
  return "connect_instagram_required";
}

function resolveDiagnosisState(input: MobileStrategicProfileStateInput): MobileStrategicProfileDiagnosisState {
  if (!input.diagnosisPresentation) return "empty";
  if (input.accessLevel === "instagram_optimized" && input.instagramConnected) return "instagram_optimized";
  if (input.hasPremiumAccess || input.accessLevel === "premium") return "complete";
  if (input.accessLevel === "free") return "first_reading";
  return input.diagnosisPresentation.accessLevel === "free" ? "first_reading" : "limited";
}

function resolveReadinessState(params: {
  input: MobileStrategicProfileStateInput;
  diagnosisState: MobileStrategicProfileDiagnosisState;
  instagramState: MobileStrategicProfileInstagramState;
  subscriptionState: MobileStrategicProfileSubscriptionState;
}): MobileStrategicProfileReadinessState {
  if (!params.input.isAuthenticated) return "account_only";
  if (params.diagnosisState === "instagram_optimized" || params.subscriptionState === "premium") {
    return "strategic_profile_active";
  }
  if (params.instagramState === "connected" && params.diagnosisState !== "empty") return "instagram_connected";
  if (params.diagnosisState === "first_reading" || params.diagnosisState === "limited") return "first_reading_ready";
  return "first_diagnosis_pending";
}

function defaultIntent(input: MobileStrategicProfileStateInput): MobileStrategicProfilePrimaryIntent {
  if (input.primaryIntent) return input.primaryIntent;
  if (!input.isAuthenticated) return "view_profile";
  if (!input.diagnosisPresentation) return "analyze_video";
  if (!input.instagramConnected) return "connect_instagram";
  if (input.hasMediaKit || input.mediaKitShareUrl) return "share_media_kit";
  return "view_profile";
}

function buildAnonymousSummary(intent: MobileStrategicProfilePrimaryIntent): MobileStrategicProfileStateSummary {
  if (intent === "analyze_video") {
    return {
      title: "Entre para analisar seu primeiro vídeo",
      description: "Entre com Google para analisar seu primeiro vídeo.",
      helper: "O Perfil Estratégico nasce da primeira análise e evolui com novos vídeos.",
    };
  }

  return {
    title: "Crie seu Perfil Estratégico",
    description: "Entre com Google para criar seu Perfil Estratégico.",
    helper: "O Perfil da D2C é o diagnóstico vivo do creator. Cada vídeo analisado atualiza esse perfil.",
  };
}

function buildAuthenticatedSummary(params: {
  diagnosisState: MobileStrategicProfileDiagnosisState;
  readinessState: MobileStrategicProfileReadinessState;
  subscriptionState: MobileStrategicProfileSubscriptionState;
  instagramState: MobileStrategicProfileInstagramState;
  presentation: VideoNarrativeDiagnosisPresentation | null | undefined;
}): MobileStrategicProfileStateSummary {
  if (params.diagnosisState === "empty") {
    return {
      title: "Seu Perfil Estratégico ainda está começando.",
      description: "Analise seu primeiro vídeo para a D2C identificar sua narrativa, ponto forte e próximo passo.",
      helper: "O vídeo analisado é temporário; o aprendizado fica organizado no Perfil.",
    };
  }

  if (params.diagnosisState === "instagram_optimized") {
    return {
      title: "Diagnóstico vivo atualizado",
      description: "Seu Perfil Estratégico está ativo com leitura mais precisa por estado de Instagram conectado.",
      helper: "A leitura usa linguagem de estado e não promete performance.",
    };
  }

  if (params.subscriptionState === "premium" || params.diagnosisState === "complete") {
    return {
      title: "Diagnóstico atualizado",
      description: "Seu Perfil Estratégico conecta esta leitura aos próximos passos do creator.",
      helper: params.instagramState === "connected"
        ? "O Perfil segue evoluindo a cada análise."
        : "Conectar Instagram pode aumentar a precisão da leitura em uma etapa futura.",
    };
  }

  return {
    title: "Primeira leitura criada.",
    description: "A D2C já identificou uma direção inicial da sua narrativa.",
    helper: params.presentation?.readingTimeHint
      ? sentence(params.presentation.readingTimeHint, 96)
      : "Novas análises ajudam o Perfil Estratégico a ficar mais completo.",
  };
}

function buildStatusPills(params: {
  profileAvailability: MobileStrategicProfileAvailability;
  diagnosisState: MobileStrategicProfileDiagnosisState;
  mediaKitState: MobileStrategicProfileMediaKitState;
  instagramState: MobileStrategicProfileInstagramState;
  subscriptionState: MobileStrategicProfileSubscriptionState;
}): MobileStrategicProfileStatusPill[] {
  if (params.profileAvailability === "auth_gate") {
    return [pill("auth-gate", "Login necessário", "warning")];
  }

  const pills: MobileStrategicProfileStatusPill[] = [];
  if (params.profileAvailability === "construction") {
    pills.push(pill("profile-construction", "Perfil em construção", "construction"));
  } else if (params.diagnosisState === "instagram_optimized") {
    pills.push(pill("diagnosis-instagram", "Leitura mais precisa", "instagram"));
  } else if (params.diagnosisState === "complete") {
    pills.push(pill("diagnosis-complete", "Diagnóstico atualizado", "premium"));
  } else {
    pills.push(pill("first-reading", "Primeira leitura", "active"));
  }

  if (params.subscriptionState === "premium") pills.push(pill("premium", "Premium", "premium"));
  if (params.instagramState === "connected") pills.push(pill("instagram-connected", "Instagram conectado", "instagram"));
  if (params.mediaKitState === "available") pills.push(pill("media-kit", "Mídia Kit ativo", "active"));

  return pills;
}

function buildRecommendedActions(params: {
  input: MobileStrategicProfileStateInput;
  primaryIntent: MobileStrategicProfilePrimaryIntent;
  diagnosisState: MobileStrategicProfileDiagnosisState;
  mediaKitState: MobileStrategicProfileMediaKitState;
  instagramState: MobileStrategicProfileInstagramState;
  subscriptionState: MobileStrategicProfileSubscriptionState;
}): MobileStrategicProfileRecommendedAction[] {
  if (!params.input.isAuthenticated) {
    const label = params.primaryIntent === "analyze_video" ? "Entrar para analisar vídeo" : "Entrar para criar Perfil";
    const description = params.primaryIntent === "analyze_video"
      ? "Entre com Google para analisar seu primeiro vídeo."
      : "Entre com Google para criar seu Perfil Estratégico.";

    return [action({
      id: "login",
      intent: params.primaryIntent === "analyze_video" ? "analyze_video" : "view_profile",
      label,
      description,
      priority: "primary",
    })];
  }

  const actions: MobileStrategicProfileRecommendedAction[] = [];

  if (params.diagnosisState === "empty") {
    actions.push(action({
      id: "analyze-first-video",
      intent: "analyze_video",
      label: "Analisar primeiro vídeo",
      description: "Analise seu primeiro vídeo para começar o Perfil Estratégico.",
      priority: "primary",
    }));
  } else {
    actions.push(action({
      id: "analyze-next-video",
      intent: "analyze_video",
      label: "Analisar vídeo",
      description: "Use outro vídeo para atualizar o diagnóstico vivo do creator.",
      priority: "primary",
    }));
  }

  if (params.instagramState !== "connected") {
    actions.push(action({
      id: "connect-instagram",
      intent: "connect_instagram",
      label: "Conectar Instagram",
      description: params.subscriptionState === "premium"
        ? "Conecte Instagram para aumentar a precisão da leitura em uma etapa futura."
        : "Conecte Instagram para completar o contexto do Perfil.",
      priority: "secondary",
    }));
  }

  if (params.mediaKitState === "available") {
    actions.push(action({
      id: "share-media-kit",
      intent: "share_media_kit",
      label: "Compartilhar Mídia Kit",
      description: "Use o Mídia Kit existente como recurso de compartilhamento.",
      priority: params.diagnosisState === "instagram_optimized" ? "secondary" : "primary",
    }));
  } else if (params.mediaKitState === "connect_instagram_required") {
    actions.push(action({
      id: "prepare-media-kit",
      intent: "connect_instagram",
      label: "Preparar Mídia Kit",
      description: "Conectar Instagram é o próximo passo para ativar o Mídia Kit existente.",
      priority: "secondary",
    }));
  }

  if (params.subscriptionState === "free" && params.diagnosisState !== "empty") {
    actions.push(action({
      id: "upgrade",
      intent: "upgrade",
      label: "Ver diagnóstico completo",
      description: "Desbloqueie uma leitura mais completa do Perfil Estratégico.",
      priority: "secondary",
    }));
  }

  actions.push(action({
    id: "community-future",
    intent: "continue_diagnosis",
    label: "Comunidade",
    description: "Destino existente de navegação futura, sem recriar experiências sociais neste contrato.",
    priority: "secondary",
    disabled: true,
  }));

  return actions;
}

export function sanitizeMobileStrategicProfileText(value: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/viralizar garantido/gi, "crescer com consistência"],
    [/patroc[ií]nio garantido/gi, "oportunidade futura"],
    [/marca garantida/gi, "território possível"],
    [/publi garantida/gi, "possibilidade comercial"],
    [/match real/gi, "indicação futura"],
    [/match comprovado/gi, "fit narrativo"],
    [/resultado garantido/gi, "próximo passo"],
    [/\bviralizar\b/gi, "crescer com consistência"],
    [/\bscore\b/gi, "leitura"],
    [/\bnota\b/gi, "leitura"],
    [/\bpontos\b/gi, "sinais"],
    [/\branking\b/gi, "mapa"],
    [/\bgabarito\b/gi, "direção"],
    [/\bgarantido\b/gi, "possível"],
    [/\bcerteza\b/gi, "leitura"],
    [/\bcomprovado\b/gi, "observado"],
    [/\b18 sinais\b/gi, "sinais do Perfil"],
    [/\b3 narrativas\b/gi, "direções narrativas"],
    [/\bpercentual de perfil\b/gi, "estado do Perfil"],
  ];

  const locallySanitized = replacements.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );

  return sanitizeVideoNarrativeDiagnosisPresentationText(locallySanitized);
}

export function resolveMobileStrategicProfileState(
  input: MobileStrategicProfileStateInput,
): MobileStrategicProfileState {
  const primaryIntent = defaultIntent(input);
  const authState: MobileStrategicProfileAuthState = input.isAuthenticated ? "authenticated" : "anonymous";
  const instagramState = resolveInstagramState(input);
  const mediaKitState = input.isAuthenticated ? resolveMediaKitState(input) : "unavailable";
  const subscriptionState = resolveSubscriptionState(input);
  const diagnosisState = input.isAuthenticated ? resolveDiagnosisState(input) : "empty";
  const profileAvailability: MobileStrategicProfileAvailability = !input.isAuthenticated
    ? "auth_gate"
    : diagnosisState === "empty"
      ? "construction"
      : "active";
  const readinessState = resolveReadinessState({
    input,
    diagnosisState,
    instagramState,
    subscriptionState,
  });
  const summary = !input.isAuthenticated
    ? buildAnonymousSummary(primaryIntent)
    : buildAuthenticatedSummary({
      diagnosisState,
      readinessState,
      subscriptionState,
      instagramState,
      presentation: input.diagnosisPresentation,
    });
  const statusPills = buildStatusPills({
    profileAvailability,
    diagnosisState,
    mediaKitState,
    instagramState,
    subscriptionState,
  });
  const recommendedActions = buildRecommendedActions({
    input,
    primaryIntent,
    diagnosisState,
    mediaKitState,
    instagramState,
    subscriptionState,
  });

  return {
    authState,
    profileAvailability,
    readinessState,
    diagnosisState,
    mediaKitState,
    instagramState,
    subscriptionState,
    primaryIntent,
    displayName: clean(input.userName, "Creator"),
    displayHandle: clean(input.userHandle) || clean(input.instagramUsername) || null,
    userImage: clean(input.userImage) || null,
    statusPills,
    recommendedActions,
    summary: {
      title: sentence(summary.title, 96),
      description: sentence(summary.description, 180),
      helper: summary.helper ? sentence(summary.helper, 180) : null,
    },
    createdAt: clean(input.createdAt) || input.diagnosisPresentation?.createdAt || null,
  };
}
