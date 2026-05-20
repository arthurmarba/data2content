import { readFileSync } from "fs";
import path from "path";
import {
  buildCreatorNarrativeMapReadingPresentation,
} from "./creatorNarrativeMapReadingChapters";
import { buildNarrativeMapReadingDiagnosisFixture } from "./creatorNarrativeMapReadingChaptersFixtures";

const FORBIDDEN_OUTPUT_TERMS = [
  "score",
  "nota",
  "viralizar",
  "garantido",
  "certeza",
  "comprovado",
  "match real",
  "publi garantida",
];

const SENSITIVE_REFERENCE_TERMS = [
  "objectKey",
  "signedUrl",
  "uploadUrl",
  "thumbnailUrl",
  "localPath",
  "storageProviderPath",
  "X-Amz-Signature",
  "data:video/mp4;base64",
];

function serializedPresentation(overrides = {}) {
  return JSON.stringify(buildCreatorNarrativeMapReadingPresentation({
    diagnosis: buildNarrativeMapReadingDiagnosisFixture(),
    analyzedVideosCount: 4,
    accessLevel: "premium",
    ...overrides,
  }));
}

describe("creatorNarrativeMapReadingChapters", () => {
  it("cria uma apresentacao valida a partir de CreatorVideoNarrativeDiagnosis", () => {
    const presentation = buildCreatorNarrativeMapReadingPresentation({
      diagnosis: buildNarrativeMapReadingDiagnosisFixture(),
      analyzedVideosCount: 4,
      accessLevel: "premium",
    });

    expect(presentation).toEqual(expect.objectContaining({
      id: "narrative-map-reading-diagnosis-reading-map-1",
      diagnosisId: "diagnosis-reading-map-1",
      headline: "Um padrão começa a aparecer",
      statusLabel: "Padrão em formação",
      createdAt: "2026-05-20T10:03:00.000Z",
    }));
    expect(presentation.primaryAction.intent).toBe("analyze_another_video");
    expect(presentation.chapters.length).toBeGreaterThanOrEqual(7);
  });

  it("cria chapters pattern, tension, movement e territory quando ha dados suficientes", () => {
    const presentation = buildCreatorNarrativeMapReadingPresentation({
      diagnosis: buildNarrativeMapReadingDiagnosisFixture(),
      analyzedVideosCount: 4,
    });

    expect(presentation.chapters.map((chapter) => chapter.id)).toEqual(expect.arrayContaining([
      "pattern",
      "tension",
      "movement",
      "territory",
    ]));
    expect(presentation.chapters.find((chapter) => chapter.id === "pattern")).toEqual(expect.objectContaining({
      title: "Seu padrão",
      tone: "mirror",
    }));
  });

  it("cria capitulos honestos para primeira leitura e baixo contexto", () => {
    const diagnosis = buildNarrativeMapReadingDiagnosisFixture({
      profileContribution: {
        type: "opens_new_hypothesis",
        confidence: "low",
        weight: "low",
        reason: "Como primeira leitura, o vídeo levanta uma hipótese sem definir o Perfil geral.",
        profileImpactPreview: "Cria uma primeira pista para acompanhar nas próximas análises.",
      },
    });

    const presentation = buildCreatorNarrativeMapReadingPresentation({
      diagnosis,
      analyzedVideosCount: 1,
    });

    expect(presentation.statusLabel).toBe("Primeira leitura");
    expect(presentation.headline).toBe("Seu mapa começou");
    expect(presentation.subheadline).toBe("Este vídeo já mostra um primeiro sinal, mas ainda é cedo para chamar de padrão.");
    expect(presentation.chapters.find((chapter) => chapter.id === "pattern")?.preview).toContain("Ainda é cedo");
  });

  it("transforma profileContribution em profile_impact humano", () => {
    const presentation = buildCreatorNarrativeMapReadingPresentation({
      diagnosis: buildNarrativeMapReadingDiagnosisFixture({
        profileContribution: {
          type: "commercial_signal",
          confidence: "medium",
          weight: "medium",
          reason: "Este vídeo abre um território comercial em beleza funcional.",
          profileImpactPreview: "Pode virar evidência futura se o território se repetir.",
        },
      }),
      analyzedVideosCount: 3,
    });

    const chapter = presentation.chapters.find((item) => item.id === "profile_impact");

    expect(chapter).toEqual(expect.objectContaining({
      title: "Como pesa no Perfil",
      badgeLabel: "Sinal comercial",
      tone: "opportunity",
    }));
    expect(chapter?.fullReading).toContain("não atualiza a narrativa principal sozinha");
  });

  it("nao usa termos proibidos na apresentacao", () => {
    const output = serializedPresentation().toLowerCase();

    for (const term of FORBIDDEN_OUTPUT_TERMS) {
      expect(output).not.toContain(term);
    }
  });

  it("nao propaga objectKey, signedUrl, uploadUrl, thumbnailUrl, localPath ou storageProviderPath", () => {
    const diagnosis = buildNarrativeMapReadingDiagnosisFixture({
      videoReading: {
        ...buildNarrativeMapReadingDiagnosisFixture().videoReading,
        summary: "objectKey uploads/user/video.mp4 signedUrl https://bucket.s3.amazonaws.com/v.mp4?X-Amz-Signature=abc",
        whatVideoReveals: "uploadUrl thumbnailUrl localPath storageProviderPath data:video/mp4;base64," + "A".repeat(1300),
      },
      commercialReading: {
        ...buildNarrativeMapReadingDiagnosisFixture().commercialReading,
        adAdaptationIdea: "Ver em https://cdn.example.com/video.mp4?token=abc",
      },
    });

    const output = JSON.stringify(buildCreatorNarrativeMapReadingPresentation({ diagnosis }));

    for (const term of SENSITIVE_REFERENCE_TERMS) {
      expect(output).not.toContain(term);
    }
    expect(output).toContain("referencia removida");
  });

  it("nao importa Gemini SDK, storage SDK, Mongoose/model direto, endpoints ou client components", () => {
    const source = readFileSync(path.join(__dirname, "creatorNarrativeMapReadingChapters.ts"), "utf8");

    expect(source).not.toMatch(/@google\/genai|@aws-sdk|from ["']mongoose["']|CreatorVideoNarrativeDiagnosis\.|["']use client["']/);
    expect(source).not.toMatch(/analyze-real\/route|analyze\/route|videoNarrativeEndpointMockMode|api\/dashboard\/mobile-strategic-profile/);
  });

  it("nao importa CreatorStrategicProfileSnapshot", () => {
    const source = readFileSync(path.join(__dirname, "creatorNarrativeMapReadingChapters.ts"), "utf8");

    expect(source).not.toContain("CreatorStrategicProfileSnapshot");
  });

  it("limita tamanho de preview, fullReading, evidence e action", () => {
    const longText = "leitura humana ".repeat(120);
    const presentation = buildCreatorNarrativeMapReadingPresentation({
      diagnosis: buildNarrativeMapReadingDiagnosisFixture({
        videoReading: {
          ...buildNarrativeMapReadingDiagnosisFixture().videoReading,
          mainNarrative: longText,
          dominantInsight: longText,
        },
        strategicRecommendation: {
          ...buildNarrativeMapReadingDiagnosisFixture().strategicRecommendation,
          nextExperiment: longText,
        },
      }),
      analyzedVideosCount: 4,
    });

    for (const chapter of presentation.chapters) {
      expect(chapter.title.length).toBeLessThanOrEqual(56);
      expect(chapter.preview.length).toBeLessThanOrEqual(180);
      expect(chapter.fullReading.length).toBeLessThanOrEqual(900);
      expect(chapter.evidence.length).toBeLessThanOrEqual(4);
      if (chapter.action) expect(chapter.action.length).toBeLessThanOrEqual(180);
    }
  });

  it("gera opportunities sem prometer marca real ou creator real", () => {
    const presentation = buildCreatorNarrativeMapReadingPresentation({
      diagnosis: buildNarrativeMapReadingDiagnosisFixture({
        commercialReading: {
          ...buildNarrativeMapReadingDiagnosisFixture().commercialReading,
          brandTerritories: ["rotina real", "apps", "vida adulta"],
          adAdaptationIdea: "Adaptar para uma cena de rotina real sem citar marca.",
        },
      }),
      analyzedVideosCount: 3,
    });
    const opportunities = presentation.chapters.find((chapter) => chapter.id === "opportunities");
    const text = JSON.stringify(opportunities).toLowerCase();

    expect(text).toContain("território em formação");
    expect(text).not.toContain("marca real");
    expect(text).not.toContain("creator real");
    expect(text).not.toContain("publi garantida");
  });

  it("altera status e subheadline quando instagramConnected=true", () => {
    const presentation = buildCreatorNarrativeMapReadingPresentation({
      diagnosis: buildNarrativeMapReadingDiagnosisFixture(),
      instagramConnected: true,
      analyzedVideosCount: 4,
    });

    expect(presentation.statusLabel).toBe("Cruzado com Instagram");
    expect(presentation.subheadline).toContain("perfil e da audiencia");
    expect(presentation.subheadline).not.toContain("desempenho garantido");
  });

  it("inclui safetyNote sobre nao guardar video", () => {
    const presentation = buildCreatorNarrativeMapReadingPresentation({
      diagnosis: buildNarrativeMapReadingDiagnosisFixture(),
    });

    expect(presentation.safetyNote).toBe("A D2C guarda a leitura estratégica, não o vídeo.");
  });

  it("e funcao pura e testavel, sem banco", () => {
    const source = readFileSync(path.join(__dirname, "creatorNarrativeMapReadingChapters.ts"), "utf8");
    const diagnosis = buildNarrativeMapReadingDiagnosisFixture();

    const first = buildCreatorNarrativeMapReadingPresentation({ diagnosis, analyzedVideosCount: 2 });
    const second = buildCreatorNarrativeMapReadingPresentation({ diagnosis, analyzedVideosCount: 2 });

    expect(first).toEqual(second);
    expect(source).not.toMatch(/connectToDatabase|createCreatorVideoNarrativeDiagnosis|findOne|save\(|insert|update/);
  });
});
