export type LoginIntentCopy = {
  badge: string;
  title: string;
  description: string;
  buttonLabel: string;
  footer: string;
};

export const DEFAULT_LOGIN_INTENT_COPY: LoginIntentCopy = {
  badge: "Entrar com Google",
  title: "Continue na plataforma",
  description:
    "Entre com sua conta Google para acessar seus boards, salvar progresso e continuar sua jornada na Data2Content.",
  buttonLabel: "Continuar com Google",
  footer: "Sua conta conecta ferramentas, histórico e próximos passos em um só lugar.",
};

export const STRATEGIC_PROFILE_LOGIN_INTENT_COPY: LoginIntentCopy = {
  badge: "Perfil Estratégico",
  title: "Crie seu Perfil Estratégico",
  description: "Entre com Google para começar seu diagnóstico como creator.",
  buttonLabel: "Entrar com Google",
  footer: "Depois do login, você volta para o Perfil e pode analisar seu primeiro vídeo.",
};

export const ANALYZE_VIDEO_LOGIN_INTENT_COPY: LoginIntentCopy = {
  badge: "Análise narrativa",
  title: "Entre para analisar seu primeiro vídeo",
  description: "Use sua conta Google para salvar essa primeira leitura no seu Perfil Estratégico.",
  buttonLabel: "Entrar e analisar vídeo",
  footer: "A análise atualiza seu Perfil. Ela não cria uma galeria pública de vídeos.",
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

export function resolveIntentCopy(rawCallbackUrl: string | null): LoginIntentCopy {
  if (!rawCallbackUrl) {
    return DEFAULT_LOGIN_INTENT_COPY;
  }

  const normalizedUrl = normalizeCallbackUrl(rawCallbackUrl);
  if (!normalizedUrl) {
    return DEFAULT_LOGIN_INTENT_COPY;
  }

  const path = normalizedUrl.pathname.toLowerCase();
  const intent = normalizedUrl.searchParams.get("intent")?.trim().toLowerCase() ?? "";

  if (intent === "analyze_video") {
    return ANALYZE_VIDEO_LOGIN_INTENT_COPY;
  }

  if (intent === "strategic_profile") {
    return STRATEGIC_PROFILE_LOGIN_INTENT_COPY;
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
      footer: "Depois do login, você volta para a calculadora sem perder a intenção original.",
    };
  }

  if (path.includes("/media-kit") || path.includes("/mediakit")) {
    return {
      badge: "Mídia Kit",
      title: "Entre para continuar no Mídia Kit",
      description:
        "A conta Google guarda seu progresso e permite seguir para a assinatura e conexão do Instagram no momento certo.",
      buttonLabel: "Entrar e continuar",
      footer: "Seu retorno continua do ponto em que você parou.",
    };
  }

  if (path.includes("/planning") || path.includes("/calendar")) {
    return {
      badge: "Planejamento",
      title: "Entre para continuar no board",
      description:
        "Faça login com Google para acessar seu board, salvar progresso e continuar o fluxo de assinatura quando a funcionalidade for premium.",
      buttonLabel: "Entrar e continuar",
      footer: "Depois do login, a plataforma retoma a etapa correta para liberar o recurso.",
    };
  }

  if (path.includes("/campaigns") || path.includes("/publis") || path.includes("/proposals")) {
    return {
      badge: "Campanhas e CRM",
      title: "Entre para continuar nas campanhas",
      description:
        "Sua conta Google é necessária para gerenciar CRM, publis e negociações, com assinatura ativada quando o recurso exigir acesso Pro.",
      buttonLabel: "Entrar e continuar",
      footer: "Login primeiro, assinatura quando necessário, sempre no mesmo fluxo.",
    };
  }

  if (path.includes("/discover") || path.includes("/community")) {
    return {
      badge: "Comunidade",
      title: "Entre para continuar na comunidade",
      description:
        "Faça login com Google para acessar a comunidade e seguir para a mentoria ou para os próximos passos de ativação quando necessário.",
      buttonLabel: "Entrar e continuar",
      footer: "Sessões gratuitas e premium seguem a partir desta mesma conta.",
    };
  }

  return DEFAULT_LOGIN_INTENT_COPY;
}
