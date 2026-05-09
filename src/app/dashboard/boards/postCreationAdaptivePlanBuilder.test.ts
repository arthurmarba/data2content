import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveQuestion,
} from "./postCreationAdaptiveTypes";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { buildPostCreationStrategicPlan } from "./postCreationAdaptivePlanBuilder";

function buildDetection(input: string) {
  return detectPostCreationAdaptiveIntent(input);
}

function buildQuiz(input: string) {
  const detection = buildDetection(input);
  return {
    detection,
    questions: buildPostCreationAdaptiveQuiz({ detection }),
  };
}

function answerQuestion(
  questions: PostCreationAdaptiveQuestion[],
  mapKey: PostCreationAdaptiveQuestion["mapKey"],
  optionId: string
): PostCreationAdaptiveAnswer {
  const question = questions.find((item) => item.mapKey === mapKey);
  if (!question) throw new Error(`Question not found for ${mapKey}`);
  const option = question.options.find((item) => item.id === optionId);
  if (!option) throw new Error(`Option not found for ${mapKey}:${optionId}`);
  return {
    questionId: question.id,
    key: question.mapKey,
    optionId: option.id,
    value: option.label,
  };
}

function planFor(input: string, answers: PostCreationAdaptiveAnswer[] = []) {
  const { detection, questions } = buildQuiz(input);
  return buildPostCreationStrategicPlan({ detection, questions, answers });
}

function detectionForMode(mode: PostCreationAdaptiveMode) {
  const detection = detectPostCreationAdaptiveIntent("me ajuda");
  return {
    ...detection,
    mode,
    confidence: mode === "unknown" ? 0.25 : 0.8,
    suggestedStage: mode === "unknown" ? "intent" as const : "quiz" as const,
  };
}

function expectFiveW2HComplete(plan: ReturnType<typeof buildPostCreationStrategicPlan>) {
  expect(plan.fiveW2H.who).toBeTruthy();
  expect(plan.fiveW2H.what).toBeTruthy();
  expect(plan.fiveW2H.where).toBeTruthy();
  expect(plan.fiveW2H.when).toBeTruthy();
  expect(plan.fiveW2H.why).toBeTruthy();
  expect(plan.fiveW2H.how).toBeTruthy();
  expect(plan.fiveW2H.howMuch).toBeTruthy();
}

