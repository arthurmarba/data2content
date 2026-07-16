import {
  buildLegacyContentIdeaBlueprint,
  resolveContentIdeaCollabBlueprint,
  sanitizeContentIdeaScriptBlueprint,
} from "./contentIdeaBlueprint";

describe("contentIdeaBlueprint", () => {
  it("sanitiza um storyboard visual e só mantém assets confirmados", () => {
    const blueprint = sanitizeContentIdeaScriptBlueprint({
      visualPremise: "A história começa na mesa e termina no rosto",
      estimatedDurationSeconds: 42,
      scenes: [
        { beat: "abertura", visual: "Mostra a mesa vazia", spokenIntent: "Abre a tensão", onScreenText: "Eu parei", shot: "detalhe", asset: "mesa", durationSeconds: 5 },
        { beat: "virada", visual: "Vira a câmera para o rosto", spokenIntent: "Conta o que mudou", onScreenText: "", shot: "plano próximo", asset: "inventado", durationSeconds: 20 },
      ],
      recordingChecklist: ["Separar a agenda", "Gravar a mesa antes de arrumar"],
    }, ["mesa"]);

    expect(blueprint?.scenes).toHaveLength(2);
    expect(blueprint?.scenes[0].asset).toBe("mesa");
    expect(blueprint?.scenes[1].asset).toBeNull();
    expect(blueprint?.scenes[1].onScreenText).toBeNull();
  });

  it("transforma pautas antigas em storyboard sem exigir migração", () => {
    const blueprint = buildLegacyContentIdeaBlueprint({
      hook: "Eu achei que precisava de uma equipe",
      scriptPoints: ["Mostra a agenda cheia", "Conta a decisão que mudou tudo"],
      scriptClosing: "O que você ainda está esperando para fazer?",
      assets: ["agenda"],
    });

    expect(blueprint.scenes[0]).toMatchObject({ beat: "abertura", asset: "agenda" });
    expect(blueprint.scenes.at(-1)?.beat).toBe("fechamento");
  });

  it("cria um plano a dois utilizável quando o match ainda é legado", () => {
    const blueprint = resolveContentIdeaCollabBlueprint(
      null,
      "Façam um vídeo em revezamento sobre a decisão",
      "remoto",
    );

    expect(blueprint?.format).toMatch(/distância/i);
    expect(blueprint?.scenes.map((scene) => scene.owner)).toEqual(["viewer", "partner", "both"]);
    expect(blueprint?.handoffChecklist.length).toBeGreaterThanOrEqual(2);
  });
});
