import type { PostCreationAdaptiveMode, PostCreationAdaptiveQuestionMapKey } from "./postCreationAdaptiveTypes";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";

function quizFor(input: string) {
  return buildPostCreationAdaptiveQuiz({
    detection: detectPostCreationAdaptiveIntent(input),
  });
}

function mapKeysFor(input: string) {
  return quizFor(input).map((question) => question.mapKey);
}

function detectionForMode(mode: PostCreationAdaptiveMode) {
  return {
    mode,
    confidence: mode === "unknown" ? 0.25 : 0.8,
    normalizedInput: mode,
    originalInput: mode,
    detectedPauta: null,
    objective: null,
    brandCategory: null,
    sourceComment: null,
    signals: [],
    suggestedStage: mode === "unknown" ? ("intent" as const) : ("quiz" as const),
  };
}

const adaptiveModes: PostCreationAdaptiveMode[] = [
  "validate_pauta",
  "discover_pauta",
  "create_by_goal",
  "format_guidance",
  "brand_match",
  "collab_match",
  "comment_to_post",
  "weekly_plan",
  "unknown",
];

describe("buildPostCreationAdaptiveQuiz", () => {
  it("returns between 3 and 5 questions for validate_pauta", () => {
    const quiz = quizFor("Quero gravar um POV sobre minha família fazendo barulho");

    expect(quiz.length).toBeGreaterThanOrEqual(3);
    expect(quiz.length).toBeLessThanOrEqual(5);
  });

  it("builds discover_pauta questions around narrative, objective, format, and effort", () => {
    const keys = mapKeysFor("Não sei o que postar amanhã");

    expect(keys).toEqual(expect.arrayContaining(["narrative", "objective", "format", "effort"]));
  });

  it("builds create_by_goal questions around objective, narrative, format, and CTA", () => {
    const keys = mapKeysFor("Quero gerar mais comentários");

    expect(keys).toEqual(expect.arrayContaining(["objective", "narrative", "format", "cta"]));
  });

  it("builds format_guidance questions around narrative, objective, hook, effort and format", () => {
    const keys = mapKeysFor("Quero saber qual formato usar");

    expect(keys).toEqual(expect.arrayContaining(["narrative", "objective", "hook", "effort", "format"]));
  });

  it("builds brand_match questions around brand, how, narrative, format and why", () => {
    const keys = mapKeysFor("Quero atrair marcas de skincare");

    expect(keys).toEqual(expect.arrayContaining(["brand", "how", "narrative", "format", "why"]));
  });

  it("builds collab_match questions around collab, why, objective and narrative", () => {
    const keys = mapKeysFor("Quero fazer uma collab para gerar comentários");

    expect(keys).toEqual(expect.arrayContaining(["collab", "why", "objective", "narrative"]));
  });

  it("builds comment_to_post questions around why, format, narrative, and CTA", () => {
    const keys = mapKeysFor("Alguém comentou isso aqui e quero transformar em post");

    expect(keys).toEqual(expect.arrayContaining(["why", "format", "narrative", "cta"]));
  });

  it("builds weekly_plan questions around objective, schedule, format and narrative", () => {
    const keys = mapKeysFor("Quero planejar meus posts da semana");

    expect(keys).toEqual(expect.arrayContaining(["objective", "schedule", "format", "narrative"]));
  });

  it("returns clarification questions for unknown intent", () => {
    const quiz = quizFor("me ajuda");
    const keys = quiz.map((question) => question.mapKey);

    expect(keys).toEqual(expect.arrayContaining(["objective", "what"]));
    expect(quiz[0]?.title).toMatch(/achar o melhor caminho/i);
  });

  it("gives every generated question exactly 4 options", () => {
    for (const mode of adaptiveModes) {
      const quiz = buildPostCreationAdaptiveQuiz({ detection: detectionForMode(mode) });
      expect(quiz.every((question) => question.options.length === 4)).toBe(true);
    }
  });

  it("does not return more than 5 questions for any mode", () => {
    for (const mode of adaptiveModes) {
      const quiz = buildPostCreationAdaptiveQuiz({ detection: detectionForMode(mode) });
      expect(quiz.length).toBeLessThanOrEqual(5);
    }
  });

  it("gives every question id, title, type, mapKey, and options", () => {
    const quiz = quizFor("Quero atrair marcas de skincare");

    for (const question of quiz) {
      expect(question.id).toBeTruthy();
      expect(question.title).toBeTruthy();
      expect(question.type).toBeTruthy();
      expect(question.mapKey).toBeTruthy();
      expect(Array.isArray(question.options)).toBe(true);
    }
  });

  it("marks recommended options where a strategic default makes sense", () => {
    const quiz = quizFor("Quero transformar comentário em conteúdo");
    const questionsWithRecommended = quiz.filter((question) =>
      question.options.some((option) => option.recommended)
    );

    expect(questionsWithRecommended.length).toBeGreaterThan(0);
  });

  it("uses only declared map keys", () => {
    const allowedKeys = new Set<PostCreationAdaptiveQuestionMapKey>([
      "who",
      "what",
      "where",
      "when",
      "why",
      "how",
      "how_much",
      "hook",
      "cta",
      "format",
      "narrative",
      "objective",
      "brand",
      "collab",
      "effort",
      "schedule",
    ]);
    const quiz = quizFor("Quero planejar meus posts da semana");

    expect(quiz.every((question) => allowedKeys.has(question.mapKey))).toBe(true);
  });

  it("uses more human language for validate_pauta", () => {
    const quiz = quizFor("Quero gravar um POV sobre minha família fazendo barulho");

    expect(quiz[0]?.id).toBe("validate-objective");
    expect(quiz[0]?.title).toMatch(/provocar em quem assistir/i);
    expect(quiz[1]?.title).toMatch(/força dessa ideia/i);
    expect(quiz[2]?.title).toMatch(/primeiros 2 segundos/i);
    expect(quiz[3]?.title).toMatch(/entrar na brincadeira/i);
  });

  it("uses more human language for discover_pauta", () => {
    const quiz = quizFor("Não sei o que postar amanhã");

    expect(quiz[0]?.id).toBe("discover-territory");
    expect(quiz[0]?.title).toMatch(/território/i);
    expect(quiz[1]?.title).toMatch(/reação/i);
    expect(quiz[2]?.title).toMatch(/topa produzir/i);
    expect(quiz[3]?.title).toMatch(/fôlego/i);
  });

  it("uses more human language for brand_match", () => {
    const quiz = quizFor("Quero atrair marcas de skincare");

    expect(quiz[0]?.id).toBe("brand-category");
    expect(quiz[0]?.title).toMatch(/caberia naturalmente/i);
    expect(quiz[1]?.title).toMatch(/sem parecer interrupção/i);
    expect(quiz[4]?.title).toMatch(/match/i);
  });

  it("uses specific language for format_guidance", () => {
    const quiz = quizFor("Melhor reels ou carrossel para uma pauta de skincare?");

    expect(quiz).toHaveLength(5);
    expect(quiz[0]?.id).toBe("format-narrative");
    expect(quiz[0]?.title).toMatch(/força principal/i);
    expect(quiz[0]?.helper).toMatch(/precisa carregar/i);
    expect(quiz[1]?.title).toMatch(/reação esse conteúdo/i);
    expect(quiz[2]?.title).toMatch(/abrir para segurar atenção/i);
    expect(quiz[4]?.title).toMatch(/formato parece mais coerente/i);
  });

  it("keeps copy consultative and avoids absolute or game terms", () => {
    for (const mode of adaptiveModes) {
      const quiz = buildPostCreationAdaptiveQuiz({ detection: detectionForMode(mode) });
      const text = quiz.map((q) => `${q.title} ${q.helper || ""} ${q.options.map((o) => o.label + " " + (o.reason || "")).join(" ")}`).join(" ").toLowerCase();

      expect(text).not.toMatch(/garantido|comprovado|certeza|sempre performa|acertar|erro|errado|venceu|perdeu/i);
    }
  });

  it("preserves primary ids and mapKeys for every mode", () => {
    const expectedByMode: Record<PostCreationAdaptiveMode, Array<[string, PostCreationAdaptiveQuestionMapKey]>> = {
      validate_pauta: [
        ["validate-objective", "objective"],
        ["validate-why", "why"],
        ["validate-hook", "hook"],
        ["validate-cta", "cta"],
        ["validate-opportunity", "collab"], // mapKey can be brand or collab based on signal, detectionForMode signal is empty
      ],
      discover_pauta: [
        ["discover-territory", "narrative"],
        ["discover-objective", "objective"],
        ["discover-format", "format"],
        ["discover-effort", "effort"],
      ],
      create_by_goal: [
        ["goal-response", "objective"],
        ["goal-narrative", "narrative"],
        ["goal-format", "format"],
        ["goal-cta", "cta"],
      ],
      format_guidance: [
        ["format-narrative", "narrative"],
        ["format-objective", "objective"],
        ["format-hook", "hook"],
        ["format-effort", "effort"],
        ["format-primary", "format"],
      ],
      brand_match: [
        ["brand-category", "brand"],
        ["brand-how", "how"],
        ["brand-narrative", "narrative"],
        ["brand-format", "format"],
        ["brand-why", "why"],
      ],
      collab_match: [
        ["collab-type", "collab"],
        ["collab-why", "why"],
        ["collab-objective", "objective"],
        ["collab-narrative", "narrative"],
      ],
      comment_to_post: [
        ["comment-why", "why"],
        ["comment-format", "format"],
        ["comment-narrative", "narrative"],
        ["comment-cta", "cta"],
      ],
      weekly_plan: [
        ["weekly-objective", "objective"],
        ["weekly-schedule", "schedule"],
        ["weekly-format", "format"],
        ["weekly-narrative", "narrative"],
      ],
      unknown: [
        ["unknown-intent", "objective"],
        ["unknown-what", "what"],
      ],
    };

    for (const mode of adaptiveModes) {
      const quiz = buildPostCreationAdaptiveQuiz({ detection: detectionForMode(mode) });
      const received = quiz.map((question) => [question.id, question.mapKey]);
      expect(received).toEqual(expectedByMode[mode]);
    }
  });

  it("personalizes format_guidance with detected pauta", () => {
    const quiz = quizFor("Qual formato usar para uma publi de skincare?");
    const helper = quiz[0]?.helper || "";
    expect(helper).toMatch(/uma publi de skincare/i);
  });

  it("personalizes brand_match with detected brand category", () => {
    const quiz = quizFor("Quero atrair marcas de skincare");
    const helper = quiz[0]?.helper || "";
    expect(helper).toMatch(/skincare/i);
  });

  it("personalizes comment_to_post with source comment", () => {
    const quiz = quizFor("Comentaram isso aqui: como você organiza sua rotina?");
    const helper = quiz[0]?.helper || "";
    expect(helper).toMatch(/como voce organiza sua rotina/i);
  });

  it("personalizes create_by_goal with detected objective", () => {
    const quiz = quizFor("Quero gerar mais comentários");
    const helper = quiz[0]?.helper || "";
    expect(helper).toMatch(/comentarios/i);
  });
});
