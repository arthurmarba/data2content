import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";

describe("detectPostCreationAdaptiveIntent", () => {
  it("detects an existing pauta to validate", () => {
    const result = detectPostCreationAdaptiveIntent("Quero gravar um POV sobre minha família fazendo barulho");

    expect(result.mode).toBe("validate_pauta");
    expect(result.detectedPauta).toContain("minha familia fazendo barulho");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("prioritizes discovering a pauta when the user does not know what to post this week", () => {
    const result = detectPostCreationAdaptiveIntent("Não sei o que postar essa semana");

    expect(result.mode).toBe("discover_pauta");
  });

  it("detects goal-based post creation", () => {
    const result = detectPostCreationAdaptiveIntent("Quero gerar mais comentários");

    expect(result.mode).toBe("create_by_goal");
    expect(result.objective).toContain("comentarios");
  });

  it("detects brand match intent", () => {
    const result = detectPostCreationAdaptiveIntent("Quero atrair marcas de skincare");

    expect(result.mode).toBe("brand_match");
    expect(result.brandCategory).toBe("skincare");
  });

  it("detects collab intent", () => {
    const result = detectPostCreationAdaptiveIntent("Quero fazer collab com alguém do meu nicho");

    expect(result.mode).toBe("collab_match");
  });

  it("detects comment-to-post intent", () => {
    const result = detectPostCreationAdaptiveIntent("Alguém comentou isso aqui e quero transformar em post");

    expect(result.mode).toBe("comment_to_post");
  });

  it("detects weekly planning intent", () => {
    const result = detectPostCreationAdaptiveIntent("Quero planejar meus posts da semana");

    expect(result.mode).toBe("weekly_plan");
  });

  it("returns unknown for vague input", () => {
    const result = detectPostCreationAdaptiveIntent("me ajuda");

    expect(result.mode).toBe("unknown");
    expect(result.confidence).toBe(0.25);
    expect(result.suggestedStage).toBe("intent");
  });

  it("normalizes accents before detecting comment-to-post intent", () => {
    const result = detectPostCreationAdaptiveIntent("Quero transformar comentário em conteúdo");

    expect(result.mode).toBe("comment_to_post");
    expect(result.normalizedInput).toBe("quero transformar comentario em conteudo");
  });

  it("uses brand priority over validate pauta", () => {
    const result = detectPostCreationAdaptiveIntent("Quero fazer uma pauta para atrair marca de beleza");

    expect(result.mode).toBe("brand_match");
    expect(result.mode).not.toBe("validate_pauta");
  });
});
