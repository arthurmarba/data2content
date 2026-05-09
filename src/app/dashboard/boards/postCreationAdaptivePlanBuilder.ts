import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
  PostCreationAdaptiveQuestionOption,
  PostCreationAdaptiveScene,
  PostCreationFiveW2HPlan,
  PostCreationStrategicPlan,
} from "./postCreationAdaptiveTypes";

type AnswerSelection = {
  answer: PostCreationAdaptiveAnswer;
  question: PostCreationAdaptiveQuestion;
  option: PostCreationAdaptiveQuestionOption | null;
  label: string;
};

type AnswerMap = Partial<Record<PostCreationAdaptiveQuestionMapKey, AnswerSelection>>;

const DEFAULT_OBJECTIVE = "Gerar comentarios e identificacao";
const DEFAULT_FORMAT = "Reels simples";
const DEFAULT_NARRATIVE = "Rotina real com virada pratica";
const DEFAULT_HOOK = "Abrir com uma situacao reconhecivel";
const DEFAULT_CTA = "Perguntar se mais alguem passa por isso";

function cleanText(value?: string | null): string | null {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : null;
}

function nonEmpty(value: string | null | undefined, fallback: string): string {
  return cleanText(value) || fallback;
}

function valueToLabel(value: PostCreationAdaptiveAnswer["value"]): string | null {
  if (Array.isArray(value)) return cleanText(value.join(", "));
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  return cleanText(value);
}

function getSelectedOption(
  question: PostCreationAdaptiveQuestion,
  answer: PostCreationAdaptiveAnswer
): PostCreationAdaptiveQuestionOption | null {
  if (answer.optionId) {
    const byOptionId = question.options.find((option) => option.id === answer.optionId);
    if (byOptionId) return byOptionId;
  }

  const answerValue = valueToLabel(answer.value);
  if (!answerValue) return null;
  return (
    question.options.find((option) => option.id === answerValue || option.label === answerValue) || null
  );
}

function buildAnswerMap(
  questions: PostCreationAdaptiveQuestion[],
  answers: PostCreationAdaptiveAnswer[]
): AnswerMap {
  const byQuestionId = new Map(questions.map((question) => [question.id, question]));
  const result: AnswerMap = {};

  for (const answer of answers) {
    const question = byQuestionId.get(answer.questionId) || questions.find((item) => item.mapKey === answer.key);
    if (!question) continue;
    const option = getSelectedOption(question, answer);
    const label = cleanText(option?.label) || valueToLabel(answer.value);
    if (!label) continue;
    result[question.mapKey] = {
      answer,
      question,
      option,
      label,
    };
  }

  return result;
}

function getAnswerByMapKey(
  answerMap: AnswerMap,
  key: PostCreationAdaptiveQuestionMapKey
): AnswerSelection | null {
  return answerMap[key] || null;
}

function optionLabelOrFallback(
  answerMap: AnswerMap,
  key: PostCreationAdaptiveQuestionMapKey,
  fallback: string
): string {
  return nonEmpty(getAnswerByMapKey(answerMap, key)?.label, fallback);
}

