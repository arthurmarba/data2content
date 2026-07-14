import { titleSimilarity, isNearDuplicate, filterNearDuplicateTitles } from "./contentIdeasTitleDedup";

describe("titleSimilarity", () => {
  it("é 1 pra títulos com as mesmas palavras significativas", () => {
    expect(titleSimilarity("Os livros que li pra sair do automático", "livros pra sair do automático")).toBeGreaterThan(0.9);
  });

  it("é 0 quando não há palavra significativa em comum", () => {
    expect(titleSimilarity("Como criar sozinho em casa", "A verdade sobre finanças pessoais")).toBe(0);
  });

  it("é 0 quando algum lado não tem palavra significativa", () => {
    expect(titleSimilarity("com a sua", "livros e cinema")).toBe(0);
  });
});

describe("isNearDuplicate", () => {
  it("pega rephrase do mesmo tema (≥2 palavras em comum + jaccard alto)", () => {
    expect(
      isNearDuplicate(
        "Por que parei de responder e-mail depois das 18h",
        "Por que eu parei de responder e-mail à noite",
      ),
    ).toBe(true);
  });

  it("NÃO colide títulos que dividem só UMA palavra significativa", () => {
    // "casa" em comum, mas temas distintos → não é duplicata
    expect(isNearDuplicate("Como gravo sozinho em casa", "A bagunça da casa antes de gravar")).toBe(false);
  });

  it("trata temas genuinamente diferentes como distintos", () => {
    expect(
      isNearDuplicate("Aprendi a proteger o jantar como reunião", "Trabalhei dez anos no automático"),
    ).toBe(false);
  });
});

describe("filterNearDuplicateTitles", () => {
  const t = (title: string) => ({ title });

  it("corta candidatos quase-idênticos a títulos existentes", () => {
    const existing = ["Os livros que li pra sair do automático"];
    const candidates = [
      t("Os livros que me tiraram do automático de vez"), // near-dup (livros+automatico)
      t("Aprendi a cozinhar com meu filho no domingo"), // novo
    ];
    const kept = filterNearDuplicateTitles(candidates, existing, (c) => c.title);
    expect(kept.map((c) => c.title)).toEqual(["Aprendi a cozinhar com meu filho no domingo"]);
  });

  it("dedup intra-lote: dois candidatos quase-iguais → mantém só o primeiro", () => {
    const candidates = [
      t("Por que parei de responder e-mail depois das 18h"),
      t("Por que eu parei de responder e-mail depois das seis"),
      t("Como organizo minha semana de gravação"),
    ];
    const kept = filterNearDuplicateTitles(candidates, [], (c) => c.title);
    expect(kept).toHaveLength(2);
    expect(kept[0]!.title).toContain("18h");
    expect(kept[1]!.title).toContain("semana de gravação");
  });

  it("sem duplicatas → devolve todos, na ordem", () => {
    const candidates = [t("Tema A distinto aqui"), t("Outro assunto bem diferente")];
    expect(filterNearDuplicateTitles(candidates, [], (c) => c.title)).toHaveLength(2);
  });
});
