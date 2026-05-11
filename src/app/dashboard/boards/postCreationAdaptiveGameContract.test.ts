import type {
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionOption,
} from "./postCreationAdaptiveTypes";
import {
  buildPostCreationAdaptiveGameContract,
  buildPostCreationAdaptiveGameQuestionContract,
  type PostCreationAdaptiveGameQuestionAnswerKeyInput,
} from "./postCreationAdaptiveGameContract";
import {
  buildPostCreationAdaptiveAnswerKey,
  evaluatePostCreationAdaptiveAnswers,
} from "./postCreationAdaptiveAnswerKey";
import { buildPostCreationLegacyHandoff } from "./postCreationAdaptiveLegacyAdapter";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";

function option(
  id: string,
  label: string,
  reason: string,
  extra: Partial<PostCreationAdaptiveQuestionOption> = {},
): PostCreationAdaptiveQuestionOption {
  return {
    id,
    label,
    reason,
    value: id,
    ...extra,
  };
}

function question(
  options: PostCreationAdaptiveQuestionOption[],
  id = "game-question",
): PostCreationAdaptiveQuestion {
  return {
    id,
    mapKey: "format",
    type: "strategic_choice",
    title: "Qual formato segura melhor essa pauta?",
    helper: null,
    required: true,
    options,
  };
}

function fourOptionQuestion(): PostCreationAdaptiveQuestion {
  return question([
    option("reels", "Reels", "Mostra a situação com ritmo.", { recommended: true }),
    option("stories", "Stories", "Funciona para bastidor rápido."),
    option("carousel", "Carrossel", "Ajuda a organizar uma dica."),
    option("live", "Live", "Abre espaço para aprofundar a conversa."),
  ]);
}

function questionKey(correctOptionId = "reels"): PostCreationAdaptiveGameQuestionAnswerKeyInput {
  return {
    questionId: "game-question",
    mapKey: "format",
    correctOptionId,
    feedback: {
      rationale: "O formato precisa combinar com a força principal da ideia.",
      evidence: [
        "Formato forte: Reels",
        "Formato forte: Reels",
        "",
        "Sinal de engajamento: comentários",
        "Post de referência: POV rotina em casa",
      ],
    },
  };
}

describe("postCreationAdaptiveGameContract", () => {
  it("builds a valid contract for a four-option question with one correct answer", () => {
    const contract = buildPostCreationAdaptiveGameQuestionContract({
      question: fourOptionQuestion(),
      questionKey: questionKey(),
    });

    expect(contract.isValid).toBe(true);
    expect(contract.validationErrors).toEqual([]);
    expect(contract.correctOptionId).toBe("reels");
    expect(contract.options).toHaveLength(4);
    expect(contract.options.filter((candidate) => candidate.role === "correct")).toHaveLength(1);
    expect(contract.options.filter((candidate) => candidate.role === "distractor")).toHaveLength(3);
    expect(contract.options.every((candidate) => candidate.reason.length > 0)).toBe(true);
    expect(contract.correctReason).toContain("formato precisa combinar");
  });

  it("marks a three-option question as invalid without breaking contract creation", () => {
    const contract = buildPostCreationAdaptiveGameQuestionContract({
      question: question(fourOptionQuestion().options.slice(0, 3)),
      questionKey: questionKey(),
    });

    expect(contract.isValid).toBe(false);
    expect(contract.validationErrors).toContain("GameQuestion precisa ter exatamente 4 opções.");
    expect(contract.options).toHaveLength(3);
    expect(contract.options.filter((candidate) => candidate.role === "correct")).toHaveLength(1);
  });

  it("marks a question as invalid when the correct option is missing", () => {
    const contract = buildPostCreationAdaptiveGameQuestionContract({
      question: fourOptionQuestion(),
      questionKey: questionKey("missing-option"),
    });

    expect(contract.isValid).toBe(false);
    expect(contract.correctOptionId).toBe("missing-option");
    expect(contract.validationErrors).toContain("Opção correta não encontrada na pergunta.");
    expect(contract.validationErrors).toContain("GameQuestion precisa ter exatamente 1 opção correta.");
  });

  it("uses existing feedback evidence without duplicates and limits it", () => {
    const contract = buildPostCreationAdaptiveGameQuestionContract({
      question: fourOptionQuestion(),
      questionKey: questionKey(),
    });

    expect(contract.evidence).toEqual([
      "Formato forte: Reels",
      "Sinal de engajamento: comentários",
      "Post de referência: POV rotina em casa",
    ]);
    expect(contract.options.find((candidate) => candidate.role === "correct")?.evidence).toEqual(contract.evidence);
    expect(contract.options.filter((candidate) => candidate.role === "distractor").every((candidate) => candidate.evidence.length === 0)).toBe(true);
  });

  it("builds contracts for all questions from an answer key shape", () => {
    const contract = buildPostCreationAdaptiveGameContract({
      questions: [fourOptionQuestion()],
      answerKey: { questionKeys: [questionKey()] },
    });

    expect(contract).toHaveLength(1);
    expect(contract[0]?.questionId).toBe("game-question");
    expect(contract[0]?.isValid).toBe(true);
  });

  it("fills gameQuestions inside buildPostCreationAdaptiveAnswerKey without changing answer outputs", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero validar uma pauta em Reels");
    const questions = [fourOptionQuestion()];
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions });

    expect(answerKey.gameQuestions).toHaveLength(1);
    expect(answerKey.gameQuestions[0]?.isValid).toBe(true);
    expect(answerKey.correctAnswersByQuestionId).toEqual({ "game-question": "reels" });
    expect(answerKey.idealAnswers).toEqual([
      {
        questionId: "game-question",
        key: "format",
        optionId: "reels",
        value: "reels",
      },
    ]);
    expect(answerKey.legacyHandoff).toEqual(buildPostCreationLegacyHandoff({ plan: answerKey.idealPlan }));

    const { score } = evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: answerKey.idealAnswers,
    });
    expect(score.total).toBe(1);
    expect(score.correct).toBe(1);
    expect(score.percentage).toBe(100);
  });

  it("keeps answer key creation safe when a question has fewer than four options", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero validar uma pauta em Reels");
    const questions = [question(fourOptionQuestion().options.slice(0, 3))];
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions });

    expect(answerKey.questionKeys).toHaveLength(1);
    expect(answerKey.gameQuestions).toHaveLength(1);
    expect(answerKey.gameQuestions[0]?.isValid).toBe(false);
    expect(answerKey.gameQuestions[0]?.validationErrors).toContain("GameQuestion precisa ter exatamente 4 opções.");
  });
});
