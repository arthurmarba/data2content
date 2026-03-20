import {
  buildClassificationV2BackfillUpdate,
  getMetricCategoryValuesForAnalytics,
  hasClassificationV2BackfillChanges,
  sanitizeLegacyProposalForV2,
  sanitizeLegacyToneForV2,
} from "@/app/lib/classificationV2Bridge";

describe("classification V2 bridge", () => {
  it("derives strategic analytics values from legacy fields when V2 is absent", () => {
    const metric = {
      source: "manual",
      type: "REEL",
      description: "Comenta aqui e salva esse post. #publi",
      proposal: ["Dicas", "Publi/Divulgação", "Chamada"],
      tone: ["Promocional/Comercial"],
      contentIntent: [],
      narrativeForm: [],
      contentSignals: [],
    };

    expect(getMetricCategoryValuesForAnalytics(metric, "contentIntent")).toEqual([
      "teach",
      "convert",
    ]);
    expect(getMetricCategoryValuesForAnalytics(metric, "narrativeForm")).toEqual(["tutorial"]);
    expect(getMetricCategoryValuesForAnalytics(metric, "contentSignals")).toEqual([
      "sponsored",
      "comment_cta",
      "save_cta",
    ]);
  });

  it("removes signal-only proposal values and non-tone legacy values during rewrite", () => {
    expect(
      sanitizeLegacyProposalForV2([
        "Chamada",
        "Sorteio/Giveaway",
        "Trend",
        "Dicas",
        "Review",
      ])
    ).toEqual(["tips", "review"]);

    expect(
      sanitizeLegacyToneForV2([
        "Educacional/Informativo",
        "Promocional/Comercial",
        "Inspirador/Motivacional",
      ])
    ).toEqual(["inspirational"]);
  });

  it("does not rank signal-only legacy proposal values in proposal analytics", () => {
    const metric = {
      source: "manual",
      type: "REEL",
      description: "Comenta aqui e salva esse post. #publi",
      proposal: ["Dicas", "Publi/Divulgação", "Chamada"],
      tone: ["Promocional/Comercial"],
    };

    expect(getMetricCategoryValuesForAnalytics(metric, "proposal")).toEqual(["tips"]);
  });

  it("builds deterministic backfill updates and reports when a metric still needs migration", () => {
    const metric = {
      source: "manual",
      type: "IMAGE",
      description: "Link na bio e comenta aqui.",
      proposal: ["Chamada", "Review"],
      tone: ["Promocional/Comercial", "Crítico/Analítico"],
      contentIntent: [],
      narrativeForm: [],
      contentSignals: [],
    };

    expect(hasClassificationV2BackfillChanges(metric)).toBe(true);
    expect(buildClassificationV2BackfillUpdate(metric, { rewriteLegacy: true })).toEqual({
      contentIntent: ["inform"],
      narrativeForm: ["review"],
      contentSignals: ["comment_cta", "link_in_bio_cta"],
      stance: ["testimonial", "critical"],
      proofStyle: [],
      commercialMode: [],
      proposal: ["review"],
      tone: ["critical"],
    });
  });

  it("detects when a metric is already aligned with the V2 backfill output", () => {
    const metric = {
      source: "manual",
      type: "IMAGE",
      description: "Post neutro.",
      proposal: ["Review"],
      tone: ["Crítico/Analítico"],
      contentIntent: ["convert"],
      narrativeForm: ["review"],
      contentSignals: ["comment_cta", "link_in_bio_cta"],
    };

    expect(hasClassificationV2BackfillChanges(metric, { rewriteLegacy: true })).toBe(true);
    expect(
      hasClassificationV2BackfillChanges(
        {
          ...metric,
          proposal: ["review"],
          tone: ["critical"],
          stance: ["testimonial", "critical"],
          proofStyle: [],
          commercialMode: [],
        },
        { rewriteLegacy: true }
      )
    ).toBe(false);
  });
});
