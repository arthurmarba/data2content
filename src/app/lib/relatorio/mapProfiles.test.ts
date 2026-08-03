import {
  assetFitsByTerritory,
  narrativesOfTerritory,
  territoryEvidence,
  territoryMemberships,
  territoryOfPost,
  type MapProfile,
} from "./mapProfiles";

function profile(overrides: Partial<MapProfile> & { creatorId: string }): MapProfile {
  return {
    territoryIds: [],
    primaryTerritoryId: null,
    narrative: null,
    narrativeConfirmed: false,
    assets: [],
    toneIds: [],
    subjects: [],
    misplacedTerritoryLabels: [],
    maturity: "instagram_enriched",
    ...overrides,
  };
}

const asset = (ownLabel: string, roleId: string, roleLabel: string) => ({
  ownLabel,
  roleId,
  roleLabel,
  group: "vida" as const,
  confirmed: false,
});

describe("territoryMemberships", () => {
  it("conta criadores por território segundo o MAPA, não segundo o post", () => {
    const profiles = new Map([
      ["a", profile({ creatorId: "a", territoryIds: ["maternidade", "cozinha"] })],
      ["b", profile({ creatorId: "b", territoryIds: ["maternidade"] })],
      ["c", profile({ creatorId: "c", territoryIds: ["cozinha"] })],
    ]);
    expect(territoryMemberships(profiles)).toEqual([
      { territoryId: "cozinha", label: "Gastronomia", creatorIds: ["a", "c"] },
      {
        territoryId: "maternidade",
        label: "Maternidade/Paternidade",
        creatorIds: ["a", "b"],
      },
    ]);
  });

  it("um criador pode estar em vários territórios — o mapa dele declara os dois", () => {
    const profiles = new Map([
      ["a", profile({ creatorId: "a", territoryIds: ["paternidade", "cozinha", "treino"] })],
    ]);
    expect(territoryMemberships(profiles)).toHaveLength(3);
  });
});

describe("territoryOfPost", () => {
  it("o post herda o território PRIMÁRIO do mapa de quem postou", () => {
    const profiles = new Map([
      [
        "a",
        profile({
          creatorId: "a",
          territoryIds: ["paternidade", "cozinha"],
          primaryTerritoryId: "paternidade",
        }),
      ],
    ]);
    // Um pai que postou uma receita continua sendo Paternidade nesta semana.
    expect(territoryOfPost("a", profiles)).toBe("paternidade");
  });

  it("criador sem mapa não tem território — não entra em tela de território", () => {
    expect(territoryOfPost("z", new Map())).toBeNull();
  });
});

describe("narrativesOfTerritory — Regra 1", () => {
  const profiles = new Map([
    [
      "a",
      profile({
        creatorId: "a",
        territoryIds: ["paternidade"],
        narrative: "Um pai que busca equilíbrio e qualidade de vida perto da família",
        narrativeConfirmed: true,
      }),
    ],
    [
      "b",
      profile({
        creatorId: "b",
        territoryIds: ["paternidade"],
        narrative: "Um pai que trabalha até tarde e volta pra jantar",
      }),
    ],
    [
      "c",
      profile({
        creatorId: "c",
        territoryIds: ["cozinha"],
        narrative: "Uma mãe real que encontra beleza na rotina",
      }),
    ],
  ]);

  it("lista as narrativas do território sem nenhuma métrica", () => {
    const narratives = narrativesOfTerritory("paternidade", profiles, new Set(["a", "b"]));
    expect(narratives.map((n) => n.label)).toEqual([
      "Um pai que busca equilíbrio e qualidade de vida perto da família",
      "Um pai que trabalha até tarde e volta pra jantar",
    ]);
    expect(Object.keys(narratives[0]!)).toEqual(["label", "creators", "confirmed"]);
  });

  it("não traz narrativa de criador de outro território", () => {
    const narratives = narrativesOfTerritory("paternidade", profiles, new Set(["a", "b", "c"]));
    expect(narratives.map((n) => n.label)).not.toContain(
      "Uma mãe real que encontra beleza na rotina",
    );
  });

  it("só entra quem postou na semana", () => {
    expect(narrativesOfTerritory("paternidade", profiles, new Set(["a"]))).toHaveLength(1);
  });

  it("agrupa quando dois criadores têm a MESMA frase", () => {
    const mesmos = new Map([
      ["a", profile({ creatorId: "a", territoryIds: ["cozinha"], narrative: "A mesma frase" })],
      ["b", profile({ creatorId: "b", territoryIds: ["cozinha"], narrative: "a mesma frase" })],
    ]);
    const narratives = narrativesOfTerritory("cozinha", mesmos, new Set(["a", "b"]));
    expect(narratives).toEqual([{ label: "A mesma frase", creators: 2, confirmed: false }]);
  });

  it("carrega se o criador confirmou a narrativa no card", () => {
    const narratives = narrativesOfTerritory("paternidade", profiles, new Set(["a"]));
    expect(narratives[0]!.confirmed).toBe(true);
  });
});

