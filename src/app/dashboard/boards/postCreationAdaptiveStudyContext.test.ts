import {
  buildPostCreationAdaptiveStudyContext,
  type PostCreationAdaptiveStudySignal,
} from "./postCreationAdaptiveStudyContext";

function collectScores(signals: PostCreationAdaptiveStudySignal[]) {
  return signals.map((signal) => signal.score);
}

function expectFiniteScores(signals: PostCreationAdaptiveStudySignal[]) {
  for (const signal of signals) {
    expect(Number.isFinite(signal.score)).toBe(true);
    expect(signal.score).toBeGreaterThanOrEqual(0);
    expect(signal.score).toBeLessThanOrEqual(1_000_000);
  }
}

const strongSlot = {
  slotId: "slot-1",
  dayOfWeek: 2,
  blockStartHour: 12,
  format: "Reels",
  categories: {
    context: ["Rotina"],
    tone: "Humor",
    proposal: ["Identificacao"],
  },
  narrativeForm: ["POV"],
  contentSignals: ["Comentavel"],
  stance: ["Reacao"],
  proofStyle: ["Cena real"],
  expectedMetrics: { viewsP50: 20_000, viewsP90: 60_000, sharesP50: 320 },
  comments: 80,
  saves: 120,
  shares: 260,
  evidenceCount: 3,
  evidencePosts: [
    {
      id: "post-1",
      title: "POV familia fazendo barulho",
      postLink: "https://example.com/post-1",
      totalInteractions: 5400,
      saves: 120,
      shares: 80,
    },
  ],
};

const weakerSlot = {
  slotId: "slot-2",
  dayOfWeek: 4,
  blockStartHour: 18,
  format: "Carrossel",
  categories: {
    context: ["Tutorial"],
    tone: "Didatico",
    proposal: ["Salvamento"],
  },
  narrativeForm: ["Lista"],
  contentSignals: ["Salvavel"],
  expectedMetrics: { viewsP50: 5_000, viewsP90: 12_000, sharesP50: 40 },
  comments: 10,
  saves: 35,
  shares: 20,
  evidenceCount: 1,
  evidencePosts: [
    {
      id: "post-2",
      title: "Checklist rapido",
      postLink: "https://example.com/post-2",
      totalInteractions: 900,
    },
  ],
};

const recommendation = {
  slotId: "rec-1",
  dayLabel: "Sexta-feira",
  hourLabel: "15h",
  formatLabel: "Reels",
  narrativeLabel: "Cena de rotina",
  contextLabel: "Casa",
  proposalLabel: "Comentario",
  contentSignals: ["Compartilhavel"],
  expectedInteractionsAvg: 4_500,
  evidenceCount: 2,
  evidencePosts: [
    {
      id: "post-3",
      title: "Rotina em casa",
      permalink: "https://example.com/post-3",
      totalInteractions: 3200,
      reach: 40_000,
    },
  ],
};

