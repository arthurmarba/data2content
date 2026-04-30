import {
  buildScriptBlueprintPresentation,
  splitStrategicDirection,
} from "./scriptBlueprintPresentation";

describe("dashboard/scriptBlueprintPresentation", () => {
  it("separa direção prática da justificativa estratégica", () => {
    expect(
      splitStrategicDirection(
        "Tom direto, olho na lente e pausa curta. Por que assim: esse tipo de abertura costuma segurar melhor a retenção do perfil."
      )
    ).toEqual({
      direction: "Tom direto, olho na lente e pausa curta.",
      strategyReason: "esse tipo de abertura costuma segurar melhor a retenção do perfil.",
    });
  });

  it("monta resumo estruturado de roteiro técnico", () => {
    const content = [
      "[ROTEIRO_TECNICO_V1]",
      "O que postar: Reels sobre o erro que trava vendas antes da oferta.",
      "Por que postar assim: No perfil, diagnóstico direto costuma gerar mais retenção do que abertura genérica.",
      "Quando postar: Priorizar ter e qui às 19h quando esse tema entrar na pauta.",
      "Como esse vídeo deve funcionar: erro visível -> contexto real -> ajuste -> pergunta final.",
      "[CENA 1: GANCHO]",
      "Visual: Close no rosto com comentário na tela.",
      'Fala: "Seu conteúdo não vende mal por falta de oferta."',
      "Direção: Tom firme e claro. Por que assim: abrir pelo problema tende a gerar mais identificação no perfil.",
      "[CENA 2: PROVA]",
      "Visual: Mostra duas versões da abertura no celular.",
      "Fala: Explica o erro e a virada prática.",
      "Direção: Didático e rápido.",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const presentation = buildScriptBlueprintPresentation(content);

    expect(presentation.hasStructuredScenes).toBe(true);
    expect(presentation.editorialSummary).toMatchObject({
      whatToPost: "Reels sobre o erro que trava vendas antes da oferta.",
      whenToPost: "Priorizar ter e qui às 19h quando esse tema entrar na pauta.",
    });
    expect(presentation.scenes).toHaveLength(2);
    expect(presentation.scenes[0]).toMatchObject({
      label: "Cena 1 • GANCHO",
      visual: "Close no rosto com comentário na tela.",
      message: '\"Seu conteúdo não vende mal por falta de oferta.\"',
      direction: "Tom firme e claro.",
      strategyReason: "abrir pelo problema tende a gerar mais identificação no perfil.",
    });
    expect(presentation.previewReason).toContain("diagnóstico direto");
  });

  it("mantém fallback compacto quando não há cenas estruturadas", () => {
    const presentation = buildScriptBlueprintPresentation(
      "Resposta solta sem formato técnico, mas ainda com uma ideia aproveitável."
    );

    expect(presentation.hasStructuredScenes).toBe(false);
    expect(presentation.previewText).toContain("Resposta solta");
  });
});
