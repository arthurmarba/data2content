import fs from "fs";
import path from "path";
import { extractNarrativeAssets } from "./narrativeAssetExtractor";
import { detectNarrativeSourceIntent } from "./narrativeSourceIntentRouter";
import { createEmptyNarrativeSource, type NarrativeSource } from "./narrativeSourceTypes";

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

function extractFromSource(source: NarrativeSource) {
  return extractNarrativeAssets({
    source,
    intentDetection: detectNarrativeSourceIntent(source),
  });
}

function assetValues(result: ReturnType<typeof extractFromSource>, type: string) {
  return result.assets.filter((asset) => asset.type === type).map((asset) => asset.value);
}

function signalValues(result: ReturnType<typeof extractFromSource>, signalType: string) {
  return result.profileSignals
    .filter((signal) => signal.signalType === signalType)
    .map((signal) => signal.value);
}

describe("extractNarrativeAssets", () => {
  it("extracts routine, skincare, and self-care narrative signals", () => {
    const result = extractFromSource(
      makeSource({
        creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
        transcript: "Mostro minha rotina de skincare pela manhã com cuidado e autocuidado.",
        visualDescription: "Pessoa organizando produtos de skincare na bancada.",
      })
    );

    expect(assetValues(result, "central_theme")).toContain("rotina de autocuidado");
    expect(assetValues(result, "brand_territory")).toContain("autocuidado");
    expect(signalValues(result, "recurring_theme")).toContain("rotina");
  });

  it("extracts behind-the-scenes work and process signals", () => {
    const result = extractFromSource(
      makeSource({
        sourceType: "script",
        rawText: "Roteiro sobre bastidor de reunião, trabalho e processo de produção.",
      })
    );

    expect(assetValues(result, "content_proposal")).toContain("behind_the_scenes");
    expect(assetValues(result, "narrative_pattern")).toContain("bastidor real");
    expect(signalValues(result, "content_strength")).toContain("bastidor");
  });

  it("extracts hook weakness when the opening needs improvement", () => {
    const result = extractFromSource(
      makeSource({
        creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
      })
    );

    expect(assetValues(result, "weakness")).toContain("gancho precisa ficar mais claro");
    expect(assetValues(result, "hook_signal")).toContain("abrir com tensão mais cedo");
    expect(signalValues(result, "recurring_insecurity")).toContain("força do gancho");
  });

  it("extracts brand potential signals", () => {
    const result = extractFromSource(
      makeSource({
        creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
      })
    );

    expect(assetValues(result, "brand_territory")).toContain("marca em contexto orgânico");
    expect(assetValues(result, "content_proposal")).toContain("organic_brand_fit");
    expect(signalValues(result, "brand_territory")).toContain("marca em contexto orgânico");
  });

  it("extracts collab opportunity signals", () => {
    const result = extractFromSource(
      makeSource({
        creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
      })
    );

    expect(assetValues(result, "collab_opportunity")).toContain("criador complementar");
    expect(assetValues(result, "content_proposal")).toContain("collab_narrativa");
  });

  it("extracts positioning and authority signals", () => {
    const result = extractFromSource(
      makeSource({
        creatorQuestion: "Quero saber se esse vídeo combina com meu posicionamento e autoridade",
      })
    );

    expect(assetValues(result, "creator_role")).toContain("autoridade em construção");
    expect(signalValues(result, "positioning_signal")).toContain("autoridade");
  });

  it("extracts comment-to-post signals", () => {
    const result = extractFromSource(
      makeSource({
        sourceType: "comment",
        rawText: "Comentaram isso aqui: como você organiza sua rotina? Me perguntaram no direct.",
      })
    );

    expect(assetValues(result, "content_proposal")).toContain("comment_to_post");
    expect(assetValues(result, "audience_reaction")).toContain("resposta à dúvida da audiência");
  });

  it("returns a safe fallback when there is not enough useful text", () => {
    const result = extractFromSource(makeSource());

    expect(result.assets.length).toBeGreaterThanOrEqual(1);
    expect(assetValues(result, "central_theme")).toContain("tema ainda pouco definido");
    expect(result.summary).toBe("A fonte ainda precisa de mais contexto para revelar uma narrativa clara.");
    expect(result.suggestedNextStep).toBe("Adicionar mais contexto sobre objetivo, público ou intenção do conteúdo.");
  });

  it("deduplicates assets and profile signals by type and value", () => {
    const result = extractFromSource(
      makeSource({
        rawText: "rotina rotina rotina skincare skincare rotina skincare",
      })
    );
    const assetKeys = result.assets.map((asset) => `${asset.type}:${asset.value}`);
    const signalKeys = result.profileSignals.map((signal) => `${signal.signalType}:${signal.value}`);

    expect(new Set(assetKeys).size).toBe(assetKeys.length);
    expect(new Set(signalKeys).size).toBe(signalKeys.length);
  });

  it("keeps language safe across summaries, assets, and profile signals", () => {
    const cases = [
      extractFromSource(
        makeSource({
          creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
        })
      ),
      extractFromSource(
        makeSource({
          creatorQuestion: "Quero transformar esse vídeo em uma publi para uma marca de skincare",
        })
      ),
      extractFromSource(makeSource()),
    ];
    const text = JSON.stringify(cases).toLowerCase();

    for (const forbidden of [
      "garantido",
      "certeza",
      "comprovado",
      "viralizar",
      "score",
      "nota",
      "pontuação",
      "acerto",
      "erro",
      "gabarito",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("keeps the extractor isolated from UI and external dependencies", () => {
    const source = fs.readFileSync(path.join(__dirname, "narrativeAssetExtractor.ts"), "utf8");

    expect(source).not.toMatch(/React|from ["']react["']/);
    expect(source).not.toMatch(/BoardShell|PostCreationFunnelBoardShell/);
    expect(source).not.toMatch(/OpenAI|openai/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/Prisma|prisma|banco/);
    expect(source).not.toMatch(/components?\//);
  });
});