describe("assetFitsByTerritory — o 'cabe em' é capacidade declarada", () => {
  it("conta quantos criadores do território têm o papel no mapa", () => {
    const profiles = new Map([
      [
        "a",
        profile({
          creatorId: "a",
          territoryIds: ["paternidade"],
          assets: [asset("a filha (Liv)", "filho_em_cena", "Filho em cena")],
        }),
      ],
      [
        "b",
        profile({
          creatorId: "b",
          territoryIds: ["paternidade"],
          assets: [
            asset("meus filhos", "filho_em_cena", "Filho em cena"),
            asset("a esposa", "parceiro_em_cena", "Parceiro em cena"),
          ],
        }),
      ],
    ]);
    const fits = assetFitsByTerritory(profiles);
    expect(fits.get("paternidade")!.get("filho_em_cena")).toBe(2);
    expect(fits.get("paternidade")!.get("parceiro_em_cena")).toBe(1);
  });

  it("dois rótulos do mesmo papel contam UMA vez por criador", () => {
    const profiles = new Map([
      [
        "a",
        profile({
          creatorId: "a",
          territoryIds: ["cozinha"],
          assets: [
            asset("a filha", "filho_em_cena", "Filho em cena"),
            asset("o filho", "filho_em_cena", "Filho em cena"),
          ],
        }),
      ],
    ]);
    expect(assetFitsByTerritory(profiles).get("cozinha")!.get("filho_em_cena")).toBe(1);
  });
});

describe("territoryEvidence — o post confirma ou contradiz o mapa", () => {
  const profiles = new Map([
    ["a", profile({ creatorId: "a", territoryIds: ["paternidade"] })],
    ["b", profile({ creatorId: "b", territoryIds: ["cozinha"] })],
  ]);

  it("marca divergência quando nada do que postou casa com o mapa", () => {
    const evidence = territoryEvidence(
      [
        { creatorId: "a", observedTerritoryId: "cozinha" },
        { creatorId: "a", observedTerritoryId: "cozinha" },
      ],
      profiles,
    );
    expect(evidence[0]).toMatchObject({
      creatorId: "a",
      declared: ["paternidade"],
      diverges: true,
    });
    expect(evidence[0]!.observed).toEqual([{ territoryId: "cozinha", posts: 2 }]);
  });

  it("não marca divergência quando pelo menos um post confirma o mapa", () => {
    const evidence = territoryEvidence(
      [
        { creatorId: "b", observedTerritoryId: "cozinha" },
        { creatorId: "b", observedTerritoryId: "moda" },
      ],
      profiles,
    );
    expect(evidence[0]!.diverges).toBe(false);
  });

  it("criador sem mapa nunca é marcado como divergente", () => {
    const evidence = territoryEvidence(
      [{ creatorId: "z", observedTerritoryId: "moda" }],
      profiles,
    );
    expect(evidence[0]!.diverges).toBe(false);
  });
});
