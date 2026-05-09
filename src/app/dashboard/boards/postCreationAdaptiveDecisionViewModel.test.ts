import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveQuestion,
} from "./postCreationAdaptiveTypes";
import { buildAdaptiveDecisionViewModel } from "./postCreationAdaptiveDecisionViewModel";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";

function baseQuestion(overrides: Partial<PostCreationAdaptiveQuestion> = {}): PostCreationAdaptiveQuestion {
  return {
    id: "q-objective",
    title: "Qual objetivo principal?",
    helper: "Escolha o resultado que guia a execução.",
    mapKey: "objective",
    type: "strategic_choice",
    required: true,
    options: [
      { id: "comments", label: "Comentários", reason: "Puxa conversa.", recommended: true },
      { id: "reach", label: "Alcance", reason: "Amplia descoberta." },
      { id: "saves", label: "Salvamentos", reason: "Aumenta utilidade." },
    ],
    ...overrides,
  };
}

function answerFor(questionId = "q-objective", optionId = "reach"): PostCreationAdaptiveAnswer {
  return {
    questionId,
    key: "objective",
    optionId,
    value: "Alcance",
    answeredAt: "2026-05-09T00:00:00.000Z",
  };
}

describe("buildAdaptiveDecisionViewModel", () => {
  it("creates a view model with id, title, helper, mapKey, and questionType", () => {
    const question = baseQuestion();
    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.id).toBe(question.id);
    expect(viewModel.title).toBe(question.title);
    expect(viewModel.helper).toBe(question.helper);
    expect(viewModel.mapKey).toBe(question.mapKey);
    expect(viewModel.questionType).toBe(question.type);
  });

  it("sets progressLabel to Pergunta 1 de 4", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.progressLabel).toBe("Pergunta 1 de 4");
  });

  it("calculates progressValue and keeps it between 0 and 1", () => {
    const first = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });
    const last = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 3,
      questionCount: 4,
    });
    const overflow = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 99,
      questionCount: 4,
    });

    expect(first.progressValue).toBe(0.25);
    expect(last.progressValue).toBe(1);
    expect(overflow.progressValue).toBe(1);
  });

  it("translates objective to Objetivo", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ mapKey: "objective" }),
      answers: [],
      questionIndex: 0,
      questionCount: 1,
    });

    expect(viewModel.visualStep).toBe("Objetivo");
  });

  it("translates brand to Marca", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ mapKey: "brand" }),
      answers: [],
      questionIndex: 0,
      questionCount: 1,
    });

    expect(viewModel.visualStep).toBe("Marca");
  });

  it("uses fallback Decisão for an unknown mapKey", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ mapKey: "unknown_key" as any }),
      answers: [],
      questionIndex: 0,
      questionCount: 1,
    });

    expect(viewModel.visualStep).toBe("Decisão");
  });

  it("gets selectedOptionId from an existing answer", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor()],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.selectedOptionId).toBe("reach");
  });

  it("returns the selectedAnswer when found", () => {
    const answer = answerFor();
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answer],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.selectedAnswer).toBe(answer);
  });

  it("marks selected only on the selected option", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor()],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.options.map((option) => [option.id, option.selected])).toEqual([
      ["comments", false],
      ["reach", true],
      ["saves", false],
    ]);
  });

  it("sets canAdvance false when required and unanswered", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ required: true }),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.canAdvance).toBe(false);
  });

  it("sets canAdvance true when required and answered", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ required: true }),
      answers: [answerFor()],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.canAdvance).toBe(true);
  });

  it("sets canAdvance true when required is false, even without answer", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ required: false }),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.canAdvance).toBe(true);
  });

  it("uses Proxima decisao before the last question", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor()],
      questionIndex: 1,
      questionCount: 4,
    });

    expect(viewModel.nextLabel).toBe("Próxima decisão");
  });

  it("uses Ver plano estrategico on the last question", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [answerFor()],
      questionIndex: 3,
      questionCount: 4,
    });

    expect(viewModel.nextLabel).toBe("Ver plano estratégico");
  });

  it("preserves option order", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.options.map((option) => option.id)).toEqual(["comments", "reach", "saves"]);
  });

  it("normalizes empty helper to null", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({ helper: "   " }),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.helper).toBeNull();
  });

  it("normalizes empty option reason to null", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion({
        options: [
          { id: "one", label: "Uma", reason: "   " },
          { id: "two", label: "Duas", reason: "Razão" },
          { id: "three", label: "Três" },
        ],
      }),
      answers: [],
      questionIndex: 0,
      questionCount: 4,
    });

    expect(viewModel.options[0]?.reason).toBeNull();
    expect(viewModel.options[1]?.reason).toBe("Razão");
    expect(viewModel.options[2]?.reason).toBeNull();
  });

  it("works integrated with intent detection and adaptive quiz builder", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero atrair marcas de skincare");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const firstQuestion = questions[0];
    expect(firstQuestion).toBeTruthy();

    const viewModel = buildAdaptiveDecisionViewModel({
      question: firstQuestion!,
      answers: [
        {
          questionId: firstQuestion!.id,
          key: firstQuestion!.mapKey,
          optionId: firstQuestion!.options[0]!.id,
          value: firstQuestion!.options[0]!.label,
        },
      ],
      questionIndex: 0,
      questionCount: questions.length,
    });

    expect(viewModel.visualStep).toBe("Marca");
    expect(viewModel.options[0]?.selected).toBe(true);
    expect(viewModel.canAdvance).toBe(true);
  });

  it("does not break with a negative questionIndex", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: -10,
      questionCount: 4,
    });

    expect(viewModel.questionIndex).toBe(0);
    expect(viewModel.progressLabel).toBe("Pergunta 1 de 4");
    expect(viewModel.progressValue).toBe(0.25);
  });

  it("does not break with questionCount zero", () => {
    const viewModel = buildAdaptiveDecisionViewModel({
      question: baseQuestion(),
      answers: [],
      questionIndex: 0,
      questionCount: 0,
    });

    expect(viewModel.questionCount).toBe(1);
    expect(viewModel.progressLabel).toBe("Pergunta 1 de 1");
    expect(viewModel.progressValue).toBe(1);
  });
});
