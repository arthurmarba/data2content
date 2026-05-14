import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { buildPostCreationAdaptiveAnswerKey } from "./postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveStrategicPlan } from "./postCreationAdaptivePlanBuilder";
import type { PostCreationAdaptiveAnswer } from "./postCreationAdaptiveTypes";

const pipelineCases = [
  {
    name: "validate_pauta",
    input: "Quero gravar um POV sobre rotina",
  },
  {
    name: "format_guidance",
    input: "Qual formato usar para uma publi de skincare?",
  },
  {
    name: "discover_pauta",
    input: "Não sei o que postar amanhã",
  },
  {
    name: "create_by_goal",
    input: "Quero gerar mais comentários",
  },
  {
    name: "brand_match",
    input: "Quero atrair marcas de skincare",
  },
  {
    name: "collab_match",
    input: "Quero fazer uma collab para gerar comentários",
  },
  {
    name: "comment_to_post",
    input: "Comentaram isso aqui: como você organiza sua rotina?",
  },
  {
    name: "weekly_plan",
    input: "Não sei o que postar essa semana para atrair marcas",
  },
  {
    name: "unknown",
    input: "me ajuda",
  },
];

const forbiddenLanguage = [
  "garantido",
  "comprovado",
  "certeza",
  "sempre performa",
  "acerto",
  "acertou",
  "erro",
  "errou",
  "errado",
  "nota",
  "pontuação",
  "venceu",
  "perdeu",
  "viralizar garantido",
  "crescer garantido",
];

function runPipeline(input: string) {
  const detection = detectPostCreationAdaptiveIntent(input);
  const questions = buildPostCreationAdaptiveQuiz({ detection });
  const answers: PostCreationAdaptiveAnswer[] = questions.map((q) => ({
    questionId: q.id,
    key: q.mapKey,
    optionId: q.options.find((o) => o.recommended)?.id || q.options[0]!.id,
    value: null,
  }));

  const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, answers });
  const plan = buildPostCreationAdaptiveStrategicPlan({ detection, questions, answers, answerKey });

  return { detection, questions, answers, answerKey, plan };
}

describe("Post Creation Adaptive Pipeline QA", () => {
  it("validates validate_pauta journey", () => {
    const { detection, questions, answerKey, plan } = runPipeline("Quero gravar um POV sobre rotina");

    expect(detection.mode).toBe("validate_pauta");
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(questions.length).toBeLessThanOrEqual(5);
    expect(answerKey.answeredQuestions).toBe(questions.length);
    expect(plan.pauta).toBeTruthy();
    expect(plan.scenes.length).toBeGreaterThanOrEqual(2);
    expect(plan.nextActions.length).toBeGreaterThanOrEqual(3);
    expect(plan.collabMatch).toBeNull();
    expect(plan.nextActions.some((a) => /collab|parceiro/i.test(a))).toBe(false);
  });

  it("validates format_guidance journey", () => {
    const { detection, questions, plan } = runPipeline("Qual formato usar para uma publi de skincare?");

    expect(detection.mode).toBe("format_guidance");
    expect(questions[0]?.mapKey).not.toBe("format");
    expect(questions[questions.length - 1]?.mapKey).toBe("format");
    expect(plan.format).toBeTruthy();
  });

  it("validates discover_pauta journey", () => {
    const { detection, questions, plan } = runPipeline("Não sei o que postar amanhã");

    expect(detection.mode).toBe("discover_pauta");
    expect(questions[0]?.mapKey).toBe("narrative");
    expect(plan.narrative).toBeTruthy();
    expect(plan.nextActions.length).toBeGreaterThanOrEqual(3);
  });

  it("validates create_by_goal journey", () => {
    const { detection, questions, answerKey, plan } = runPipeline("Quero gerar mais comentários");

    expect(detection.mode).toBe("create_by_goal");
    expect(questions[0]?.mapKey).toBe("objective");
    expect(answerKey.summary).toMatch(/caminho sugerido|recomendação estratégica|direção estratégica/i);
    expect(plan.objective).toBeTruthy();
  });

  it("validates brand_match journey", () => {
    const { detection, plan } = runPipeline("Quero atrair marcas de skincare");

    expect(detection.mode).toBe("brand_match");
    expect(plan.brandMatch?.enabled).toBe(true);
    expect(plan.brandMatch?.category).toMatch(/skincare|beauty|beleza|autocuidado/i);
    expect(plan.collabMatch).toBeNull();
    expect(plan.nextActions.some((a) => /marca|encaixe|parceria/i.test(a))).toBe(true);
  });

  it("validates collab_match journey", () => {
    const { detection, plan } = runPipeline("Quero fazer uma collab para gerar comentários");

    expect(detection.mode).toBe("collab_match");
    expect(plan.collabMatch?.enabled).toBe(true);
    expect(plan.nextActions.some((a) => /collab|parceiro/i.test(a))).toBe(true);
  });

  it("routes explicit collab validation input into collab_match", () => {
    const { detection, plan } = runPipeline("Quero gravar um vídeo sobre rotina com uma collab");

    expect(detection.mode).toBe("collab_match");
    expect(plan.collabMatch?.enabled).toBe(true);
    expect(plan.nextActions.some((a) => /collab|parceiro/i.test(a))).toBe(true);
  });

  it("validates comment_to_post journey", () => {
    const { detection, questions, plan } = runPipeline("Comentaram isso aqui: como você organiza sua rotina?");

    expect(detection.mode).toBe("comment_to_post");
    expect(plan.pauta).toMatch(/como voce organiza sua rotina/i);
    const keys = questions.map((q) => q.mapKey);
    expect(keys).toEqual(expect.arrayContaining(["why", "format", "narrative", "cta"]));
  });

  it("validates weekly_plan journey", () => {
    const { detection, questions, plan } = runPipeline("Não sei o que postar essa semana para atrair marcas");

    expect(detection.mode).toBe("weekly_plan");
    const keys = questions.map((q) => q.mapKey);
    expect(keys).toEqual(expect.arrayContaining(["objective", "schedule", "format", "narrative"]));
    expect(plan.fiveW2H.when).toBeTruthy();
  });

  it("validates unknown journey safely", () => {
    const { detection, questions, plan } = runPipeline("me ajuda");

    expect(detection.mode).toBe("unknown");
    expect(questions.length).toBeGreaterThanOrEqual(2);
    expect(plan.nextActions.some((a) => /refinar|clarificação/i.test(a) || /clarificacao/i.test(a) || /ideia/i.test(a))).toBe(true);
  });

  it("enforces consultative language across the entire pipeline output", () => {
    for (const { input } of pipelineCases) {
      const { detection, questions, answerKey, plan } = runPipeline(input);

      const fullText = JSON.stringify({
        mode: detection.mode,
        questions: questions.map((q) => ({
          title: q.title,
          helper: q.helper,
          options: q.options.map((option) => ({
            label: option.label,
            reason: option.reason,
          })),
        })),
        answerKey: {
          summary: answerKey.summary,
          strengths: answerKey.strengths,
          adjustments: answerKey.adjustments,
          evaluationReasons: answerKey.evaluations.map((evaluation) => evaluation.reason),
        },
        plan
      }).toLowerCase();

      for (const word of forbiddenLanguage) {
        expect(fullText).not.toContain(word);
      }
    }
  });

  it("sanitizes forbidden words if they come from user input", () => {
    const { plan } = runPipeline("Quero viralizar garantido");

    expect(JSON.stringify(plan).toLowerCase()).not.toContain("garantido");
    expect(plan.pauta).toContain("direção");
  });
});
