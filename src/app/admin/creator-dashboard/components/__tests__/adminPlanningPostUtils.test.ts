import { normalizePlanningPost } from "../adminPlanningPostUtils";

describe("normalizePlanningPost", () => {
  it("converts canonical ids to labels for local chart drilldowns and modal metadata", () => {
    const post = normalizePlanningPost({
      format: ["reel"],
      proposal: ["call_to_action"],
      context: ["fashion_style"],
      tone: ["promotional"],
      references: ["city"],
      stats: { total_interactions: 1200 },
    });

    expect(post.format).toEqual(["Reel"]);
    expect(post.proposal).toEqual(["Chamada"]);
    expect(post.context).toEqual(["Moda/Estilo"]);
    expect(post.tone).toEqual(["Promocional/Comercial"]);
    expect(post.references).toEqual(["Cidade"]);
    expect(post.metaLabel).toContain("Proposta: Chamada");
    expect(post.metaLabel).toContain("Contexto: Moda/Estilo");
    expect(post.metaLabel).toContain("Ref: Cidade");
  });

  it("normalizes legacy aliases into canonical labels", () => {
    const post = normalizePlanningPost({
      context: ["lifestyle_and_wellbeing.fashion_style"],
      references: ["geography.city"],
    });

    expect(post.context).toEqual(["Moda/Estilo"]);
    expect(post.references).toEqual(["Cidade"]);
  });
});