function buildPautaForMode(
  mode: PostCreationAdaptiveMode,
  detection: PostCreationAdaptiveIntentDetection,
  answerMap: AnswerMap
): string {
  if (detection.detectedPauta) return detection.detectedPauta;

  const objective = optionLabelOrFallback(answerMap, "objective", detection.objective || DEFAULT_OBJECTIVE);
  const narrative = optionLabelOrFallback(answerMap, "narrative", DEFAULT_NARRATIVE);
  const format = optionLabelOrFallback(answerMap, "format", DEFAULT_FORMAT);
  const brand = optionLabelOrFallback(answerMap, "brand", detection.brandCategory || "marca alinhada a rotina");
  const collab = optionLabelOrFallback(answerMap, "collab", "collab com creator complementar");
  const comment = detection.sourceComment || optionLabelOrFallback(answerMap, "why", "comentario da audiencia");

  if (mode === "discover_pauta") {
    return `Pauta em ${format.toLowerCase()} para ${objective.toLowerCase()} usando ${narrative.toLowerCase()}`;
  }
  if (mode === "create_by_goal") {
    return `Conteudo criado para ${objective.toLowerCase()} com narrativa de ${narrative.toLowerCase()}`;
  }
  if (mode === "brand_match") {
    return `Pauta com encaixe organico para ${brand.toLowerCase()}`;
  }
  if (mode === "collab_match") {
    return `Collab em formato de ${collab.toLowerCase()}`;
  }
  if (mode === "comment_to_post") {
    return `Resposta em post para: ${comment}`;
  }
  if (mode === "weekly_plan") {
    return `Direcao semanal para ${objective.toLowerCase()}`;
  }
  if (mode === "unknown") {
    return `Primeiro plano de conteudo para ${objective.toLowerCase()}`;
  }

  return `Pauta refinada para ${objective.toLowerCase()}`;
}

function buildDefaultFiveW2H(params: {
  mode: PostCreationAdaptiveMode;
  pauta: string;
  objective: string;
  narrative: string;
  format: string;
  hook: string;
  cta: string;
  answerMap: AnswerMap;
  detection: PostCreationAdaptiveIntentDetection;
}): PostCreationFiveW2HPlan {
  const effort = optionLabelOrFallback(params.answerMap, "effort", "Medio");
  const schedule = optionLabelOrFallback(params.answerMap, "schedule", "3 conteudos");
  const how = optionLabelOrFallback(params.answerMap, "how", params.narrative);
  const whyAnswer = optionLabelOrFallback(params.answerMap, "why", params.objective);
  const who = optionLabelOrFallback(params.answerMap, "who", "Voce como personagem principal e a audiencia como espelho");

  if (params.mode === "weekly_plan") {
    return {
      who: "Voce e os principais interesses da audiencia da semana",
      what: params.pauta,
      where: "No feed e nos stories, distribuindo formatos ao longo da semana",
      when: `Cadencia escolhida: ${schedule}`,
      why: `Organizar a semana para ${params.objective.toLowerCase()} com consistencia`,
      how: `Misturar ${params.format.toLowerCase()} com ${params.narrative.toLowerCase()}`,
      howMuch: `Esforco estimado: ${effort}`,
    };
  }

  if (params.mode === "brand_match") {
    const brand = params.detection.brandCategory || optionLabelOrFallback(params.answerMap, "brand", "marca");
    return {
      who: "Voce em uma situacao real onde a marca aparece naturalmente",
      what: params.pauta,
      where: "Em uma cena de rotina com contexto visivel de uso",
      when: "Quando a cena puder ser gravada sem parecer demonstracao artificial",
      why: `O encaixe com ${brand} fica mais forte porque resolve ${whyAnswer.toLowerCase()}`,
      how,
      howMuch: `Esforco estimado: ${effort}`,
    };
  }

  if (params.mode === "collab_match") {
    return {
      who,
      what: params.pauta,
      where: "Em uma conversa, dueto ou cena dividida entre os creators",
      when: "Quando os dois pontos de vista puderem ser publicados na mesma janela",
      why: `A collab aumenta valor porque transforma ${whyAnswer.toLowerCase()} em troca visivel`,
      how,
      howMuch: `Esforco estimado: ${effort}`,
    };
  }

  if (params.mode === "comment_to_post") {
    return {
      who: "Voce respondendo a uma pessoa da audiencia",
      what: params.pauta,
      where: "Na tela de resposta, olhando para camera ou usando print do comentario",
      when: "Enquanto o comentario ainda esta fresco para a audiencia",
      why: `O comentario revela ${whyAnswer.toLowerCase()} e pode puxar novas respostas`,
      how,
      howMuch: `Esforco estimado: ${effort}`,
    };
  }

  return {
    who,
    what: params.pauta,
    where: "Em uma cena simples de rotina, com contexto facil de reconhecer",
    when: optionLabelOrFallback(params.answerMap, "when", "Na proxima janela viavel de postagem"),
    why: `Essa pauta faz sentido para ${params.objective.toLowerCase()}`,
    how: `${how}. Abrir com ${params.hook.toLowerCase()} e fechar com ${params.cta.toLowerCase()}`,
    howMuch: `Esforco estimado: ${effort}`,
  };
}

