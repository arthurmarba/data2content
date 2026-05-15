import fs from "fs";
import path from "path";

import {
  VideoNarrativeAnalysis,
  createEmptyVideoNarrativeAnalysis,
} from "./videoNarrativeAnalysisTypes";
import {
  buildPostCreationVideoSeedFromAnalysis,
  createEmptyPostCreationVideoSeed,
  getPostCreationVideoSeedPrimaryAction,
  hasUsefulPostCreationVideoSeed,
} from "./videoNarrativePostCreationSeed";

const forbiddenTerms = [
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

function analysis(overrides: Partial<VideoNarrativeAnalysis> = {}): VideoNarrativeAnalysis {
  return {
    ...createEmptyVideoNarrativeAnalysis({ id: "analysis-1", createdAt: "2026-05-15T10:00:00.000Z" }),
    ...overrides,
  };
}

function seedFrom(value: VideoNarrativeAnalysis) {
  return buildPostCreationVideoSeedFromAnalysis({
    id: "seed-1",
    analysis: value,
    creatorQuestion: "Quero entender esse vídeo.",
  });
}

describe("videoNarrativePostCreationSeed", () => {
  it("creates an empty seed with safe defaults", () => {
    expect(createEmptyPostCreationVideoSeed({ id: "seed-empty", analysisId: "analysis-empty" })).toEqual({
      id: "seed-empty",
      source: "video_narrative_analysis",
      analysisId: "analysis-empty",
      creatorQuestion: null,
      initialIdea: null,
      detectedNarrative: null,
      suggestedFormat: null,
      suggestedProposal: null,
      strategicDiagnosis: null,
      blueprintDraft: { whatToPost: null, whyThisPath: null, howItShouldWork: null, scenes: [] },
      scriptDirection: { opening: null, development: [], closing: null, tone: null },
      brandMatchHints: [],
      followUpQuestions: [],
      evidenceSummary: null,
      confidence: "unknown",
      createdAt: null,
    });
  });

  it("preserves id, analysisId, and createdAt for empty seed", () => {
    expect(
      createEmptyPostCreationVideoSeed({
        id: "seed-2",
        analysisId: "analysis-2",
        createdAt: "2026-05-15T11:00:00.000Z",
      }),
    ).toMatchObject({ id: "seed-2", analysisId: "analysis-2", createdAt: "2026-05-15T11:00:00.000Z" });
  });

  it("uses blueprint whatToPost as initial idea", () => {
    expect(
      seedFrom(analysis({ blueprintSuggestion: { ...analysis().blueprintSuggestion, whatToPost: "Reel de bastidor." } }))
        .initialIdea,
    ).toBe("Reel de bastidor.");
  });

  it("uses summary as initial idea without blueprint", () => {
    expect(seedFrom(analysis({ summary: "Resumo do vídeo." })).initialIdea).toBe("Resumo do vídeo.");
  });

  it("uses hook as initial idea without blueprint or summary", () => {
    expect(
      seedFrom(analysis({ hook: { detected: "Começa pela dúvida.", strength: "medium", why: null } })).initialIdea,
    ).toBe("Começa pela dúvida.");
  });

  it("maps narrative classification to detected narrative", () => {
    expect(
      seedFrom(
        analysis({
          d2cClassification: { ...analysis().d2cClassification, narrative: "comentário -> insight -> pauta" },
        }),
      ).detectedNarrative,
    ).toBe("comentário -> insight -> pauta");
  });

  it("turns unknown format into null", () => {
    expect(seedFrom(analysis()).suggestedFormat).toBeNull();
  });

  it("turns unknown proposal into null", () => {
    expect(seedFrom(analysis()).suggestedProposal).toBeNull();
  });

  it("combines strength and adjustment in strategic diagnosis", () => {
    expect(
      seedFrom(
        analysis({
          diagnosis: {
            strengths: ["Boa clareza visual"],
            weaknesses: [],
            recommendedAdjustments: ["Abrir com a transformação"],
          },
        }),
      ).strategicDiagnosis,
    ).toBe("Ponto forte: Boa clareza visual. Ajuste sugerido: Abrir com a transformação.");
  });

  it("copies blueprint suggestion into blueprint draft", () => {
    expect(
      seedFrom(
        analysis({
          blueprintSuggestion: {
            whatToPost: "Reel em três cenas.",
            whyThisPath: "A leitura já está clara.",
            howItShouldWork: "Abrir, provar, fechar.",
            scenes: ["Abertura", "Prova", "Fechamento"],
          },
        }),
      ).blueprintDraft,
    ).toEqual({
      whatToPost: "Reel em três cenas.",
      whyThisPath: "A leitura já está clara.",
      howItShouldWork: "Abrir, provar, fechar.",
      scenes: ["Abertura", "Prova", "Fechamento"],
    });
  });

  it("uses hook as script opening", () => {
    expect(
      seedFrom(analysis({ hook: { detected: "Gancho direto.", strength: "strong", why: null } })).scriptDirection.opening,
    ).toBe("Gancho direto.");
  });

  it("uses recommended adjustment as opening when hook is weak", () => {
    expect(
      seedFrom(
        analysis({
          hook: { detected: "Começo lento.", strength: "weak", why: null },
          diagnosis: { strengths: [], weaknesses: [], recommendedAdjustments: ["Abrir pela transformação."] },
        }),
      ).scriptDirection.opening,
    ).toBe("Abrir pela transformação.");
  });

  it("uses blueprint scenes as development", () => {
    expect(
      seedFrom(
        analysis({
          blueprintSuggestion: { ...analysis().blueprintSuggestion, scenes: ["Cena 1", "Cena 2"] },
        }),
      ).scriptDirection.development,
    ).toEqual(["Cena 1", "Cena 2"]);
  });

  it("uses scene descriptions as development when blueprint scenes are empty", () => {
    expect(
      seedFrom(
        analysis({
          sceneStructure: [
            { id: "scene-1", timestampLabel: null, role: "context", description: "Contexto", suggestedAdjustment: null },
            { id: "scene-2", timestampLabel: null, role: "development", description: "Desenvolvimento", suggestedAdjustment: null },
          ],
        }),
      ).scriptDirection.development,
    ).toEqual(["Contexto", "Desenvolvimento"]);
  });

  it("uses closing or call to action scene as closing", () => {
    expect(
      seedFrom(
        analysis({
          sceneStructure: [
            { id: "scene-1", timestampLabel: null, role: "closing", description: "Fechar com convite.", suggestedAdjustment: null },
          ],
        }),
      ).scriptDirection.closing,
    ).toBe("Fechar com convite.");
  });

  it("keeps brand hints empty when brand match is disabled", () => {
    expect(seedFrom(analysis()).brandMatchHints).toEqual([]);
  });

  it("includes territories and reason when brand match is enabled", () => {
    expect(
      seedFrom(
        analysis({
          brandMatch: {
            enabled: true,
            territories: ["autocuidado"],
            whyBrandsWouldFit: "A narrativa conversa com rotina.",
          },
        }),
      ).brandMatchHints,
    ).toEqual(["autocuidado", "A narrativa conversa com rotina."]);
  });

  it("adds hook follow-up when hook is missing", () => {
    expect(seedFrom(analysis()).followUpQuestions).toContainEqual({
      id: "hook",
      question: "Qual é a primeira frase ou cena que abre esse vídeo?",
      reason: "Ajuda a entender a força do gancho.",
    });
  });

  it("adds narrative follow-up when narrative is missing", () => {
    expect(seedFrom(analysis()).followUpQuestions).toContainEqual({
      id: "narrative",
      question: "Qual narrativa você quer que esse vídeo comunique?",
      reason: "Ajuda a transformar o vídeo em uma pauta mais clara.",
    });
  });

  it("adds blueprint follow-up when whatToPost is missing", () => {
    expect(seedFrom(analysis()).followUpQuestions).toContainEqual({
      id: "blueprint",
      question: "Que tipo de post você imagina criar a partir desse vídeo?",
      reason: "Ajuda a escolher o caminho do blueprint.",
    });
  });

  it("limits follow-up questions to three", () => {
    expect(seedFrom(analysis()).followUpQuestions).toHaveLength(3);
  });

  it("summarizes transcript, OCR, frames, and technical signals", () => {
    expect(
      seedFrom(
        analysis({
          evidence: {
            transcript: "Fala disponível.",
            ocr: ["Texto na tela"],
            frames: ["Cena inicial"],
            technicalSignals: ["opening_density baixo"],
          },
        }),
      ).evidenceSummary,
    ).toBe(
      "Há fala/transcrição disponível. Há texto na tela identificado. Há contexto visual por cenas/frames. Há sinais técnicos auxiliares.",
    );
  });

  it("returns false for empty useful seed", () => {
    expect(hasUsefulPostCreationVideoSeed(createEmptyPostCreationVideoSeed({ id: "seed", analysisId: "analysis" }))).toBe(
      false,
    );
  });

  it("returns true for seed with initial idea", () => {
    expect(
      hasUsefulPostCreationVideoSeed({
        ...createEmptyPostCreationVideoSeed({ id: "seed", analysisId: "analysis" }),
        initialIdea: "Reel de rotina.",
      }),
    ).toBe(true);
  });

  it("returns true for seed with follow-up questions", () => {
    expect(
      hasUsefulPostCreationVideoSeed({
        ...createEmptyPostCreationVideoSeed({ id: "seed", analysisId: "analysis" }),
        followUpQuestions: [{ id: "hook", question: "Qual abertura?", reason: "Ajuda a refinar." }],
      }),
    ).toBe(true);
  });

  it("prioritizes blueprint in primary action", () => {
    expect(
      getPostCreationVideoSeedPrimaryAction({
        ...createEmptyPostCreationVideoSeed({ id: "seed", analysisId: "analysis" }),
        blueprintDraft: { whatToPost: "Reel", whyThisPath: null, howItShouldWork: null, scenes: [] },
      }),
    ).toBe("Transformar a sugestão de blueprint em roteiro.");
  });

  it("uses opening in primary action without blueprint", () => {
    expect(
      getPostCreationVideoSeedPrimaryAction({
        ...createEmptyPostCreationVideoSeed({ id: "seed", analysisId: "analysis" }),
        scriptDirection: { opening: "Abrir pela dúvida.", development: [], closing: null, tone: null },
      }),
    ).toBe("Usar a direção de abertura para construir o roteiro.");
  });

  it("uses detected narrative in primary action without blueprint or opening", () => {
    expect(
      getPostCreationVideoSeedPrimaryAction({
        ...createEmptyPostCreationVideoSeed({ id: "seed", analysisId: "analysis" }),
        detectedNarrative: "processo -> insight",
      }),
    ).toBe("Refinar a narrativa detectada antes de gerar o roteiro.");
  });

  it("uses follow-ups in primary action when main fields are absent", () => {
    expect(
      getPostCreationVideoSeedPrimaryAction({
        ...createEmptyPostCreationVideoSeed({ id: "seed", analysisId: "analysis" }),
        followUpQuestions: [{ id: "hook", question: "Qual abertura?", reason: "Ajuda a refinar." }],
      }),
    ).toBe("Responder às perguntas de refinamento antes de avançar.");
  });

  it("returns fallback action for empty seed", () => {
    expect(getPostCreationVideoSeedPrimaryAction(createEmptyPostCreationVideoSeed({ id: "seed", analysisId: "analysis" }))).toBe(
      "Trazer mais contexto antes de transformar o vídeo em pauta.",
    );
  });

  it("sanitizes texts that come from analysis", () => {
    const seed = seedFrom(
      analysis({
        summary: "Certeza comprovada.",
        blueprintSuggestion: {
          whatToPost: "Plano garantido.",
          whyThisPath: "Pode viralizar garantido.",
          howItShouldWork: "Sempre performa.",
          scenes: ["Cena comprovada."],
        },
        brandMatch: {
          enabled: true,
          territories: ["território garantido"],
          whyBrandsWouldFit: "Certeza de encaixe.",
        },
      }),
    );
    const text = JSON.stringify(seed).toLowerCase();

    for (const term of ["garantido", "certeza", "comprovado", "viralizar garantido"]) {
      expect(text).not.toContain(term);
    }
  });

  it("keeps generated language conservative", () => {
    const seed = seedFrom(analysis());
    const text = JSON.stringify({
      seed,
      action: getPostCreationVideoSeedPrimaryAction(seed),
    }).toLowerCase();

    for (const term of forbiddenTerms) {
      expect(text).not.toContain(term);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import UI, providers, storage, or product integrations", () => {
    const sourcePath = path.join(__dirname, "videoNarrativePostCreationSeed.ts");
    const source = fs.readFileSync(sourcePath, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(source).toContain("./videoNarrativeAnalysisTypes");
    expect(importLines).not.toContain("React");
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
