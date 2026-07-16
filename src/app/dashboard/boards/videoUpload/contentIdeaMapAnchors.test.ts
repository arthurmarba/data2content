import {
  contentIdeaMapAnchorLabel,
  resolveContentIdeaMapAnchors,
  sanitizeGeneratedContentIdeaMapAnchors,
  selectContentIdeaCardAnchors,
} from "./contentIdeaMapAnchors";

describe("contentIdeaMapAnchors", () => {
  it("aceita somente âncoras que existem no mapa e restaura o label canônico", () => {
    expect(sanitizeGeneratedContentIdeaMapAnchors([
      { kind: "situation", source: "themes", label: "gravando sozinho no quarto" },
      { kind: "scene", source: "assets", label: "MESA DE TRABALHO" },
      { kind: "voice", source: "tone", label: "direto e irônico" },
      { kind: "scene", source: "assets", label: "objeto inventado" },
    ], {
      territories: ["Autonomia criativa"],
      themes: ["Gravando sozinho no quarto"],
      assets: ["Mesa de trabalho"],
      tone: "Direto e irônico",
    })).toEqual([
      { kind: "situation", source: "themes", label: "Gravando sozinho no quarto" },
      { kind: "scene", source: "assets", label: "Mesa de trabalho" },
      { kind: "voice", source: "tone", label: "Direto e irônico" },
    ]);
  });

  it("cria fallback honesto para pautas antigas", () => {
    expect(resolveContentIdeaMapAnchors({
      territory: "Autonomia criativa",
      assets: ["Quarto", "Celular"],
      tone: "Reflexivo",
    })).toEqual([
      { kind: "subject", source: "territories", label: "Autonomia criativa" },
      { kind: "scene", source: "assets", label: "Quarto" },
      { kind: "scene", source: "assets", label: "Celular" },
      { kind: "voice", source: "tone", label: "Reflexivo" },
    ]);
  });

  it("prioriza situação, assunto, cena e voz no card", () => {
    const resolved = resolveContentIdeaMapAnchors({
      mapAnchors: [
        { kind: "voice", source: "tone", label: "Direto" },
        { kind: "situation", source: "themes", label: "Refazendo o vídeo" },
      ],
      territory: "Processo criativo",
      assets: ["Mesa"],
      tone: "Direto",
    });
    expect(selectContentIdeaCardAnchors(resolved).map((anchor) => anchor.kind)).toEqual([
      "situation",
      "subject",
      "scene",
      "voice",
    ]);
    expect(contentIdeaMapAnchorLabel("voice")).toBe("Jeito de falar");
  });
});