describe("buildPostCreationStrategicPlan", () => {
  it("uses detected pauta for validate_pauta", () => {
    const plan = planFor("Quero gravar um POV sobre minha família fazendo barulho");

    expect(plan.pauta).toContain("minha familia fazendo barulho");
    expect(plan.nextActions).toEqual(expect.arrayContaining(["save_to_calendar", "generate_script", "create_variation"]));
  });

  it("creates a non-empty pauta for discover_pauta without detected pauta", () => {
    const plan = planFor("Não sei o que postar essa semana");

    expect(plan.pauta).toBeTruthy();
    expect(plan.pauta).not.toBe("");
  });

  it("respects detected objective for create_by_goal", () => {
    const plan = planFor("Quero gerar mais comentários");

    expect(plan.objective.toLowerCase()).toContain("comentarios");
  });

  it("fills brandMatch and includes see_brands for brand_match", () => {
    const plan = planFor("Quero atrair marcas de skincare");

    expect(plan.brandMatch).toMatchObject({ enabled: true });
    expect(plan.brandMatch?.category).toBe("skincare");
    expect(plan.nextActions).toContain("see_brands");
  });

  it("fills collabMatch and includes see_collabs for collab_match", () => {
    const plan = planFor("Quero fazer collab com alguém do meu nicho");

    expect(plan.collabMatch).toMatchObject({ enabled: true });
    expect(plan.nextActions).toContain("see_collabs");
  });

  it("uses sourceComment for comment_to_post when available", () => {
    const detection = {
      ...detectPostCreationAdaptiveIntent("Quero transformar comentário em conteúdo"),
      sourceComment: "Como lidar com familia fazendo barulho?",
    };
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const plan = buildPostCreationStrategicPlan({ detection, questions, answers: [] });

    expect(plan.pauta).toContain("Como lidar com familia fazendo barulho?");
    expect(plan.fiveW2H.why.toLowerCase()).toContain("comentario");
  });

  it("creates coherent weekly schedule fields", () => {
    const { detection, questions } = buildQuiz("Quero planejar meus posts da semana");
    const answers = [answerQuestion(questions, "schedule", "five")];
    const plan = buildPostCreationStrategicPlan({ detection, questions, answers });

    expect(plan.pauta).toBeTruthy();
    expect(plan.fiveW2H.when).toContain("5");
    expect(plan.nextActions).toEqual(expect.arrayContaining(["save_to_calendar", "create_variation"]));
  });

  it("does not return empty main fields for unknown", () => {
    const plan = planFor("me ajuda");

    expect(plan.pauta).toBeTruthy();
    expect(plan.objective).toBeTruthy();
    expect(plan.narrative).toBeTruthy();
    expect(plan.format).toBeTruthy();
    expect(plan.hook).toBeTruthy();
    expect(plan.cta).toBeTruthy();
  });

  it("always returns complete fiveW2H for every mode", () => {
    const modes: PostCreationAdaptiveMode[] = [
      "validate_pauta",
      "discover_pauta",
      "create_by_goal",
      "brand_match",
      "collab_match",
      "comment_to_post",
      "weekly_plan",
      "unknown",
    ];

    for (const mode of modes) {
      const detection = detectionForMode(mode);
      const questions = buildPostCreationAdaptiveQuiz({ detection });
      const plan = buildPostCreationStrategicPlan({ detection, questions, answers: [] });
      expectFiveW2HComplete(plan);
    }
  });

  it("always returns between 3 and 5 scenes", () => {
    const modes: PostCreationAdaptiveMode[] = [
      "validate_pauta",
      "discover_pauta",
      "create_by_goal",
      "brand_match",
      "collab_match",
      "comment_to_post",
      "weekly_plan",
      "unknown",
    ];

    for (const mode of modes) {
      const detection = detectionForMode(mode);
      const questions = buildPostCreationAdaptiveQuiz({ detection });
      const plan = buildPostCreationStrategicPlan({ detection, questions, answers: [] });
      expect(plan.scenes.length).toBeGreaterThanOrEqual(3);
      expect(plan.scenes.length).toBeLessThanOrEqual(5);
    }
  });

  it("never returns empty nextActions", () => {
    const plan = planFor("me ajuda");

    expect(plan.nextActions.length).toBeGreaterThan(0);
  });

  it("does not break when answers are missing", () => {
    const { detection, questions } = buildQuiz("Quero atrair marcas de skincare");
    const plan = buildPostCreationStrategicPlan({ detection, questions, answers: [] });

    expect(plan.pauta).toBeTruthy();
    expectFiveW2HComplete(plan);
  });

  it("uses quiz answers when provided", () => {
    const { detection, questions } = buildQuiz("Não sei o que postar essa semana");
    const answers = [
      answerQuestion(questions, "objective", "authority"),
      answerQuestion(questions, "format", "carousel"),
      answerQuestion(questions, "effort", "high"),
    ];
    const plan = buildPostCreationStrategicPlan({ detection, questions, answers });

    expect(plan.objective).toBe("Autoridade");
    expect(plan.format).toBe("Carrossel");
    expect(plan.fiveW2H.howMuch).toContain("Alto");
  });

  it("works integrated with router and quiz builder", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero fazer uma pauta para atrair marca de beleza");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers = [answerQuestion(questions, "brand", "beauty_selfcare")];
    const plan = buildPostCreationStrategicPlan({ detection, questions, answers });

    expect(detection.mode).toBe("brand_match");
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(plan.brandMatch?.enabled).toBe(true);
    expect(plan.pauta).toBeTruthy();
  });
});
