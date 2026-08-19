import { resolveFirstTerritoryContext, resolveTerritoryContextId } from "./territoryContext";

describe("resolveTerritoryContextId", () => {
  it("liga o território escrito pela criadora ao contexto canônico", () => {
    expect(resolveTerritoryContextId("Maternidade")).toBe("parenting");
    expect(resolveTerritoryContextId("maternidade real")).toBe("parenting");
    expect(resolveTerritoryContextId("Culinária")).toBe("food_culinary");
    expect(resolveTerritoryContextId("Moda")).toBe("fashion_style");
  });

  it("não força casamento quando o território não cabe em nenhuma gaveta", () => {
    expect(resolveTerritoryContextId("Fé")).toBeNull();
    expect(resolveTerritoryContextId("")).toBeNull();
    expect(resolveTerritoryContextId(null)).toBeNull();
  });

  it("usa o primeiro território que tem contexto, ignorando os que não têm", () => {
    expect(resolveFirstTerritoryContext(["Fé", "Maternidade", "Bem-estar"])).toEqual({
      territory: "Maternidade",
      contextId: "parenting",
    });
    expect(resolveFirstTerritoryContext(["Fé", "Nada disso"])).toBeNull();
  });
});
