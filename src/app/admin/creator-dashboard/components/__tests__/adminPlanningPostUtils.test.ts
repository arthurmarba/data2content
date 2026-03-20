import { normalizePlanningPost } from "../adminPlanningPostUtils";

describe("normalizePlanningPost", () => {
  it("converts canonical ids to labels for local chart drilldowns and modal metadata", () => {
    const post = normalizePlanningPost({
      format: ["reel"],
      proposal: ["call_to_action"],
      contentIntent: ["convert"],
      narrativeForm: ["review"],
      context: ["fashion_style"],
      tone: ["promotional"],
      references: ["city"],
      contentSignals: ["comment_cta"],
      stance: ["testimonial"],
      proofStyle: ["before_after"],
      commercialMode: ["discount_offer"],
      stats: { total_interactions: 1200 },
    });

    expect(post.format).toEqual(["Reel"]);
    expect(post.proposal).toEqual([]);
    expect(post.contentIntent).toEqual(["Converter"]);
    expect(post.narrativeForm).toEqual(["Review"]);
    expect(post.context).toEqual(["Moda/Estilo"]);
    expect(post.tone).toEqual(["Promocional/Comercial"]);
    expect(post.references).toEqual(["Cidade"]);
    expect(post.contentSignals).toEqual(["CTA de Comentario"]);
    expect(post.stance).toEqual(["Depoimento"]);
    expect(post.proofStyle).toEqual(["Antes e Depois"]);
    expect(post.commercialMode).toEqual(["Oferta/Desconto"]);
    expect(post.metaLabel).not.toContain("Proposta:");
    expect(post.metaLabel).toContain("Intenção: Converter");
    expect(post.metaLabel).toContain("Narrativa: Review");
    expect(post.metaLabel).toContain("Contexto: Moda/Estilo");
    expect(post.metaLabel).toContain("Ref: Cidade");
    expect(post.metaLabel).toContain("Sinais: CTA de Comentario");
    expect(post.metaLabel).toContain("Postura: Depoimento");
    expect(post.metaLabel).toContain("Prova: Antes e Depois");
    expect(post.metaLabel).toContain("Modo comercial: Oferta/Desconto");
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