function scene(
  id: string,
  title: string,
  visual: string,
  message: string,
  direction?: string
): PostCreationAdaptiveScene {
  return {
    id,
    title,
    visual,
    message,
    direction: direction || null,
  };
}

function buildScenesForMode(params: {
  mode: PostCreationAdaptiveMode;
  pauta: string;
  objective: string;
  narrative: string;
  format: string;
  hook: string;
  cta: string;
  answerMap: AnswerMap;
  detection: PostCreationAdaptiveIntentDetection;
}): PostCreationAdaptiveScene[] {
  if (params.mode === "weekly_plan") {
    const schedule = optionLabelOrFallback(params.answerMap, "schedule", "3 conteudos");
    return [
      scene("pillar-1", "Pilar de alcance", "Reels simples com gancho forte", `Abrir a semana com ${params.narrative.toLowerCase()}.`),
      scene("pillar-2", "Pilar de conversa", "Stories ou post de resposta", `Puxar comentarios ligados a ${params.objective.toLowerCase()}.`),
      scene("pillar-3", "Pilar de profundidade", "Carrossel ou roteiro mais explicativo", "Transformar o melhor insight em conteudo salvavel."),
      scene("pillar-4", "Cadencia", "Calendario editorial", `Distribuir ${schedule.toLowerCase()} sem concentrar tudo no mesmo dia.`),
    ];
  }

  if (params.mode === "collab_match") {
    return [
      scene("scene-1", "Abertura dos dois pontos de vista", "Tela dividida, dueto ou chamada conjunta", params.hook),
      scene("scene-2", "Contraste ou troca", "Cada creator mostra sua leitura", `Mostrar por que a collab melhora ${params.pauta.toLowerCase()}.`),
      scene("scene-3", "Resolucao conjunta", "Os dois chegam a uma dica, cena ou conclusao", `Amarrar com ${params.narrative.toLowerCase()}.`),
      scene("scene-4", "CTA de continuidade", "Fechar com pergunta para as duas audiencias", params.cta),
    ];
  }

  if (params.mode === "comment_to_post") {
    const comment = params.detection.sourceComment || params.pauta;
    return [
      scene("scene-1", "Comentario na tela", "Print ou leitura do comentario", `Mostrar o comentario: ${comment}.`),
      scene("scene-2", "Dor por tras da pergunta", "Voce olhando para camera", `Explicar o que esse comentario revela sobre ${params.objective.toLowerCase()}.`),
      scene("scene-3", "Resposta pratica", "Exemplo, criterio ou passo simples", `Responder usando ${params.narrative.toLowerCase()}.`),
      scene("scene-4", "Continuidade", "Voltar para camera com pergunta final", params.cta),
    ];
  }

  return [
    scene("scene-1", "Gancho", "Close ou primeira tela com contexto claro", params.hook),
    scene("scene-2", "Contexto", "Mostrar a situacao real por tras da pauta", params.pauta),
    scene("scene-3", "Virada", "Trazer criterio, reacao ou exemplo", `Conduzir em formato de ${params.narrative.toLowerCase()}.`),
    scene("scene-4", "CTA", "Fechar olhando para camera ou com texto na tela", params.cta),
  ];
}

