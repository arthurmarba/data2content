import { buildContentIdeasAudienceResonance } from "./contentIdeasAudienceResonance";
import type { AudienceInsights } from "./audienceInsightsService";

// Constrói um AudienceInsights mínimo — só os campos lidos pelo mapeador importam.
function makeInsights(partial: Partial<AudienceInsights>): AudienceInsights {
  return {
    orphanTerritory: null,
    resonantTone: null,
    formatInversion: null,
    resonantIntent: null,
    territoryDivergence: null,
    resonantTerritory: null,
    risingTerritory: null,
    combo: null,
    demographics: null,
    engagedDivergence: null,
    rhythm: null,
    attention: null,
    propagation: null,
    resonantNarrativeForm: null,
    resonantStance: null,
    topLifeAsset: null,
    periodLabel: "últimos 90 dias",
    hasAny: true,
    ...partial,
  } as AudienceInsights;
}

describe("buildContentIdeasAudienceResonance", () => {
  const confirmed = ["Estilo de Vida e Bem-Estar", "Tecnologia/Digital", "Humor"];

  it("retorna null sem insights ou sem sinal (hasAny=false)", () => {
    expect(buildContentIdeasAudienceResonance(null, confirmed)).toBeNull();
    expect(buildContentIdeasAudienceResonance(undefined, confirmed)).toBeNull();
    expect(buildContentIdeasAudienceResonance(makeInsights({ hasAny: false }), confirmed)).toBeNull();
  });

  it("retorna null quando nenhum campo sobrevive", () => {
    // hasAny true mas todos os campos lidos são null
    expect(buildContentIdeasAudienceResonance(makeInsights({}), confirmed)).toBeNull();
  });

  it("humaniza tom/intenção/forma/postura (corta no '/' e minúsculo)", () => {
    const r = buildContentIdeasAudienceResonance(
      makeInsights({
        resonantTone: { label: "Inspirador/Motivacional" } as any,
        resonantIntent: { label: "Conectar/Relacionar" } as any,
        resonantNarrativeForm: { label: "Bastidores" } as any,
        resonantStance: { label: "Depoimento" } as any,
      }),
      confirmed,
    );
    expect(r).toMatchObject({
      tone: "inspirador",
      intent: "conectar",
      narrativeForm: "bastidores",
      stance: "depoimento",
    });
  });

  it("só aceita território que casa com a lista confirmada (prefix-tolerant, sem acento)", () => {
    const r = buildContentIdeasAudienceResonance(
      // "estilo de vida" é prefixo do confirmado "Estilo de Vida e Bem-Estar"
      makeInsights({ resonantTerritory: { label: "estilo de vida" } as any }),
      confirmed,
    );
    expect(r?.resonantTerritory).toBe("Estilo de Vida e Bem-Estar");
  });

  it("descarta território da audiência que NÃO está no mapa (guardrail de divergência)", () => {
    const r = buildContentIdeasAudienceResonance(
      makeInsights({ territoryDivergence: { audienceLabel: "Finanças Pessoais" } as any }),
      confirmed,
    );
    // sem outros sinais → null; divergência fora do mapa não vira roteiro
    expect(r).toBeNull();
  });

  it("prioriza divergência (dentro do mapa) sobre resonantTerritory", () => {
    const r = buildContentIdeasAudienceResonance(
      makeInsights({
        territoryDivergence: { audienceLabel: "Humor" } as any,
        resonantTerritory: { label: "Tecnologia/Digital" } as any,
      }),
      confirmed,
    );
    expect(r?.resonantTerritory).toBe("Humor");
  });

  it("não repete o mesmo território em resonant e underexplored", () => {
    const r = buildContentIdeasAudienceResonance(
      makeInsights({
        resonantTerritory: { label: "Humor" } as any,
        orphanTerritory: { label: "Humor" } as any,
      }),
      confirmed,
    );
    expect(r?.resonantTerritory).toBe("Humor");
    expect(r?.underexploredTerritory).toBeNull();
  });

  it("casa vocabulários DIFERENTES por sobreposição de palavra (o fix do matcher)", () => {
    // Audiência fala 'Tecnologia/Digital'; o mapa do criador usa a frase própria
    // 'Consultoria de Tecnologia e Produto'. startsWith falharia; sobreposição casa.
    const mapaPhrases = ["Consultoria de Tecnologia e Produto", "Humor do dia a dia"];
    const r = buildContentIdeasAudienceResonance(
      makeInsights({ resonantTerritory: { label: "Tecnologia/Digital" } as any }),
      mapaPhrases,
    );
    expect(r?.resonantTerritory).toBe("Consultoria de Tecnologia e Produto");
  });

  it("NÃO casa só por conector genérico ('como', 'vida', 'para')", () => {
    const mapaPhrases = ["A performance como uma estratégia", "Minha vida para sempre"];
    const r = buildContentIdeasAudienceResonance(
      // 'Finanças/Pessoais' não compartilha palavra significativa — só haveria
      // colisão se 'como/vida/para' contassem (e não contam).
      makeInsights({ resonantTerritory: { label: "Finanças/Pessoais" } as any }),
      mapaPhrases,
    );
    expect(r).toBeNull();
  });

  it("mapeia território órfão confirmado como underexplored", () => {
    const r = buildContentIdeasAudienceResonance(
      makeInsights({
        resonantTerritory: { label: "Humor" } as any,
        orphanTerritory: { label: "Tecnologia/Digital" } as any,
      }),
      confirmed,
    );
    expect(r?.underexploredTerritory).toBe("Tecnologia/Digital");
  });
});
