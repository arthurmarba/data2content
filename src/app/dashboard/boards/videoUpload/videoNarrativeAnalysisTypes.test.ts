import fs from "fs";
import path from "path";

import {
  VideoNarrativeAnalysis,
  createEmptyVideoNarrativeAnalysis,
  getVideoNarrativePrimaryDirection,
  getVideoNarrativeSuggestedNextStep,
  hasUsefulVideoNarrativeAnalysis,
  sanitizeVideoNarrativeAnalysisText,
} from "./videoNarrativeAnalysisTypes";

const forbiddenUserFacingTerms = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar garantido",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
  "venceu",
  "perdeu",
];

function emptyAnalysis(overrides: Partial<VideoNarrativeAnalysis> = {}): VideoNarrativeAnalysis {
  return {
    ...createEmptyVideoNarrativeAnalysis({ id: "analysis-1" }),
    ...overrides,
  };
}

describe("videoNarrativeAnalysisTypes", () => {
  it("creates an empty narrative analysis with safe defaults", () => {
    expect(createEmptyVideoNarrativeAnalysis({ id: "analysis-empty" })).toEqual({
      id: "analysis-empty",
      sourceType: "video_narrative_analysis",
      summary: null,
      hook: {
        detected: null,
        strength: "unknown",
        why: null,
      },
      spokenTopics: [],
      onScreenText: [],
      visualElements: [],
      sceneStructure: [],
      d2cClassification: {
        format: "unknown",
        proposal: "unknown",
        context: null,
        tone: null,
        reference: null,
        intent: null,
        narrative: null,
      },
      diagnosis: {
        strengths: [],
        weaknesses: [],
        recommendedAdjustments: [],
      },
      blueprintSuggestion: {
        whatToPost: null,
        whyThisPath: null,
        howItShouldWork: null,
        scenes: [],
      },
      brandMatch: {
        enabled: false,
        territories: [],
        whyBrandsWouldFit: null,
      },
      evidence: {
        transcript: null,
        ocr: [],
        frames: [],
        technicalSignals: [],
      },
      profileSignals: [],
      confidence: "unknown",
      createdAt: null,
    });
  });

  it("preserves id and createdAt when creating an empty analysis", () => {
    expect(
      createEmptyVideoNarrativeAnalysis({
        id: "analysis-2",
        createdAt: "2026-05-15T10:00:00.000Z",
      }),
    ).toMatchObject({
      id: "analysis-2",
      createdAt: "2026-05-15T10:00:00.000Z",
    });
  });

  it("returns false for empty analysis", () => {
    expect(hasUsefulVideoNarrativeAnalysis(emptyAnalysis())).toBe(false);
  });

  it("returns true when summary is present", () => {
    expect(hasUsefulVideoNarrativeAnalysis(emptyAnalysis({ summary: "Resumo narrativo." }))).toBe(true);
  });

  it("returns true when hook is detected", () => {
    expect(hasUsefulVideoNarrativeAnalysis(emptyAnalysis({ hook: { detected: "Abertura direta.", strength: "medium", why: null } }))).toBe(
      true,
    );
  });

  it("returns true when scene structure has a description", () => {
    expect(
      hasUsefulVideoNarrativeAnalysis(
        emptyAnalysis({
          sceneStructure: [
            {
              id: "scene-1",
              timestampLabel: "00:00",
              role: "hook",
              description: "Abertura apresenta o problema.",
              suggestedAdjustment: null,
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("returns true when narrative classification is present", () => {
    expect(
      hasUsefulVideoNarrativeAnalysis(
        emptyAnalysis({
          d2cClassification: {
            ...emptyAnalysis().d2cClassification,
            narrative: "comentário -> insight -> pauta",
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns true when diagnosis includes recommendations", () => {
    expect(
      hasUsefulVideoNarrativeAnalysis(
        emptyAnalysis({
          diagnosis: {
            strengths: [],
            weaknesses: [],
            recommendedAdjustments: ["Abrir com a transformação antes do contexto."],
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns true when blueprint suggestion is present", () => {
    expect(
      hasUsefulVideoNarrativeAnalysis(
        emptyAnalysis({
          blueprintSuggestion: {
            ...emptyAnalysis().blueprintSuggestion,
            whatToPost: "Um reel de bastidor com virada prática.",
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns true when transcript evidence is present", () => {
    expect(
      hasUsefulVideoNarrativeAnalysis(
        emptyAnalysis({
          evidence: {
            ...emptyAnalysis().evidence,
            transcript: "Mostro o processo de criação.",
          },
        }),
      ),
    ).toBe(true);
  });

  it("prioritizes blueprint suggestion as primary direction", () => {
    expect(
      getVideoNarrativePrimaryDirection(
        emptyAnalysis({
          summary: "Resumo secundário.",
          d2cClassification: {
            ...emptyAnalysis().d2cClassification,
            narrative: "narrativa secundária",
          },
          blueprintSuggestion: {
            ...emptyAnalysis().blueprintSuggestion,
            whatToPost: "Reel de bastidor com virada prática.",
          },
        }),
      ),
    ).toBe("Reel de bastidor com virada prática.");
  });

  it("uses narrative when blueprint is absent", () => {
    expect(
      getVideoNarrativePrimaryDirection(
        emptyAnalysis({
          d2cClassification: {
            ...emptyAnalysis().d2cClassification,
            narrative: "processo -> insight -> pauta",
          },
        }),
      ),
    ).toBe("processo -> insight -> pauta");
  });

  it("uses summary when blueprint and narrative are absent", () => {
    expect(getVideoNarrativePrimaryDirection(emptyAnalysis({ summary: "Resumo útil." }))).toBe("Resumo útil.");
  });

  it("uses hook when no broader direction exists", () => {
    expect(
      getVideoNarrativePrimaryDirection(
        emptyAnalysis({
          hook: {
            detected: "Começa pela dúvida do criador.",
            strength: "medium",
            why: null,
          },
        }),
      ),
    ).toBe("Começa pela dúvida do criador.");
  });

  it("returns null for empty primary direction", () => {
    expect(getVideoNarrativePrimaryDirection(emptyAnalysis())).toBeNull();
  });

  it("asks for more context when analysis is empty", () => {
    expect(getVideoNarrativeSuggestedNextStep(emptyAnalysis())).toBe(
      "Trazer mais contexto antes de transformar o vídeo em pauta.",
    );
  });

  it("recommends strengthening the hook when it is weak", () => {
    expect(
      getVideoNarrativeSuggestedNextStep(
        emptyAnalysis({
          summary: "Há contexto suficiente.",
          hook: {
            detected: "Começo lento.",
            strength: "weak",
            why: "A abertura demora a mostrar a proposta.",
          },
        }),
      ),
    ).toBe("Reforçar o gancho antes de transformar o vídeo em roteiro.");
  });

  it("recommends blueprint when whatToPost exists", () => {
    expect(
      getVideoNarrativeSuggestedNextStep(
        emptyAnalysis({
          blueprintSuggestion: {
            ...emptyAnalysis().blueprintSuggestion,
            whatToPost: "Reel explicando o bastidor em três cenas.",
          },
        }),
      ),
    ).toBe("Usar a sugestão de blueprint como ponto de partida.");
  });

  it("recommends evaluating brand fit when brand matching is enabled without blueprint", () => {
    expect(
      getVideoNarrativeSuggestedNextStep(
        emptyAnalysis({
          summary: "Rotina com território claro.",
          brandMatch: {
            enabled: true,
            territories: ["autocuidado"],
            whyBrandsWouldFit: "A narrativa conversa com autocuidado.",
          },
        }),
      ),
    ).toBe("Avaliar o encaixe da narrativa com territórios de marca.");
  });

  it("sanitizes absolute promise terms", () => {
    expect(
      sanitizeVideoNarrativeAnalysisText(
        "Resultado garantido, com certeza comprovado, viralizar garantido e sempre performa.",
      ),
    ).toBe("Resultado indicado, com leitura observado, ampliar chance de clareza e tende a funcionar melhor.");
  });

  it("keeps generated language conservative", () => {
    const analysis = emptyAnalysis({
      summary: sanitizeVideoNarrativeAnalysisText("Caminho comprovado para viralizar garantido."),
      blueprintSuggestion: {
        ...emptyAnalysis().blueprintSuggestion,
        whatToPost: "Reel de bastidor com direção mais clara.",
      },
    });
    const text = JSON.stringify({
      analysis,
      emptyNextStep: getVideoNarrativeSuggestedNextStep(emptyAnalysis()),
      weakHookNextStep: getVideoNarrativeSuggestedNextStep(
        emptyAnalysis({
          summary: "Leitura disponível.",
          hook: {
            detected: "Abertura lenta.",
            strength: "weak",
            why: null,
          },
        }),
      ),
      primaryDirection: getVideoNarrativePrimaryDirection(analysis),
    }).toLowerCase();

    for (const term of forbiddenUserFacingTerms) {
      expect(text).not.toContain(term);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import UI, providers, storage, or product integrations", () => {
    const sourcePath = path.join(__dirname, "videoNarrativeAnalysisTypes.ts");
    const source = fs.readFileSync(sourcePath, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(importLines).toBe("");
    expect(source).not.toContain("BoardShell");
    expect(source).not.toContain("PostCreationFunnelBoardShell");
    expect(source).not.toContain("OpenAI");
    expect(source).not.toContain("Gemini");
    expect(source).not.toContain("fetch");
    expect(source).not.toContain("Prisma");
    expect(source).not.toContain("storage");
    expect(source).not.toContain("ffmpeg");
  });
});
