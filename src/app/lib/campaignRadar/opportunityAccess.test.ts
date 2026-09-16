import { applyOpportunityAccess, selectFreeOpportunityIds } from "./opportunityAccess";
import type { DashboardOpportunity } from "./dashboardCatalog";

const base: DashboardOpportunity = {
  id: "x", locked: false, availability: "open", title: "t", brand: "b", summary: "resumo",
  source: "s", sourceId: "fonte", url: "https://exemplo.com/inscricao", applicationLabel: "Inscrever-se",
  requiresAccount: true, territories: [], formats: [], platforms: ["Instagram"],
  requirements: ["req"], deliverables: ["entrega"], evidence: [{ field: "compensation", excerpt: "paga R$ 500" }],
  deadline: "2026-09-30", verifiedAt: "2026-09-15", discoveredAt: "2026-09-14", publishedAt: null,
  includesProduct: false, payment: "unknown", minimum: null, compensation: "Cachê individual não confirmado",
} as DashboardOpportunity;

const make = (over: Partial<DashboardOpportunity>) => ({ ...base, ...over }) as DashboardOpportunity;

describe("selectFreeOpportunityIds", () => {
  it("libera as de maior cachê confirmado", () => {
    const ids = selectFreeOpportunityIds([
      make({ id: "a", payment: "paid", minimum: 300 }),
      make({ id: "b", payment: "paid", minimum: 900 }),
      make({ id: "c", payment: "paid", minimum: 600 }),
      make({ id: "d", payment: "paid", minimum: 100 }),
    ]);
    expect([...ids]).toEqual(["b", "c", "a"]);
  });

  it("ignora as encerradas, que não ocupam vaga livre", () => {
    const ids = selectFreeOpportunityIds([
      make({ id: "vencida", payment: "paid", minimum: 5000, availability: "closed" }),
      make({ id: "viva", payment: "paid", minimum: 200 }),
    ]);
    expect([...ids]).toEqual(["viva"]);
  });

  it("completa as vagas com as de prazo mais próximo quando falta cachê", () => {
    const ids = selectFreeOpportunityIds([
      make({ id: "paga", payment: "paid", minimum: 400 }),
      make({ id: "logo", deadline: "2026-09-16" }),
      make({ id: "depois", deadline: "2026-12-01" }),
      make({ id: "sem-prazo", deadline: null }),
    ]);
    expect([...ids]).toEqual(["paga", "logo", "depois"]);
  });
});

describe("applyOpportunityAccess", () => {
  const lista = [
    make({ id: "a", payment: "paid", minimum: 900 }),
    make({ id: "b", payment: "paid", minimum: 800 }),
    make({ id: "c", payment: "paid", minimum: 700 }),
    make({ id: "d", payment: "paid", minimum: 600 }),
  ];

  it("entrega tudo para quem assina", () => {
    expect(applyOpportunityAccess(lista, { hasProAccess: true })).toEqual(lista);
  });

  it("tranca o que passa do limite e não envia link nem detalhes", () => {
    const saida = applyOpportunityAccess(lista, { hasProAccess: false });
    expect(saida.filter((item) => !item.locked).map((item) => item.id)).toEqual(["a", "b", "c"]);
    const trancada = saida.find((item) => item.id === "d")!;
    expect(trancada.url).toBe("");
    expect(trancada.applicationLabel).toBe("");
    expect(trancada.summary).toBe("");
    expect(trancada.deliverables).toEqual([]);
    expect(trancada.requirements).toEqual([]);
    // As provas da fonte são o briefing em estado bruto: também não saem.
    expect(trancada.evidence).toEqual([]);
    // A prova de que existe continua: marca, plataforma, título, pagamento e prazo.
    expect(trancada.brand).toBe("b");
    expect(trancada.sourceId).toBe("fonte");
    expect(trancada.platforms).toEqual(["Instagram"]);
    expect(trancada.compensation).toBe(base.compensation);
    expect(trancada.deadline).toBe("2026-09-30");
  });
});
