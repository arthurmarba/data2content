import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveAnswerEvaluation,
  PostCreationAdaptiveAnswerKeyResult,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
} from "./postCreationAdaptiveTypes";

export function buildPostCreationAdaptiveAnswerKey(params: {
  detection: PostCreationAdaptiveIntentDetection;
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
}): PostCreationAdaptiveAnswerKeyResult {
  const { detection, questions, answers } = params;
  const mode = detection.mode;

  const evaluations: PostCreationAdaptiveAnswerEvaluation[] = questions.map((question) => {
    const answer = answers.find((a) => a.questionId === question.id);
    const selectedOptionId = answer?.optionId || null;
    const selectedOption = question.options.find((o) => o.id === selectedOptionId);

    const recommendedOption = question.options.find((o) => o.recommended);
    const recommendedOptionId = recommendedOption?.id || null;

    const isRecommendedChoice = Boolean(selectedOptionId && selectedOptionId === recommendedOptionId);

    let reason = "";
    if (!selectedOptionId) {
      reason = "Este ponto ainda precisa de uma escolha para consolidar a estratégia.";
    } else if (isRecommendedChoice) {
      reason = selectedOption?.reason || "Essa escolha fortalece a coerência da pauta.";
    } else {
      reason = recommendedOption?.reason || "Ajustar esse ponto pode trazer mais clareza para a intenção do post.";
    }

    return {
      questionId: question.id,
      key: question.mapKey,
      selectedOptionId,
      selectedLabel: selectedOption?.label || null,
      recommendedOptionId,
      recommendedLabel: recommendedOption?.label || null,
      isRecommendedChoice,
      reason,
    };
  });

  const totalQuestions = questions.length;
  const answeredQuestions = evaluations.filter((e) => e.selectedOptionId !== null).length;
  const recommendedMatches = evaluations.filter((e) => e.isRecommendedChoice).length;

  const strengths = evaluations
    .filter((e) => e.isRecommendedChoice && e.selectedLabel)
    .map((e) => `Ponto forte: ${e.selectedLabel}.`);

  const adjustments = evaluations
    .filter((e) => !e.isRecommendedChoice)
    .map((e) => {
      if (!e.selectedOptionId) {
        return `Ponto pendente: ${e.key}.`;
      }
      return `Sugestão de ajuste: considerar ${e.recommendedLabel} para maior coerência.`;
    });

  let summary = "";
  if (answeredQuestions === 0) {
    summary = "Ainda faltam escolhas para consolidar uma recomendação estratégica.";
  } else if (recommendedMatches === totalQuestions) {
    summary = "Sua leitura está bem alinhada com o caminho sugerido para essa intenção.";
  } else if (recommendedMatches >= totalQuestions / 2) {
    summary = "Sua leitura tem bons sinais, mas alguns pontos pedem ajuste para deixar a pauta mais coerente.";
  } else {
    summary = "A pauta pode ganhar mais força com alguns ajustes na direção estratégica.";
  }

  return {
    mode,
    totalQuestions,
    answeredQuestions,
    recommendedMatches,
    evaluations,
    strengths,
    adjustments,
    summary,
  };
}