describe("buildPostCreationAdaptiveStudyContext", () => {
  it("returns a safe empty context for empty input", () => {
    const context = buildPostCreationAdaptiveStudyContext({});

    expect(context.source).toBe("planner_client");
    expect(context.profileSummary).toEqual({
      slotsCount: 0,
      recommendationsCount: 0,
      postedSignalsCount: 0,
      evidencePostsCount: 0,
      captionSignalsCount: 0,
      themeSignalsCount: 0,
      qualitativeSignalsCount: 0,
    });
    expect(context.topFormats).toEqual([]);
    expect(context.topContentIntents).toEqual([]);
    expect(context.topNarrativeForms).toEqual([]);
    expect(context.topTones).toEqual([]);
    expect(context.topThemes).toEqual([]);
    expect(context.topThemeKeywords).toEqual([]);
    expect(context.topHooks).toEqual([]);
    expect(context.topCtas).toEqual([]);
    expect(context.topProofStyles).toEqual([]);
    expect(context.topStances).toEqual([]);
    expect(context.topCommercialModes).toEqual([]);
    expect(context.topCaptionSignals).toEqual([]);
    expect(context.referencePosts).toEqual([]);
    expect(context.confidence.label).toBe("low");
  });

  it("uses planner_client as source", () => {
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots: [strongSlot] });

    expect(context.source).toBe("planner_client");
  });

  it("uses the default periodDays when absent", () => {
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots: [strongSlot] });

    expect(context.periodDays).toBe(90);
  });

  it("counts slots, recommendations, outcomeSignals, and evidence posts in profileSummary", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [strongSlot, weakerSlot],
      recommendations: [recommendation],
      outcomeSignals: [{ slotId: "slot-1" }, { slotId: "slot-2" }],
    });

    expect(context.profileSummary.slotsCount).toBe(2);
    expect(context.profileSummary.recommendationsCount).toBe(1);
    expect(context.profileSummary.postedSignalsCount).toBe(2);
    expect(context.profileSummary.evidencePostsCount).toBe(3);
    expect(context.profileSummary.captionSignalsCount).toBeGreaterThanOrEqual(0);
    expect(context.profileSummary.themeSignalsCount).toBeGreaterThanOrEqual(0);
    expect(context.profileSummary.qualitativeSignalsCount).toBeGreaterThanOrEqual(0);
  });

  it("extracts topFormats from plannerSlots", () => {
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots: [strongSlot] });

    expect(context.topFormats.map((signal) => signal.label)).toContain("Reels");
  });

  it("extracts topFormats from recommendations", () => {
    const context = buildPostCreationAdaptiveStudyContext({ recommendations: [recommendation] });

    expect(context.topFormats.map((signal) => signal.label)).toContain("Reels");
  });

  it("sorts signals by score", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [weakerSlot, strongSlot],
    });

    expect(context.topFormats[0]?.label).toBe("Reels");
    expect(collectScores(context.topFormats)).toEqual([...collectScores(context.topFormats)].sort((a, b) => b - a));
  });

  it("limits topFormats to 5", () => {
    const plannerSlots = Array.from({ length: 8 }, (_, index) => ({
      ...strongSlot,
      slotId: `slot-${index}`,
      format: `Formato ${index}`,
      expectedMetrics: { viewsP50: 10_000 - index * 100, sharesP50: 100 - index },
    }));
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots });

    expect(context.topFormats).toHaveLength(5);
  });

  it("extracts topNarratives when narrative fields exist", () => {
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots: [strongSlot], recommendations: [recommendation] });

    expect(context.topNarratives.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["POV", "Cena de rotina"]),
    );
  });

  it("extracts topContexts", () => {
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots: [strongSlot], recommendations: [recommendation] });

    expect(context.topContexts.map((signal) => signal.label)).toEqual(expect.arrayContaining(["Rotina", "Casa"]));
  });

  it("extracts topProposals", () => {
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots: [strongSlot], recommendations: [recommendation] });

    expect(context.topProposals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["Identificacao", "Comentario"]),
    );
  });

  it("extracts topEngagementDrivers from metrics and interaction signals", () => {
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots: [strongSlot] });

    expect(context.topEngagementDrivers.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["Comentavel", "Comentarios", "Salvamentos", "Compartilhamentos"]),
    );
  });

  it("extracts topContentIntents from qualitative planner records", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [{ ...strongSlot, contentIntent: "Gerar conversa" }],
    });

    expect(context.topContentIntents.map((signal) => signal.label)).toContain("Gerar conversa");
  });

  it("extracts topNarrativeForms from narrativeForm fields", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [{ ...strongSlot, narrativeForm: ["POV", "Antes e depois"] }],
    });

    expect(context.topNarrativeForms.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["POV", "Antes e depois"]),
    );
  });

  it("extracts topTones from nested categories", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [{ ...strongSlot, categories: { ...strongSlot.categories, tone: ["Humor leve"] } }],
    });

    expect(context.topTones.map((signal) => signal.label)).toContain("Humor leve");
  });

  it("extracts themes and theme keywords", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        {
          ...strongSlot,
          themes: ["Rotina em casa", "Familia"],
          themeKeyword: "barulho",
        },
      ],
    });

    expect(context.topThemes.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["Rotina em casa", "Familia"]),
    );
    expect(context.topThemeKeywords.map((signal) => signal.label)).toContain("barulho");
    expect(context.profileSummary.themeSignalsCount).toBeGreaterThan(0);
  });

  it("extracts CTA signals from captions and scripts", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        {
          ...strongSlot,
          caption: "Comenta aqui se isso acontece na sua casa e salva para lembrar depois.",
          scriptShort: "Compartilha com alguem que precisa ver isso.",
        },
      ],
    });

    expect(context.topCtas.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["Comentar", "Salvar", "Compartilhar"]),
    );
  });

  it("extracts hook signals from questions and recognized openings", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        {
          ...strongSlot,
          title: "Voce ja tentou relaxar e todo mundo resolveu fazer barulho?",
          scriptShort: "Ninguem fala sobre esse caos de fim de dia.",
        },
      ],
    });

    expect(context.topHooks.map((signal) => signal.label)).toEqual(
      expect.arrayContaining([
        "Voce ja tentou relaxar e todo mundo resolveu fazer barulho?",
        "Ninguem fala sobre esse caos de fim de dia.",
      ]),
    );
  });

  it("extracts caption keywords from recurring relevant terms", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        {
          ...strongSlot,
          caption: "skincare rotina skincare familia barulho familia skincare",
        },
      ],
    });

    expect(context.topCaptionSignals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["skincare", "familia", "barulho"]),
    );
    expect(context.profileSummary.captionSignalsCount).toBeGreaterThan(0);
  });

  it("extracts stance, proofStyle, and commercialMode signals", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        {
          ...strongSlot,
          stance: "Opiniao direta",
          proofStyle: "Antes e depois",
          commercialMode: "Produto na rotina",
        },
      ],
    });

    expect(context.topStances.map((signal) => signal.label)).toContain("Opiniao direta");
    expect(context.topProofStyles.map((signal) => signal.label)).toContain("Antes e depois");
    expect(context.topCommercialModes.map((signal) => signal.label)).toContain("Produto na rotina");
  });

  it("orders qualitative signals by performance score", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        {
          theme: "Tema fraco",
          totalInteractions: 100,
          evidenceCount: 1,
        },
        {
          theme: "Tema forte",
          totalInteractions: 5000,
          evidenceCount: 3,
        },
      ],
    });

    expect(context.topThemes[0]?.label).toBe("Tema forte");
  });

  it("extracts bestPostingWindows with day and hour labels", () => {
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots: [strongSlot], recommendations: [recommendation] });

    expect(context.bestPostingWindows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dayLabel: "Terca-feira", hourLabel: "12h" }),
        expect.objectContaining({ dayLabel: "Sexta-feira", hourLabel: "15h" }),
      ]),
    );
  });

  it("extracts referencePosts with title, permalink, and metrics", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [strongSlot],
      evidencePosts: [
        {
          id: "direct-post",
          title: "Post direto",
          permalink: "https://example.com/direct",
          interactions: 2500,
          reach: 15_000,
          saves: 60,
          shares: 30,
          comments: 12,
          caption: "Legenda com contexto do post",
        },
      ],
    });

    expect(context.referencePosts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "direct-post",
          title: "Post direto",
          permalink: "https://example.com/direct",
          interactions: 2500,
          reach: 15_000,
          saves: 60,
          shares: 30,
          comments: 12,
          caption: "Legenda com contexto do post",
        }),
      ]),
    );
  });

  it("limits referencePosts to 8", () => {
    const evidencePosts = Array.from({ length: 12 }, (_, index) => ({
      id: `post-${index}`,
      title: `Post ${index}`,
      totalInteractions: 1000 - index,
    }));
    const context = buildPostCreationAdaptiveStudyContext({ evidencePosts });

    expect(context.referencePosts).toHaveLength(8);
  });

  it("extracts brandSignals when input.brandSignals exists", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      brandSignals: [
        { brandCategory: "Conforto em casa", evidenceCount: 2, confidence: 0.8 },
        "Skincare",
      ],
    });

    expect(context.brandSignals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["Conforto em casa", "Skincare"]),
    );
  });

  it("extracts collabSignals when input.collabSignals exists", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      collabSignals: [
        { creatorProfile: "Creator de humor de rotina", evidenceCount: 3, opportunityScore: 84 },
        "Decoracao",
      ],
    });

    expect(context.collabSignals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["Creator de humor de rotina", "Decoracao"]),
    );
  });

  it("sets high confidence with enough data and evidence", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [strongSlot, weakerSlot, { ...strongSlot, slotId: "slot-3" }],
      evidencePosts: [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "C" },
      ],
    });

    expect(context.confidence.label).toBe("high");
    expect(context.confidence.score).toBeGreaterThanOrEqual(80);
  });

  it("sets medium confidence with limited data", () => {
    const context = buildPostCreationAdaptiveStudyContext({ plannerSlots: [strongSlot] });

    expect(context.confidence.label).toBe("medium");
  });

  it("sets low confidence with no data", () => {
    const context = buildPostCreationAdaptiveStudyContext({});

    expect(context.confidence.label).toBe("low");
    expect(context.confidence.score).toBe(0);
  });

  it("does not break with null or undefined objects inside arrays", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [null, undefined, strongSlot],
      recommendations: [undefined, recommendation],
      outcomeSignals: [null, { slotId: "slot-1" }],
    });

    expect(context.profileSummary.slotsCount).toBe(1);
    expect(context.profileSummary.recommendationsCount).toBe(1);
    expect(context.profileSummary.postedSignalsCount).toBe(1);
  });

  it("does not break with unknown shapes", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [{ any: { nested: "value" } }, 12 as unknown, "texto" as unknown],
      recommendations: [{ format: { invalid: true } }],
    });

    expect(context.source).toBe("planner_client");
    expect(context.topFormats).toEqual([]);
  });

  it("keeps scores finite and inside the safe range", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        {
          format: "Gigante",
          expectedMetrics: { viewsP50: Number.MAX_SAFE_INTEGER, sharesP50: Number.MAX_SAFE_INTEGER },
          evidenceCount: Number.MAX_SAFE_INTEGER,
        },
      ],
      brandSignals: [{ label: "Marca", opportunityScore: Number.MAX_SAFE_INTEGER }],
    });

    expectFiniteScores(context.topFormats);
    expectFiniteScores(context.brandSignals);
    for (const signal of context.bestPostingWindows) {
      expect(Number.isFinite(signal.score)).toBe(true);
      expect(signal.score).toBeLessThanOrEqual(1_000_000);
    }
  });

  it("ignores empty labels", () => {
    const context = buildPostCreationAdaptiveStudyContext({
      plannerSlots: [
        { ...strongSlot, slotId: "blank", format: "   ", categories: { context: [""] }, narrativeForm: [""] },
      ],
      brandSignals: [{ label: " " }],
    });

    expect(context.topFormats).toEqual([]);
    expect(context.topNarratives).toEqual([]);
    expect(context.brandSignals).toEqual([]);
  });

  it("is deterministic for the same input", () => {
    const input = {
      plannerSlots: [strongSlot, weakerSlot],
      recommendations: [recommendation],
      outcomeSignals: [{ slotId: "slot-1" }],
      brandSignals: ["Skincare"],
      collabSignals: ["Humor"],
      periodDays: 60,
    };

    expect(buildPostCreationAdaptiveStudyContext(input)).toEqual(buildPostCreationAdaptiveStudyContext(input));
  });
});
