export type LoginIntentCopy = {
  badge: string;
  title: string;
  description: string;
  buttonLabel: string;
  footer: string;
};

export const DEFAULT_LOGIN_INTENT_COPY: LoginIntentCopy = {
  badge: "Data2Content",
  title: "Entre na sua conta",
  description: "Continue seu mapa narrativo e seus próximos passos.",
  buttonLabel: "Continuar com Google",
  footer: "Assim que entrar, a D2C retoma de onde você parou.",
};

export const STRATEGIC_PROFILE_LOGIN_INTENT_COPY: LoginIntentCopy = {
  badge: "Data2Content",
  title: "Comece seu mapa narrativo",
  description: "Entre para entender o que seu conteúdo já revela sobre sua narrativa.",
  buttonLabel: "Continuar com Google",
  footer: "Assim que entrar, a D2C começa a mapear seu conteúdo.",
};

export const ANALYZE_VIDEO_LOGIN_INTENT_COPY: LoginIntentCopy = {
  badge: "Análise narrativa",
  title: "Continue sua análise",
  description: "Entre para conectar a leitura do conteúdo ao seu mapa narrativo.",
  buttonLabel: "Continuar com Google",
  footer: "Assim que entrar, a leitura continua de onde parou.",
};

function normalizeCallbackUrl(rawCallbackUrl: string): URL | null {
  const trimmed = rawCallbackUrl.trim();
  if (!trimmed) return null;

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed);
    }

    if (trimmed.startsWith("/")) {
      return new URL(trimmed, "https://data2content.local");
    }

    return null;
  } catch {
    return null;
  }
}

function resolveExplicitIntent(rawIntent: string | null | undefined): LoginIntentCopy | null {
  const intent = rawIntent?.trim().toLowerCase() ?? "";

  if (intent === "analyze_video") {
    return ANALYZE_VIDEO_LOGIN_INTENT_COPY;
  }

  if (intent === "strategic_profile") {
    return STRATEGIC_PROFILE_LOGIN_INTENT_COPY;
  }

  return null;
}

export function resolveIntentCopy(
  rawCallbackUrl: string | null,
  rawIntent?: string | null
): LoginIntentCopy {
  const explicitIntentCopy = resolveExplicitIntent(rawIntent);
  if (explicitIntentCopy) {
    return explicitIntentCopy;
  }

  if (!rawCallbackUrl) {
    return DEFAULT_LOGIN_INTENT_COPY;
  }

  const normalizedUrl = normalizeCallbackUrl(rawCallbackUrl);
  if (!normalizedUrl) {
    return DEFAULT_LOGIN_INTENT_COPY;
  }

  const path = normalizedUrl.pathname.toLowerCase();
  const intent = normalizedUrl.searchParams.get("intent")?.trim().toLowerCase() ?? "";

  const callbackIntentCopy = resolveExplicitIntent(intent);
  if (callbackIntentCopy) {
    return callbackIntentCopy;
  }

  if (
    path.includes("/video-narrative") ||
    path.includes("/analyze-video") ||
    path.includes("/analisar-video")
  ) {
    return ANALYZE_VIDEO_LOGIN_INTENT_COPY;
  }

  if (
    path.includes("/dashboard/boards/mobile-strategic-profile-preview") ||
    path.includes("/dashboard/boards/mobile-strategic-profile") ||
    path.includes("/strategic-profile") ||
    path.includes("/mobile-profile") ||
    path.includes("/profile")
  ) {
    return STRATEGIC_PROFILE_LOGIN_INTENT_COPY;
  }

  if (path.includes("/calculator")) {
    return {
      badge: "Calculadora Pro",
      title: "Entre para continuar na calculadora",
      description:
        "Use sua conta Google para retomar a precificação e seguir para a assinatura do Plano Pro quando necessário.",
      buttonLabel: "Entrar e continuar",
      footer: "Assim que entrar, a calculadora retoma do ponto em que você estava.",
    };
  }

  if (path.includes("/media-kit") || path.includes("/mediakit")) {
    return {
      badge: "Mídia Kit",
      title: "Entre para continuar no Mídia Kit",
      description:
        "A conta Google guarda seu progresso e permite seguir para a assinatura e conexão do Instagram no momento certo.",
      buttonLabel: "Entrar e continuar",
      footer: "Assim que entrar, o Mídia Kit continua do ponto em que você parou.",
    };
  }

  if (path.includes("/planning") || path.includes("/calendar")) {
    return {
      badge: "Planejamento",
      title: "Entre para continuar no board",
      description:
        "Faça login com Google para acessar seu board, salvar progresso e continuar o fluxo de assinatura quando a funcionalidade for premium.",
      buttonLabel: "Entrar e continuar",
      footer: "Assim que entrar, o board retoma a etapa certa.",
    };
  }

  if (path.includes("/campaigns") || path.includes("/publis") || path.includes("/proposals")) {
    return {
      badge: "Campanhas e CRM",
      title: "Entre para continuar nas campanhas",
      description:
        "Sua conta Google é necessária para gerenciar CRM, publis e negociações, com assinatura ativada quando o recurso exigir acesso Pro.",
      buttonLabel: "Entrar e continuar",
      footer: "Assim que entrar, você retoma de onde parou.",
    };
  }

  if (path.includes("/discover") || path.includes("/community")) {
    return {
      badge: "Comunidade",
      title: "Entre para continuar na comunidade",
      description:
        "Faça login com Google para acessar a comunidade e seguir para a mentoria ou para os próximos passos de ativação quando necessário.",
      buttonLabel: "Entrar e continuar",
      footer: "Assim que entrar, a comunidade e suas sessões ficam acessíveis.",
    };
  }

  return DEFAULT_LOGIN_INTENT_COPY;
}
