import fs from "fs";
import path from "path";

import {
  buildTranscriptTextFromArtifacts,
  buildVisualDescriptionFromArtifacts,
  createEmptyVideoProcessingArtifacts,
  hasUsableVideoProcessingArtifacts,
  mergeTranscriptSegments,
  type VideoProcessingArtifacts,
  type VideoTranscriptSegment,
} from "./videoProcessingArtifacts";

const forbiddenGeneratedTerms = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
];

function artifacts(overrides: Partial<VideoProcessingArtifacts> = {}): VideoProcessingArtifacts {
  return {
    ...createEmptyVideoProcessingArtifacts(),
    ...overrides,
    transcript: {
      ...createEmptyVideoProcessingArtifacts().transcript,
      ...overrides.transcript,
    },
  };
}

describe("videoProcessingArtifacts", () => {
  it("creates empty processing artifacts with safe defaults", () => {
    expect(createEmptyVideoProcessingArtifacts()).toEqual({
      status: "pending",
      transcript: {
        fullText: null,
        language: null,
        segments: [],
        provider: "unknown",
      },
      frames: [],
      ocr: [],
      technicalSignals: [],
      visualSummary: null,
      processingNotes: [],
    });
  });

  it("orders transcript segments by startSeconds and joins text", () => {
    const segments: VideoTranscriptSegment[] = [
      { startSeconds: 8, endSeconds: 10, text: "de skincare.", confidence: 0.8 },
      { startSeconds: 0, endSeconds: 3, text: "Mostro minha rotina", confidence: 0.9 },
      { startSeconds: 4, endSeconds: 7, text: "pela manhã", confidence: 0.85 },
    ];

    expect(mergeTranscriptSegments(segments)).toBe("Mostro minha rotina pela manhã de skincare.");
  });

  it("ignores empty transcript segment text", () => {
    const segments: VideoTranscriptSegment[] = [
      { startSeconds: 0, endSeconds: 1, text: "  ", confidence: null },
      { startSeconds: 2, endSeconds: 3, text: "Conteúdo com bastidor", confidence: 0.7 },
      { startSeconds: 4, endSeconds: 5, text: "", confidence: null },
    ];

    expect(mergeTranscriptSegments(segments)).toBe("Conteúdo com bastidor");
  });

  it("uses transcript fullText when available", () => {
    const result = buildTranscriptTextFromArtifacts(
      artifacts({
        transcript: {
          fullText: "  Texto completo da transcrição.  ",
          language: "pt-BR",
          provider: "manual",
          segments: [{ startSeconds: 0, endSeconds: 2, text: "Trecho alternativo", confidence: 0.8 }],
        },
      }),
    );

    expect(result).toBe("Texto completo da transcrição.");
  });

  it("uses transcript segments when fullText is empty", () => {
    const result = buildTranscriptTextFromArtifacts(
      artifacts({
        transcript: {
          fullText: " ",
          language: "pt-BR",
          provider: "manual",
          segments: [
            { startSeconds: 2, endSeconds: 4, text: "em vídeo", confidence: 0.8 },
            { startSeconds: 0, endSeconds: 1, text: "Roteiro falado", confidence: 0.8 },
          ],
        },
      }),
    );

    expect(result).toBe("Roteiro falado em vídeo");
  });

  it("returns null when transcript has no text", () => {
    expect(buildTranscriptTextFromArtifacts(createEmptyVideoProcessingArtifacts())).toBeNull();
  });

  it("uses visualSummary when available", () => {
    expect(
      buildVisualDescriptionFromArtifacts(
        artifacts({
          visualSummary: "  Pessoa organizando produtos na bancada.  ",
          frames: [
            {
              id: "frame-1",
              timestampSeconds: 1,
              label: "opening",
              description: "Resumo alternativo",
              imageStorageKey: null,
            },
          ],
        }),
      ),
    ).toBe("Pessoa organizando produtos na bancada.");
  });

  it("builds a visual description from frame descriptions", () => {
    const result = buildVisualDescriptionFromArtifacts(
      artifacts({
        frames: [
          {
            id: "frame-middle",
            timestampSeconds: 8,
            label: "middle",
            description: "Pessoa mostra a textura do produto.",
            imageStorageKey: null,
          },
          {
            id: "frame-opening",
            timestampSeconds: 1,
            label: "opening",
            description: "Produtos de skincare aparecem na bancada.",
            imageStorageKey: null,
          },
        ],
      }),
    );

    expect(result).toBe("Frames: Produtos de skincare aparecem na bancada. Pessoa mostra a textura do produto.");
  });

  it("includes OCR text when available", () => {
    const result = buildVisualDescriptionFromArtifacts(
      artifacts({
        frames: [
          {
            id: "frame-opening",
            timestampSeconds: 1,
            label: "opening",
            description: "Tela inicial com título.",
            imageStorageKey: null,
          },
        ],
        ocr: [
          { timestampSeconds: 2, text: "Rotina da manhã", confidence: 0.8 },
          { timestampSeconds: 5, text: "Autocuidado real", confidence: 0.78 },
        ],
      }),
    );

    expect(result).toBe("Frames: Tela inicial com título. Texto na tela: Rotina da manhã Autocuidado real");
  });

  it("returns null when there is no useful visual data", () => {
    expect(buildVisualDescriptionFromArtifacts(createEmptyVideoProcessingArtifacts())).toBeNull();
  });

  it("returns false for empty processing artifacts", () => {
    expect(hasUsableVideoProcessingArtifacts(createEmptyVideoProcessingArtifacts())).toBe(false);
  });

  it("returns true when transcript text exists", () => {
    expect(
      hasUsableVideoProcessingArtifacts(
        artifacts({
          transcript: {
            fullText: "Transcrição do vídeo.",
            language: "pt-BR",
            provider: "manual",
            segments: [],
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns true when frame descriptions exist", () => {
    expect(
      hasUsableVideoProcessingArtifacts(
        artifacts({
          frames: [
            {
              id: "frame-1",
              timestampSeconds: 3,
              label: "opening",
              description: "Pessoa fala com a câmera.",
              imageStorageKey: null,
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("returns true when OCR text exists", () => {
    expect(
      hasUsableVideoProcessingArtifacts(
        artifacts({
          ocr: [{ timestampSeconds: 2, text: "Texto na tela", confidence: 0.75 }],
        }),
      ),
    ).toBe(true);
  });

  it("keeps helper-generated language safe", () => {
    const generated = {
      empty: createEmptyVideoProcessingArtifacts(),
      transcript: buildTranscriptTextFromArtifacts(
        artifacts({
          transcript: {
            fullText: null,
            language: "pt-BR",
            provider: "manual",
            segments: [{ startSeconds: 0, endSeconds: 2, text: "Trecho sobre rotina.", confidence: 0.8 }],
          },
        }),
      ),
      visual: buildVisualDescriptionFromArtifacts(
        artifacts({
          frames: [
            {
              id: "frame-1",
              timestampSeconds: 1,
              label: "opening",
              description: "Pessoa abre o vídeo em casa.",
              imageStorageKey: null,
            },
          ],
          ocr: [{ timestampSeconds: 2, text: "Rotina real", confidence: 0.7 }],
        }),
      ),
    };
    const text = JSON.stringify(generated).toLowerCase();

    for (const forbidden of forbiddenGeneratedTerms) {
      expect(text).not.toContain(forbidden);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import UI, services, storage, upload, ffmpeg, or product integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoProcessingArtifacts.ts"), "utf8");
    const imports = source
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .join("\n");

    expect(imports).toBe("");
    expect(source).not.toContain("React");
    expect(source).not.toContain("BoardShell");
    expect(source).not.toContain("PostCreationFunnelBoardShell");
    expect(source).not.toContain("OpenAI");
    expect(source).not.toContain("fetch");
    expect(source).not.toContain("Prisma");
    expect(source).not.toContain("banco");
    expect(source).not.toContain("components/");
    expect(source).not.toContain("hooks/");
    expect(source).not.toContain("endpoint");
    expect(source).not.toContain("upload service");
    expect(source).not.toContain("ffmpeg");
  });
});
