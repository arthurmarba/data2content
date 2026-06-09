export type LoginIntentCopy = {
  badge: string;
  title: string;
  description: string;
  buttonLabel: string;
  footer: string;
};

export const DEFAULT_LOGIN_INTENT_COPY: LoginIntentCopy = {
  badge: "Bem-vindo de volta",
  title: "Seu mapa está esperando",
  description: "Retome de onde você parou.",
  buttonLabel: "Continuar com Google",
  footer: "",
};

export const STRATEGIC_PROFILE_LOGIN_INTENT_COPY: LoginIntentCopy = {
  badge: "Seu mapa começa aqui",
  title: "Entenda o que seu conteúdo diz sobre você",
  description: "Descubra o que está funcionando, receba ideias prontas para postar e encontre criadores para crescer junto.",
  buttonLabel: "Continuar com Google",
  footer: "Assim que entrar, seu perfil começa a tomar forma.",
};

export const ANALYZE_VIDEO_LOGIN_INTENT_COPY: LoginIntentCopy = {
  badge: "Análise do seu conteúdo",
  title: "Continue sua análise",
  description: "Entre para ver o que este vídeo diz sobre o seu conteúdo.",
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
      badge: "Precificação",
      title: "Precifique com base no seu perfil",
      description: "Seus dados reais fazem o número fazer sentido para você.",
      buttonLabel: "Continuar com Google",
      footer: "Assim que entrar, a calculadora retoma do ponto em que você estava.",
    };
  }

  if (path.includes("/media-kit") || path.includes("/mediakit")) {
    return {
      badge: "Mídia Kit",
      title: "Gere seu mídia kit com dados reais",
      description: "Seus dados de Instagram conectados geram um kit pronto para marcas.",
      buttonLabel: "Continuar com Google",
      footer: "Assim que entrar, o Mídia Kit continua do ponto em que você parou.",
    };
  }

  if (path.includes("/planning") || path.includes("/calendar")) {
    return {
      badge: "Planejamento",
      title: "Continue organizando seus próximos conteúdos",
      description: "Seus próximos conteúdos ficam salvos e ligados ao seu mapa.",
      buttonLabel: "Continuar com Google",
      footer: "Assim que entrar, o planejamento retoma de onde você parou.",
    };
  }

  if (path.includes("/campaigns") || path.includes("/publis") || path.includes("/proposals")) {
    return {
      badge: "Parcerias",
      title: "Gerencie suas parcerias e publis",
      description: "Suas propostas e publis em um só lugar, ligadas ao seu perfil.",
      buttonLabel: "Continuar com Google",
      footer: "Assim que entrar, você retoma de onde parou.",
    };
  }

  if (path.includes("/discover") || path.includes("/community")) {
    return {
      badge: "Comunidade",
      title: "Encontre criadores para crescer junto",
      description: "Criadores que falam sobre temas parecidos com os seus, em um só lugar.",
      buttonLabel: "Continuar com Google",
      footer: "Assim que entrar, os criadores indicados ficam visíveis.",
    };
  }

  return DEFAULT_LOGIN_INTENT_COPY;
}
