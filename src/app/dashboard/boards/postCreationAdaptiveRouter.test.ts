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

  it("detects explicit format guidance intent", () => {
    const result = detectPostCreationAdaptiveIntent("Quero saber qual formato usar");

    expect(result.mode).toBe("format_guidance");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects format guidance with ideal format language", () => {
    const result = detectPostCreationAdaptiveIntent("Qual formato é melhor pra essa ideia?");

    expect(result.mode).toBe("format_guidance");
  });

  it("detects format guidance phrased as what to post", () => {
    const result = detectPostCreationAdaptiveIntent("Qual formato devo postar?");

    expect(result.mode).toBe("format_guidance");
  });

  it("detects format guidance from format alternatives", () => {
    const result = detectPostCreationAdaptiveIntent("Devo fazer reels ou carrossel?");

    expect(result.mode).toBe("format_guidance");
    expect(result.signals.some((signal) => signal.includes("reels") && signal.includes("carrossel"))).toBe(true);
  });

  it("detects short story or reels format guidance", () => {
    const result = detectPostCreationAdaptiveIntent("Story ou reels?");

    expect(result.mode).toBe("format_guidance");
  });

  it("preserves pauta context when detecting format guidance", () => {
    const result = detectPostCreationAdaptiveIntent("Quero saber qual formato usar para uma pauta sobre rotina");

    expect(result.mode).toBe("format_guidance");
    expect(result.detectedPauta).toContain("uma pauta sobre rotina");
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

  it("prioritizes format guidance over broad discover, validate, and goal signals", () => {
    expect(detectPostCreationAdaptiveIntent("Não sei o que postar, qual formato usar?").mode).toBe("format_guidance");
    expect(detectPostCreationAdaptiveIntent("Quero gravar uma pauta, devo fazer reels ou carrossel?").mode).toBe("format_guidance");
    expect(detectPostCreationAdaptiveIntent("Quero mais alcance, qual formato tem mais chance?").mode).toBe("format_guidance");
    expect(detectPostCreationAdaptiveIntent("Quero saber qual formato usar para uma pauta").mode).toBe("format_guidance");
    expect(detectPostCreationAdaptiveIntent("Não sei se faço reels, carrossel ou story").mode).toBe("format_guidance");
  });

  it("keeps older routing when there is no format signal", () => {
    expect(detectPostCreationAdaptiveIntent("Não sei o que postar essa semana").mode).toBe("discover_pauta");
    expect(detectPostCreationAdaptiveIntent("Quero gerar mais comentários").mode).toBe("create_by_goal");
    expect(detectPostCreationAdaptiveIntent("Quero gravar um POV sobre rotina").mode).toBe("validate_pauta");
  });
});
