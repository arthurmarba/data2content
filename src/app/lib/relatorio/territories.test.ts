import {
  canonicalContextId,
  resolveTerritoryForContexts,
  selectWeekTerritories,
  tallyTerritories,
} from "./territories";

describe("canonicalContextId", () => {
  it("aceita id, label e as formas sujas do banco", () => {
    expect(canonicalContextId("parenting")).toBe("parenting");
    expect(canonicalContextId("Parentalidade")).toBe("parenting");
    expect(canonicalContextId("personal_and_professional/parenting")).toBe("parenting");
    expect(canonicalContextId("personal_and_professional.parenting")).toBe("parenting");
  });

  it("devolve null para vazio", () => {
    expect(canonicalContextId(null)).toBeNull();
    expect(canonicalContextId("   ")).toBeNull();
  });
});

describe("resolveTerritoryForContexts — só EVIDÊNCIA, não definição", () => {
  it("traduz o context do post para o id canônico do REGISTRO", () => {
    // O id tem que ser o mesmo do mapRegistry, senão declaração e evidência não
    // são comparáveis.
    expect(resolveTerritoryForContexts(["food_culinary"])).toEqual({
      id: "cozinha",
      label: "Gastronomia",
    });
    expect(resolveTerritoryForContexts(["fitness_sports"])?.id).toBe("treino");
    expect(resolveTerritoryForContexts(["home_decor_diy"])?.id).toBe("casa-real");
  });

  it("context que não descreve domínio de vida não vira território", () => {
    expect(resolveTerritoryForContexts(["general"])).toBeNull();
    expect(resolveTerritoryForContexts(["lifestyle_and_wellbeing"])).toBeNull();
    expect(resolveTerritoryForContexts([])).toBeNull();
    expect(resolveTerritoryForContexts(undefined)).toBeNull();
  });

  it("é determinístico com mais de um context", () => {
    const a = resolveTerritoryForContexts(["general", "food_culinary", "fitness_sports"]);
    expect(a?.id).toBe("cozinha");
  });
});

describe("tallyTerritories", () => {
  // Território já resolvido a partir do MAPA — é o que loadWindow entrega.
  const posts = [
    { creatorId: "a", territoryId: "maternidade" },
    { creatorId: "a", territoryId: "maternidade" },
    { creatorId: "b", territoryId: "maternidade" },
    { creatorId: "c", territoryId: "cozinha" },
    { creatorId: "d", territoryId: null },
  ];

  it("conta posts e criadores que POSTARAM no território", () => {
    expect(tallyTerritories(posts)[0]).toEqual({
      territoryId: "maternidade",
      label: "Maternidade/Paternidade",
      posts: 3,
      creators: 2,
    });
  });

  it("post sem território (criador sem mapa) fica fora", () => {
    expect(tallyTerritories(posts).reduce((sum, t) => sum + t.posts, 0)).toBe(4);
  });

  it("território fora do registro não corrompe a contagem", () => {
    expect(tallyTerritories([{ creatorId: "a", territoryId: "territorio-extinto" }])).toEqual([]);
  });
});

describe("selectWeekTerritories", () => {
  const volumes = [
    { territoryId: "moda", label: "Moda", posts: 56, creators: 16 },
    { territoryId: "maternidade", label: "Maternidade/Paternidade", posts: 43, creators: 8 },
    { territoryId: "cozinha", label: "Cozinha", posts: 38, creators: 11 },
    { territoryId: "treino", label: "Treino", posts: 29, creators: 9 },
    { territoryId: "casa-real", label: "Casa real", posts: 27, creators: 7 },
    { territoryId: "viagem", label: "Viagem", posts: 11, creators: 1 },
  ];

  it("pega os quatro maiores por volume", () => {
    expect(selectWeekTerritories(volumes)).toEqual([
      "moda",
      "maternidade",
      "cozinha",
      "treino",
    ]);
  });

  it("respeita territórios fixados, na ordem dada", () => {
    expect(
      selectWeekTerritories(volumes, {
        pinned: ["maternidade", "casa-real", "cozinha", "treino"],
      }),
    ).toEqual(["maternidade", "casa-real", "cozinha", "treino"]);
  });

  it("território de uma pessoa só entra — não existe mais piso de 3", () => {
    // Era excluído até a Fase 13: a tabela precisava de ≥2 criadores por elemento pra
    // não sair vazia. Hoje o peso rotula a linha "indício" em vez de escondê-la, então
    // não há mais razão pra esconder o território inteiro.
    expect(selectWeekTerritories(volumes, { count: 6 })).toContain("viagem");
  });

  it("com count menor que o total, o de menor volume fica de fora — não por ter pouca gente", () => {
    expect(selectWeekTerritories(volumes, { count: 5 })).not.toContain("viagem");
  });

  it("fixado entra mesmo fora do topo por volume — a decisão é editorial", () => {
    expect(selectWeekTerritories(volumes, { pinned: ["viagem"], count: 2 })).toContain("viagem");
  });

  it("ignora id que não existe no registro", () => {
    expect(selectWeekTerritories(volumes, { pinned: ["inventado"], count: 1 })).not.toContain(
      "inventado",
    );
  });
});
