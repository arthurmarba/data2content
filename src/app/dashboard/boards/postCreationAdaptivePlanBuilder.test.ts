import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { buildPostCreationAdaptiveAnswerKey } from "./postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveStrategicPlan } from "./postCreationAdaptivePlanBuilder";
import type { PostCreationAdaptiveAnswer } from "./postCreationAdaptiveTypes";

describe("buildPostCreationAdaptiveStrategicPlan", () => {
  it("builds a complete plan for validate_pauta with recommended answers", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero gravar um POV sobre rotina");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers: PostCreationAdaptiveAnswer[] = questions.map((q) => ({
      questionId: q.id,
      key: q.mapKey,
      optionId: q.options.find((o) => o.recommended)?.id || q.options[0]!.id,
      value: null,
    }));
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, answers });

    const plan = buildPostCreationAdaptiveStrategicPlan({
      detection,
      questions,
      answers,
      answerKey,
    });

    expect(plan.pauta).toBe("rotina");
    expect(plan.objective).toBeTruthy();
    expect(plan.fiveW2H.what).toBe(plan.pauta);
    expect(plan.scenes.length).toBeGreaterThanOrEqual(2);
    expect(plan.nextActions.length).toBeGreaterThanOrEqual(3);
    expect(plan.collabMatch).toBeNull();
    expect(plan.nextActions.some((a) => /collab|parceiro/i.test(a))).toBe(false);
  });

  it("handles brand_match mode correctly", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero atrair marcas de skincare");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers: PostCreationAdaptiveAnswer[] = questions.map((q) => ({
      questionId: q.id,
      key: q.mapKey,
      optionId: q.options.find((o) => o.recommended)?.id || q.options[0]!.id,
      value: null,
    }));
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, answers });

    const plan = buildPostCreationAdaptiveStrategicPlan({
      detection,
      questions,
      answers,
      answerKey,
    });

    expect(plan.brandMatch?.enabled).toBe(true);
    expect(plan.brandMatch?.category).toMatch(/skincare|beleza|autocuidado/i);
    expect(plan.collabMatch).toBeNull();
    expect(plan.nextActions.some((a) => a.toLowerCase().includes("marca"))).toBe(true);
  });

  it("handles collab_match mode correctly", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero fazer uma collab para gerar comentários");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers: PostCreationAdaptiveAnswer[] = questions.map((q) => ({
      questionId: q.id,
      key: q.mapKey,
      optionId: q.options.find((o) => o.recommended)?.id || q.options[0]!.id,
      value: null,
    }));
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, answers });

    const plan = buildPostCreationAdaptiveStrategicPlan({
      detection,
      questions,
      answers,
      answerKey,
    });

    expect(plan.collabMatch?.enabled).toBe(true);
    expect(plan.nextActions.some((a) => a.toLowerCase().includes("collab"))).toBe(true);
  });

  it("keeps explicit collab input on the collab_match path", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero gravar um vídeo sobre rotina com uma collab");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers: PostCreationAdaptiveAnswer[] = questions.map((q) => ({
      questionId: q.id,
      key: q.mapKey,
      optionId: q.options.find((o) => o.recommended)?.id || q.options[0]!.id,
      value: null,
    }));
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, answers });

    const plan = buildPostCreationAdaptiveStrategicPlan({
      detection,
      questions,
      answers,
      answerKey,
    });

    expect(detection.mode).toBe("collab_match");
    expect(plan.collabMatch?.enabled).toBe(true);
    expect(plan.nextActions.some((a) => /collab|parceiro/i.test(a))).toBe(true);
  });

  it("handles comment_to_post mode correctly", () => {
    const detection = detectPostCreationAdaptiveIntent("Comentaram isso aqui: como você organiza sua rotina?");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers: PostCreationAdaptiveAnswer[] = questions.map((q) => ({
      questionId: q.id,
      key: q.mapKey,
      optionId: q.options.find((o) => o.recommended)?.id || q.options[0]!.id,
      value: null,
    }));
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, answers });

    const plan = buildPostCreationAdaptiveStrategicPlan({
      detection,
      questions,
      answers,
      answerKey,
    });

    expect(plan.pauta).toContain("como voce organiza sua rotina");
    expect(plan.fiveW2H.what).toBe(plan.pauta);
  });

  it("handles unknown mode safely", () => {
    const detection = detectPostCreationAdaptiveIntent("me ajuda");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers: PostCreationAdaptiveAnswer[] = [];
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, answers });

    const plan = buildPostCreationAdaptiveStrategicPlan({
      detection,
      questions,
      answers,
      answerKey,
    });

    expect(plan).toBeTruthy();
    expect(plan.nextActions.some((a) => a.includes("Refinar"))).toBe(true);
  });

  it("enforces consultative and safe language across the entire plan", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero viralizar garantido");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers: PostCreationAdaptiveAnswer[] = questions.map((q) => ({
      questionId: q.id,
      key: q.mapKey,
      optionId: q.options[0]!.id,
      value: null,
    }));
    const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, answers });

    const plan = buildPostCreationAdaptiveStrategicPlan({
      detection,
      questions,
      answers,
      answerKey,
    });

    const fullText = JSON.stringify(plan).toLowerCase();

    const forbiddenWords = [
      "garantido", "comprovado", "certeza", "sempre performa",
      "acertou", "errou", "nota", "pontuação", "viralizar garantido", "crescer garantido"
    ];

    for (const word of forbiddenWords) {
      expect(fullText).not.toContain(word);
    }
  });
});
