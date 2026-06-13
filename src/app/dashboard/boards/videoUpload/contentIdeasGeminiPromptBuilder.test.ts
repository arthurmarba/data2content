import {
  buildContentIdeasPrompt,
  CONTENT_IDEAS_RESPONSE_JSON_SCHEMA,
  type ContentIdeasMapContext,
} from "./contentIdeasGeminiPromptBuilder";

function baseContext(partial?: Partial<ContentIdeasMapContext>): ContentIdeasMapContext {
  return {
    narrative: { label: "Criar sozinho", summary: "Faz tudo sem equipe." },
    territories: [{ label: "Humor", summary: null }],
    confirmedAssets: ["casa"],
    tone: "íntimo",
    topPerformingPattern: null,
    pastCreatorAnswers: [],
    onboardingAnswers: null,
    recentDismissedTitles: [],
    ...partial,
  };
}

describe("buildContentIdeasPrompt — bloco de audiência", () => {
  it("NÃO inclui o bloco de reconhecimento quando audienceResonance é ausente", () => {
    const { userInstruction } = buildContentIdeasPrompt({ context: baseContext(), count: 3 });
    expect(userInstruction).not.toContain("Sinais de reconhecimento da audiência");
  });

  it("inclui o bloco e a regra de priorização quando há sinal", () => {
    const { userInstruction } = buildContentIdeasPrompt({
      context: baseContext({
        audienceResonance: { resonantTerritory: "Humor", tone: "inspirador" },
      }),
      count: 3,
    });
    expect(userInstruction).toContain("Sinais de reconhecimento da audiência");
    expect(userInstruction).toContain("Humor");
    expect(userInstruction).toContain("PISO: ao menos 1 pauta");
    // o encontro identidade × reconhecimento
    expect(userInstruction).toContain("QUEM VOCÊ É encontra O QUE AS PESSOAS VEEM EM VOCÊ");
  });

  it("impõe TETO de diversidade (audiência não molda TODAS) com count=3 → no máximo 2", () => {
    const { userInstruction } = buildContentIdeasPrompt({
      context: baseContext({ audienceResonance: { tone: "humor" } }),
      count: 3,
    });
    expect(userInstruction).toContain("TETO");
    expect(userInstruction).toContain("NO MÁXIMO 2 de 3");
    expect(userInstruction).toContain("DIVERSIDADE OBRIGATÓRIA");
    expect(userInstruction).toContain("Identidade primeiro");
  });

  it("ativa o ângulo de descoberta quando há território subexplorado", () => {
    const { userInstruction } = buildContentIdeasPrompt({
      context: baseContext({
        audienceResonance: { underexploredTerritory: "Tecnologia" },
      }),
      count: 3,
    });
    expect(userInstruction).toContain("toca POUCO");
    expect(userInstruction).toContain("Tecnologia");
  });

  it("o bloco proíbe explicitamente vocabulário de desempenho", () => {
    const { userInstruction } = buildContentIdeasPrompt({
      context: baseContext({ audienceResonance: { resonantTerritory: "Humor" } }),
      count: 3,
    });
    expect(userInstruction).toContain("PROIBIDO tratar isso como desempenho");
    expect(userInstruction).toMatch(/nunca diga.*'funciona'/);
  });

  it("não emite o bloco se audienceResonance existe mas está todo vazio", () => {
    const { userInstruction } = buildContentIdeasPrompt({
      context: baseContext({ audienceResonance: {} }),
      count: 3,
    });
    expect(userInstruction).not.toContain("Sinais de reconhecimento da audiência");
  });
});

describe("buildContentIdeasPrompt — bloco de temas (camada-cena)", () => {
  it("NÃO inclui o bloco de cenas quando confirmedThemes é ausente", () => {
    const { userInstruction } = buildContentIdeasPrompt({ context: baseContext(), count: 3 });
    expect(userInstruction).not.toContain("camada-tema");
  });

  it("lista as cenas confirmadas e as marca como ponto de partida", () => {
    const { userInstruction } = buildContentIdeasPrompt({
      context: baseContext({
        confirmedThemes: ["Gravar sozinho no quarto às 2h", "Refazer o vídeo 5 vezes"],
      }),
      count: 3,
    });
    expect(userInstruction).toContain("Gravar sozinho no quarto às 2h");
    expect(userInstruction).toContain("PONTOS DE PARTIDA");
    // proíbe copiar o tema literal no título
    expect(userInstruction).toContain("NUNCA copie a frase do tema literalmente no título");
  });

  it("ignora cenas vazias/em branco", () => {
    const { userInstruction } = buildContentIdeasPrompt({
      context: baseContext({ confirmedThemes: ["  ", ""] }),
      count: 3,
    });
    expect(userInstruction).not.toContain("camada-tema");
  });
});

