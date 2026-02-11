import {
  buildScriptStyleProfileFromEntries,
  estimateRewriteRatio,
  STYLE_PROFILE_MAX_SCRIPTS,
  STYLE_PROFILE_MIN_CONTENT_LENGTH,
} from "./styleTraining";

describe("scripts/styleTraining", () => {
  it("computes rewrite ratio from original and edited text", () => {
    const ratio = estimateRewriteRatio(
      "Hoje eu vou falar sobre rotina e produtividade no trabalho.",
      "Hoje eu vou falar sobre produtividade com um exemplo pratico e objetivo."
    );

    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });

  it("ignores admin recommendations and short/duplicate entries", () => {
    const longContent =
      "Gancho forte para abrir o roteiro.\n\n" +
      "Desenvolvimento completo com detalhes práticos e linguagem natural para o criador.\n\n" +
      "Comenta aqui e compartilha com quem precisa.";
    expect(longContent.length).toBeGreaterThanOrEqual(STYLE_PROFILE_MIN_CONTENT_LENGTH);

    const { profile } = buildScriptStyleProfileFromEntries({
      entries: [
        {
          id: "a",
          source: "manual",
          content: longContent,
          updatedAt: "2026-02-10T10:00:00.000Z",
        },
        {
          id: "b",
          source: "manual",
          content: longContent,
          updatedAt: "2026-02-09T10:00:00.000Z",
        },
        {
          id: "c",
          source: "ai",
          content: "curto demais",
          updatedAt: "2026-02-08T10:00:00.000Z",
        },
        {
          id: "d",
          source: "planner",
          content: longContent + " extra",
          isAdminRecommendation: true,
          updatedAt: "2026-02-07T10:00:00.000Z",
        },
      ],
    });

    expect(profile.sampleSize).toBe(1);
    expect(profile.exclusionStats.duplicateSkipped).toBe(1);
    expect(profile.exclusionStats.tooShortSkipped).toBe(1);
    expect(profile.exclusionStats.adminRecommendationSkipped).toBe(1);
  });

  it("caps training window to the configured retention limit", () => {
    const entries = Array.from({ length: STYLE_PROFILE_MAX_SCRIPTS + 20 }).map((_, index) => ({
      id: `id-${index}`,
      source: "manual" as const,
      content:
        `Abertura ${index} com contexto suficiente para treino.\n\n` +
        "Desenvolvimento detalhado com linguagem clara e narrativa consistente para o criador.\n\n" +
        "Comenta aqui para receber mais roteiros e compartilha com um amigo.",
      updatedAt: new Date(2026, 1, 10, 10, index).toISOString(),
    }));

    const { profile } = buildScriptStyleProfileFromEntries({ entries });
    expect(profile.sampleSize).toBe(STYLE_PROFILE_MAX_SCRIPTS);
  });
});