function buildBrandMatchForMode(params: {
  mode: PostCreationAdaptiveMode;
  answerMap: AnswerMap;
  detection: PostCreationAdaptiveIntentDetection;
}) {
  if (params.mode !== "brand_match") return null;
  const category = params.detection.brandCategory || optionLabelOrFallback(params.answerMap, "brand", "marca alinhada a rotina");
  const angle = optionLabelOrFallback(params.answerMap, "how", "Solução natural da cena");
  const why = optionLabelOrFallback(params.answerMap, "why", "Match organico");

  return {
    enabled: true,
    category,
    angle,
    desiredBrandSignals: [category, angle, why].filter(Boolean),
  };
}

function buildCollabMatchForMode(params: {
  mode: PostCreationAdaptiveMode;
  answerMap: AnswerMap;
}) {
  if (params.mode !== "collab_match") return null;
  return {
    enabled: true,
    creatorProfile: optionLabelOrFallback(params.answerMap, "who", "Creator de nicho complementar"),
    collaborationAngle: optionLabelOrFallback(params.answerMap, "collab", "Reacao ou debate"),
  };
}

function buildNextActionsForMode(mode: PostCreationAdaptiveMode): string[] {
  if (mode === "brand_match") return ["see_brands", "generate_script", "save_to_calendar"];
  if (mode === "collab_match") return ["see_collabs", "generate_script", "save_to_calendar"];
  if (mode === "weekly_plan") return ["save_to_calendar", "create_variation"];
  if (mode === "create_by_goal") return ["generate_script", "save_to_calendar"];
  if (mode === "unknown") return ["create_variation"];
  return ["generate_script", "save_to_calendar", "create_variation"];
}

export function buildPostCreationStrategicPlan(params: {
  detection: PostCreationAdaptiveIntentDetection;
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
}): PostCreationStrategicPlan {
  const answerMap = buildAnswerMap(params.questions, params.answers);
  const mode = params.detection.mode;
  const objective = optionLabelOrFallback(answerMap, "objective", params.detection.objective || DEFAULT_OBJECTIVE);
  const narrative = optionLabelOrFallback(answerMap, "narrative", DEFAULT_NARRATIVE);
  const format = optionLabelOrFallback(answerMap, "format", DEFAULT_FORMAT);
  const hook = optionLabelOrFallback(answerMap, "hook", DEFAULT_HOOK);
  const cta = optionLabelOrFallback(answerMap, "cta", DEFAULT_CTA);
  const pauta = buildPautaForMode(mode, params.detection, answerMap);
  const fiveW2H = buildDefaultFiveW2H({
    mode,
    pauta,
    objective,
    narrative,
    format,
    hook,
    cta,
    answerMap,
    detection: params.detection,
  });
  const scenes = buildScenesForMode({
    mode,
    pauta,
    objective,
    narrative,
    format,
    hook,
    cta,
    answerMap,
    detection: params.detection,
  });

  return {
    pauta: nonEmpty(pauta, "Pauta adaptativa para proximo post"),
    objective: nonEmpty(objective, DEFAULT_OBJECTIVE),
    narrative: nonEmpty(narrative, DEFAULT_NARRATIVE),
    format: nonEmpty(format, DEFAULT_FORMAT),
    hook: nonEmpty(hook, DEFAULT_HOOK),
    cta: nonEmpty(cta, DEFAULT_CTA),
    fiveW2H: {
      who: nonEmpty(fiveW2H.who, "Voce e sua audiencia principal"),
      what: nonEmpty(fiveW2H.what, pauta),
      where: nonEmpty(fiveW2H.where, "Cena simples de rotina"),
      when: nonEmpty(fiveW2H.when, "Proxima janela viavel"),
      why: nonEmpty(fiveW2H.why, objective),
      how: nonEmpty(fiveW2H.how, narrative),
      howMuch: nonEmpty(fiveW2H.howMuch, "Esforco medio"),
    },
    scenes: scenes.slice(0, 5),
    brandMatch: buildBrandMatchForMode({ mode, answerMap, detection: params.detection }),
    collabMatch: buildCollabMatchForMode({ mode, answerMap }),
    nextActions: buildNextActionsForMode(mode),
  };
}
