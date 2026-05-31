import {
  refineDiagnosticoNextMove,
  refineDiagnosticoRememberedAs,
  refineDiagnosticoSignal,
  refineDiagnosticoSignals,
} from "./diagnosticoDisplayText";

const BAD_BUNNY =
  "O criador analisa a performance de Bad Bunny no Super Bowl como uma estrategia de negocio, destacando a independencia do artista, a propriedade intelectual e o impacto cultural para construcao de comunidade leal e global.";

describe("diagnosticoDisplayText", () => {
  it("refina narrativa ruim antes de chegar no card", () => {
    const signal = refineDiagnosticoSignal({
      label: BAD_BUNNY,
      summary: `Esse video comunica uma direcao de conteudo ligada a ${BAD_BUNNY}`,
      evidenceCount: 4,
    }, "narrative");

    expect(signal.label).toBe("Autonomia criativa como negocio cultural");
    expect(signal.summary).toContain("cultura pop");
    expect(JSON.stringify(signal)).not.toContain("O criador analisa");
    expect(JSON.stringify(signal)).not.toContain("Esse video comunica uma direcao");
  });

  it("limpa tensoes e experimentos redundantes", () => {
    const tension = refineDiagnosticoSignal({
      label: "A narrativa não explicita a aplicabilidade direta desses insights de estrategia de artista.",
      summary: "Refinar a abertura antes de transformar o video em roteiro.",
    }, "tension");

    expect(tension.label).toBe("Separar tema do video de narrativa");
    expect(tension.summary).not.toContain("Refinar a abertura");
  });

  it("deduplica sinais antes de renderizar listas", () => {
    const signals = refineDiagnosticoSignals([
      { label: BAD_BUNNY, summary: BAD_BUNNY },
      { label: "Autonomia criativa como negocio cultural", summary: "Outro texto" },
    ], "strength");

    expect(signals).toHaveLength(1);
  });

  it("corrige proximo passo antigo quando ja existem varias leituras", () => {
    expect(refineDiagnosticoNextMove({
      label: "Criar mais duas leituras",
      description: "Analise vídeos com formatos parecidos.",
      reason: "Quando duas leituras mostrarem narrativa parecida.",
    }, 6).label).toBe("Separar tema de narrativa");
  });

  it("preserva assunto concreto no historico sem virar narrativa", () => {
    expect(refineDiagnosticoRememberedAs(`Video sobre ${BAD_BUNNY}`)).toBe("Vídeo sobre Bad Bunny no Super Bowl");
  });
});