describe("buildContentIdeasPrompt — blindagens de conteúdo", () => {
  it("proíbe a palavra 'pauta' nos campos visíveis ao criador", () => {
    const { systemInstruction } = buildContentIdeasPrompt({ context: baseContext(), count: 3 });
    expect(systemInstruction).toContain('"pauta" é termo INTERNO');
    expect(systemInstruction).toMatch(/Use "vídeo", "ideia" ou "roteiro"/);
  });

  it("exige âncora concreta DESTE roteiro no whyItFits (reforço A4)", () => {
    const { userInstruction } = buildContentIdeasPrompt({ context: baseContext(), count: 3 });
    expect(userInstruction).toContain("ÂNCORA NESTE ROTEIRO");
    expect(userInstruction).toContain("poderia ser colada em outra pauta dele");
  });

  it("proíbe aspas irônicas e clichês ('marca registrada')", () => {
    const { userInstruction } = buildContentIdeasPrompt({ context: baseContext(), count: 3 });
    expect(userInstruction).toContain("ASPAS IRÔNICAS PROIBIDAS");
    expect(userInstruction).toContain("CLICHÊS PROIBIDOS");
    expect(userInstruction).toContain("marca registrada");
  });

  it("separa whyItFits (mapa) de resonanceNote (audiência) — sem eco", () => {
    const { userInstruction } = buildContentIdeasPrompt({ context: baseContext(), count: 3 });
    expect(userInstruction).toContain("LADO MAPA, NÃO AUDIÊNCIA");
    expect(userInstruction).toContain("trabalho EXCLUSIVO da resonanceNote");
  });

  it("proíbe reação de audiência nos scriptPoints (cena, não reação)", () => {
    const { userInstruction } = buildContentIdeasPrompt({ context: baseContext(), count: 3 });
    expect(userInstruction).toContain("CENA, NÃO REAÇÃO");
    expect(userInstruction).toMatch(/como as pessoas respondem\/reagem/);
  });
});

describe("buildContentIdeasPrompt — campo resonanceNote", () => {
  it("torna resonanceNote OBRIGATÓRIO quando a pauta se apoia em qualquer sinal da audiência", () => {
    const { userInstruction } = buildContentIdeasPrompt({ context: baseContext(), count: 3 });
    expect(userInstruction).toContain("resonanceNote: OBRIGATÓRIO");
    expect(userInstruction).toContain("metade-AUDIÊNCIA");
    // cobre sinais 'moles' (tom/forma), não só território
    expect(userInstruction).toMatch(/TOM.*humor/);
  });

  it("schema declara resonanceNote como propriedade NÃO obrigatória", () => {
    const itemSchema = (CONTENT_IDEAS_RESPONSE_JSON_SCHEMA as any).properties.ideas.items;
    expect(itemSchema.properties.resonanceNote).toBeDefined();
    expect(itemSchema.properties.resonanceNote.maxLength).toBe(200);
    expect(itemSchema.required).not.toContain("resonanceNote");
  });
});

describe("buildContentIdeasPrompt — propósito do criador (Fase 5)", () => {
  it("inclui o propósito com destaque de prioridade quando declarado", () => {
    const { userInstruction } = buildContentIdeasPrompt({
      context: baseContext({
        onboardingAnswers: {
          whyYouCreate: "conto_historias",
          desiredFeeling: "inspirado",
          contentLimit: null,
          creatorPurpose: "encorajar mães sem tempo a se cuidarem",
        },
      }),
      count: 3,
    });
    expect(userInstruction).toContain("PROPÓSITO");
    expect(userInstruction).toContain("priorize sobre os demais sinais");
    expect(userInstruction).toContain("encorajar mães sem tempo a se cuidarem");
  });

  it("não imprime a linha de propósito quando ausente", () => {
    const { userInstruction } = buildContentIdeasPrompt({
      context: baseContext({
        onboardingAnswers: {
          whyYouCreate: "conto_historias",
          desiredFeeling: "inspirado",
          contentLimit: null,
          creatorPurpose: null,
        },
      }),
      count: 3,
    });
    expect(userInstruction).not.toContain("PROPÓSITO");
    // os demais sinais de intenção continuam presentes
    expect(userInstruction).toContain("Por que cria:");
  });
});
