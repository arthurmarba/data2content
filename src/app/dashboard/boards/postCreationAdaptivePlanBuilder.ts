import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveAnswerKeyResult,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
  PostCreationStrategicPlan,
  PostCreationFiveW2HPlan,
  PostCreationAdaptiveScene,
} from "./postCreationAdaptiveTypes";
import { compactPromptSnippet } from "./postCreationAdaptiveQuizBuilder";

export function buildPostCreationAdaptiveStrategicPlan(params: {
  detection: PostCreationAdaptiveIntentDetection;
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
  answerKey: PostCreationAdaptiveAnswerKeyResult;
}): PostCreationStrategicPlan {
  const { detection, questions, answers, answerKey } = params;

  const getAnswerLabel = (key: PostCreationAdaptiveQuestionMapKey): string | null => {
    const answer = answers.find((a) => a.key === key);
    if (!answer?.optionId) return null;
    const question = questions.find((q) => q.mapKey === key);
    const option = question?.options.find((o) => o.id === answer.optionId);
    return option?.label || null;
  };

  const getAnswerOptionId = (key: PostCreationAdaptiveQuestionMapKey): string | null => {
    const answer = answers.find((a) => a.key === key);
    return answer?.optionId || null;
  };

  const pauta = compactPromptSnippet(
    detection.detectedPauta || detection.sourceComment || detection.originalInput,
    100
  );

  const sanitizeText = (text: string | null): string | null => {
    if (!text) return null;
    return text.replace(/\b(garantido|comprovado|certeza|sempre performa|acerto|erro|nota|pontuação|venceu|perdeu)\b/gi, "direção");
  };

  const sanitizedPauta = sanitizeText(pauta);

  const objective = getAnswerLabel("objective");
  const narrative = getAnswerLabel("narrative");
  const format = getAnswerLabel("format");
  const hook = getAnswerLabel("hook");
  const cta = getAnswerLabel("cta");
  const effort = getAnswerLabel("effort");
  const collabOptionId = getAnswerOptionId("collab");
  const collabAnswerLabel = getAnswerLabel("collab");
  const hasExplicitCollabSignal =
    detection.mode === "collab_match" ||
    detection.signals.some((signal) => /\b(collab|colab|colaboracao|conteudo junto|criador parceiro|parceria)\b/.test(signal)) ||
    /\b(collab|colab|colaboracao|conteudo junto|criador parceiro|parceria)\b/.test(detection.normalizedInput);

  const fiveW2H: PostCreationFiveW2HPlan = {
    who: "Sua audiência no Instagram",
    what: sanitizedPauta,
    where: "Instagram",
    when: "Próxima janela de publicação",
    why: sanitizeText(answerKey.summary) || "",
    how: `${format || "Formato a definir"} com narrativa de ${narrative || "estilo próprio"}.`,
    howMuch: effort || "Esforço estratégico equilibrado",
  };

  const scenes: PostCreationAdaptiveScene[] = [
    {
      id: "scene-1",
      title: "Gancho Visual",
      visual: "Cena de impacto inicial.",
      message: hook || "Início direto ao ponto para prender a atenção.",
    },
    {
      id: "scene-2",
      title: "Desenvolvimento",
      visual: "Desenvolvimento da ideia central.",
      message: narrative || "Exploração do território narrativo escolhido.",
    },
    {
      id: "scene-3",
      title: "Fechamento e Convite",
      visual: "Finalização com clareza.",
      message: cta || "Convite para a audiência interagir.",
    },
  ];

  const brandMatch = {
    enabled: detection.mode === "brand_match" || Boolean(getAnswerLabel("brand")),
    category: detection.brandCategory || getAnswerLabel("brand"),
    angle: getAnswerLabel("how"),
  };

  const collabMatch = {
    enabled:
      detection.mode === "collab_match" ||
      (hasExplicitCollabSignal && collabOptionId === "collab"),
    creatorProfile: getAnswerLabel("who") || collabAnswerLabel,
    collaborationAngle: getAnswerLabel("why"),
  };

  const nextActions: string[] = [
    "Revisar o roteiro com base nas cenas sugeridas.",
    "Preparar os elementos visuais para o formato escolhido.",
    "Observar a resposta da audiência para validar o caminho.",
  ];

  if (detection.mode === "unknown") {
    nextActions.unshift("Refinar a ideia central para ganhar mais clareza.");
  }

  if (brandMatch.enabled) {
    nextActions.push("Verificar se o encaixe da marca parece orgânico na cena.");
  }

  if (collabMatch.enabled) {
    nextActions.push("Alinhar a dinâmica de troca com o parceiro de collab.");
  }

  return {
    pauta: sanitizedPauta,
    objective,
    narrative,
    format,
    hook,
    cta,
    fiveW2H,
    scenes,
    brandMatch: brandMatch.enabled ? brandMatch : null,
    collabMatch: collabMatch.enabled ? collabMatch : null,
    nextActions,
  };
}
