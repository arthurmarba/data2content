import {
  detectNarrativeIntent,
  detectPromptMode,
  extractExplicitCategories,
  parsePromptForScriptIntelligence,
} from "./promptParser";

describe("scripts/promptParser", () => {
  it("extracts explicit categories by id and label", () => {
    const prompt =
      "Quero um roteiro em formato reel, proposta humor/cena, contexto carreira/trabalho, tom humorístico com referência cultura pop.";

    const parsed = extractExplicitCategories(prompt);

    expect(parsed.format).toBe("reel");
    expect(parsed.proposal).toBe("humor_scene");
    expect(parsed.context).toBe("career_work");
    expect(parsed.tone).toBe("humorous");
    expect(parsed.references).toBe("pop_culture");
  });

  it("classifies prompt mode as open, partial and full", () => {
    expect(detectPromptMode({})).toBe("open");

    expect(
      detectPromptMode({
        proposal: "tips",
        context: "career_work",
      })
    ).toBe("partial");

    expect(
      detectPromptMode({
        proposal: "tips",
        context: "career_work",
        format: "reel",
        tone: "humorous",
        references: "pop_culture",
      })
    ).toBe("full");
  });

  it("detects humor and engagement intent from natural prompt", () => {
    const intent = detectNarrativeIntent(
      "Me gera um roteiro de humor sobre criadores iniciantes que engaja mais"
    );

    expect(intent.wantsHumor).toBe(true);
    expect(intent.wantsEngagement).toBe(true);
    expect(intent.subjectHint).toContain("criadores iniciantes");
  });

  it("parses prompt in one shot with explicit categories and mode", () => {
    const parsed = parsePromptForScriptIntelligence(
      "Roteiro reel de dicas sobre carreira/trabalho com tom educacional"
    );

    expect(parsed.promptMode).toBe("partial");
    expect(parsed.explicitCategories.format).toBe("reel");
    expect(parsed.explicitCategories.proposal).toBe("tips");
    expect(parsed.explicitCategories.context).toBe("career_work");
    expect(parsed.explicitCategories.tone).toBe("educational");
  });
});
