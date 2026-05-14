import fs from "fs";
import path from "path";
import { createEmptyNarrativeSource, type NarrativeSource } from "./narrativeSourceTypes";
import { detectNarrativeSourceIntent } from "./narrativeSourceIntentRouter";

function makeSource(params: Partial<NarrativeSource> = {}): NarrativeSource {
  return {
    ...createEmptyNarrativeSource({
      id: params.id || "source-test",
      sourceType: params.sourceType || "video_simulated",
    }),
    ...params,
    metadata: params.metadata || {},
  };
}

describe("detectNarrativeSourceIntent", () => {
  it("detects validate_before_posting", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Gravei esse vídeo e quero saber se vale postar" })
    );

    expect(result.intent).toBe("validate_before_posting");
    expect(result.signals).toEqual(expect.arrayContaining(["vale postar"]));
  });

  it("detects improve_content", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho" })
    );

    expect(result.intent).toBe("improve_content");
  });

  it("detects discover_narrative", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Não sei qual narrativa esse vídeo comunica" })
    );

    expect(result.intent).toBe("discover_narrative");
  });

  it("detects brand_potential", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas" })
    );

    expect(result.intent).toBe("brand_potential");
  });

  it("detects adapt_to_ad over brand_potential", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Quero transformar esse vídeo em uma publi para uma marca de skincare" })
    );

    expect(result.intent).toBe("adapt_to_ad");
  });

  it("detects collab_potential over brand_potential", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator para atrair marcas?" })
    );

    expect(result.intent).toBe("collab_potential");
  });

  it("detects positioning_fit", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Quero saber se esse vídeo combina com meu posicionamento" })
    );

    expect(result.intent).toBe("positioning_fit");
  });

  it("prefers improve_content over brand_potential when the primary pain is content adjustment", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Quero melhorar o começo desse vídeo para ele atrair marcas" })
    );

    expect(result.intent).toBe("improve_content");
  });

  it("prefers brand_potential over validate_before_posting when the goal is brand attraction", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Quero saber se vale postar esse vídeo para atrair marcas" })
    );

    expect(result.intent).toBe("brand_potential");
  });

  it("falls back to rawText when creatorQuestion is empty", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({
        creatorQuestion: "",
        rawText: "Quero saber se esse roteiro tem potencial para atrair marcas",
      })
    );

    expect(result.intent).toBe("brand_potential");
    expect(result.originalQuestion).toBe("Quero saber se esse roteiro tem potencial para atrair marcas");
  });

  it("falls back to transcript when creatorQuestion and rawText are empty", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({
        creatorQuestion: "",
        rawText: "",
        transcript: "Eu queria entender minha narrativa antes de publicar",
      })
    );

    expect(result.intent).toBe("discover_narrative");
    expect(result.originalQuestion).toBe("Eu queria entender minha narrativa antes de publicar");
  });

  it("returns unknown when there is not enough text", () => {
    const result = detectNarrativeSourceIntent(makeSource());

    expect(result.intent).toBe("unknown");
    expect(result.confidence).toBe(0.2);
    expect(result.signals).toEqual([]);
  });

  it("returns general_question when there is a generic question", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "Você pode me ajudar com esse conteúdo?" })
    );

    expect(result.intent).toBe("general_question");
    expect(result.confidence).toBe(0.45);
  });

  it("normalizes question casing, accents, quotes, and spacing", () => {
    const result = detectNarrativeSourceIntent(
      makeSource({ creatorQuestion: "  NÃO   sei   qual   narrativa   esse   vídeo   comunica  " })
    );

    expect(result.normalizedQuestion).toBe("nao sei qual narrativa esse video comunica");
  });

  it("keeps the router isolated from UI and external dependencies", () => {
    const source = fs.readFileSync(path.join(__dirname, "narrativeSourceIntentRouter.ts"), "utf8");

    expect(source).not.toMatch(/React|from ["']react["']/);
    expect(source).not.toMatch(/BoardShell|PostCreationFunnelBoardShell/);
    expect(source).not.toMatch(/OpenAI|openai/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/Prisma|prisma/);
    expect(source).not.toMatch(/components?\//);
  });
});
