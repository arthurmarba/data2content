import type {
  PostCreationAdaptiveMode,
  PostCreationStrategicPlan,
} from "./postCreationAdaptiveTypes";

export type PostCreationAdaptivePlanPresentation = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryValue: string | null;
  promptContext: string | null;
  summary: string | null;
  sectionTitles: {
    why: string;
    execution: string;
    hookCta: string;
    scenes: string;
    opportunities: string;
    nextActions: string;
  };
};

type BuildPostCreationAdaptivePlanPresentationParams = {
  plan: PostCreationStrategicPlan | null;
  mode?: PostCreationAdaptiveMode | null;
  originalPrompt?: string | null;
};

function cleanText(value?: string | null): string | null {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return normalized || null;
}

function buildDefaultSummary(plan: PostCreationStrategicPlan | null): string | null {
  const objective = cleanText(plan?.objective);
  const narrative = cleanText(plan?.narrative);

  if (objective && narrative) return `Objetivo: ${objective}. Narrativa: ${narrative}.`;
  if (objective) return `Objetivo: ${objective}.`;
  if (narrative) return `Narrativa: ${narrative}.`;
  return null;
}

function defaultPresentation(plan: PostCreationStrategicPlan | null): PostCreationAdaptivePlanPresentation {
  return {
    eyebrow: "Plano estratégico",
    title: "Sua pauta está pronta para virar conteúdo",
    subtitle: "Refinei a ideia em uma direção prática para gravar, testar e evoluir.",
    primaryLabel: "Pauta",
    primaryValue: cleanText(plan?.pauta),
    promptContext: null,
    summary: buildDefaultSummary(plan),
    sectionTitles: {
      why: "Por que essa narrativa funciona",
      execution: "Como gravar",
      hookCta: "Gancho e CTA",
      scenes: "Cenas ou pilares",
      opportunities: "Oportunidades",
      nextActions: "Próximas ações",
    },
  };
}

function promptContextFor(originalPrompt?: string | null): string | null {
  const prompt = cleanText(originalPrompt);
  return prompt ? `A partir da sua pergunta: "${prompt}"` : null;
}

export function buildPostCreationAdaptivePlanPresentation({
  plan,
  mode,
  originalPrompt,
}: BuildPostCreationAdaptivePlanPresentationParams): PostCreationAdaptivePlanPresentation {
  if (!mode) return defaultPresentation(plan);

  const base = defaultPresentation(plan);
  const promptContext = promptContextFor(originalPrompt);

  if (mode === "format_guidance") {
    return {
      ...base,
      eyebrow: "Resposta da D2C",
      title: "Formato recomendado",
      subtitle: "Pelos sinais analisados, esse é o formato com melhor encaixe para a sua intenção.",
      primaryLabel: "Formato",
      primaryValue: cleanText(plan?.format),
      promptContext,
      summary: buildDefaultSummary(plan),
      sectionTitles: {
        ...base.sectionTitles,
        why: "Por que esse formato faz sentido",
        execution: "Como executar",
      },
    };
  }

  const modePresentation: Record<PostCreationAdaptiveMode, Pick<PostCreationAdaptivePlanPresentation, "title" | "subtitle" | "primaryLabel">> = {
    validate_pauta: {
      title: "Pauta refinada",
      subtitle: "Validei a ideia original e organizei uma direção mais forte para executar.",
      primaryLabel: "Pauta",
    },
    discover_pauta: {
      title: "Pauta recomendada",
      subtitle: "Transformei a tela em branco em uma direção prática para começar.",
      primaryLabel: "Pauta",
    },
    create_by_goal: {
      title: "Estratégia recomendada",
      subtitle: "Transformei o objetivo em uma direção de conteúdo acionável.",
      primaryLabel: "Estratégia",
    },
    format_guidance: {
      title: "Formato recomendado",
      subtitle: "Pelos sinais analisados, esse é o formato com melhor encaixe para a sua intenção.",
      primaryLabel: "Formato",
    },
    brand_match: {
      title: "Match de marca recomendado",
      subtitle: "Organizei um encaixe comercial orgânico para a narrativa.",
      primaryLabel: "Marca",
    },
    collab_match: {
      title: "Collab recomendada",
      subtitle: "Defini uma direção de parceria com dinâmica e papel claro.",
      primaryLabel: "Collab",
    },
    comment_to_post: {
      title: "Comentário transformado em pauta",
      subtitle: "Transformei a resposta da audiência em um caminho de conteúdo.",
      primaryLabel: "Pauta",
    },
    weekly_plan: {
      title: "Direção semanal recomendada",
      subtitle: "Organizei cadência e intenção para a semana de conteúdo.",
      primaryLabel: "Direção",
    },
    unknown: {
      title: "Primeira direção estratégica",
      subtitle: "Organizei um ponto de partida seguro para evoluir a criação.",
      primaryLabel: "Direção",
    },
  };

  const modeCopy = modePresentation[mode];
  const primaryValueByMode: Partial<Record<PostCreationAdaptiveMode, string | null>> = {
    format_guidance: cleanText(plan?.format),
    brand_match: cleanText(plan?.brandMatch?.category) || cleanText(plan?.pauta),
    collab_match: cleanText(plan?.collabMatch?.creatorProfile) || cleanText(plan?.pauta),
  };

  return {
    ...base,
    eyebrow: "Resposta da D2C",
    title: modeCopy.title,
    subtitle: modeCopy.subtitle,
    primaryLabel: modeCopy.primaryLabel,
    primaryValue: primaryValueByMode[mode] ?? cleanText(plan?.pauta),
    promptContext,
  };
}
