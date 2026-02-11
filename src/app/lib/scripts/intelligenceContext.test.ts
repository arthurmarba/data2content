import {
  buildIntelligencePromptSnapshot,
  resolveFinalCategories,
  SCRIPT_INTELLIGENCE_METRIC,
  SCRIPT_INTELLIGENCE_VERSION,
  type ScriptIntelligenceContext,
} from "./intelligenceContext";

describe("scripts/intelligenceContext", () => {
  const ranked = {
    proposal: ["tips"],
    context: ["career_work"],
    format: ["reel"],
    tone: ["educational"],
    references: ["pop_culture"],
  } as const;

  it("fills missing dimensions in partial mode with ranked categories", () => {
    const resolved = resolveFinalCategories({
      promptMode: "partial",
      explicitCategories: { tone: "humorous" },
      intent: { wantsHumor: false, wantsEngagement: false, subjectHint: null },
      rankedCategories: ranked,
    });

    expect(resolved.tone).toBe("humorous");
    expect(resolved.proposal).toBe("tips");
    expect(resolved.context).toBe("career_work");
    expect(resolved.format).toBe("reel");
    expect(resolved.references).toBe("pop_culture");
  });

  it("applies humor defaults when prompt asks for humor and categories are missing", () => {
    const resolved = resolveFinalCategories({
      promptMode: "open",
      explicitCategories: {},
      intent: { wantsHumor: true, wantsEngagement: false, subjectHint: null },
      rankedCategories: ranked,
    });

    expect(resolved.tone).toBe("humorous");
    expect(resolved.proposal).toBe("humor_scene");
    expect(resolved.context).toBe("career_work");
  });

  it("forces format to reel even when full prompt provides another format", () => {
    const explicit = {
      proposal: "announcement",
      context: "finance",
      format: "carousel",
      tone: "critical",
      references: "city",
    } as const;

    const resolved = resolveFinalCategories({
      promptMode: "full",
      explicitCategories: explicit,
      intent: { wantsHumor: true, wantsEngagement: true, subjectHint: null },
      rankedCategories: ranked,
    });

    expect(resolved.proposal).toBe("announcement");
    expect(resolved.context).toBe("finance");
    expect(resolved.tone).toBe("critical");
    expect(resolved.references).toBe("city");
    expect(resolved.format).toBe("reel");
  });

  it("builds prompt snapshot with evidence stats", () => {
    const context: ScriptIntelligenceContext = {
      intelligenceVersion: SCRIPT_INTELLIGENCE_VERSION,
      promptMode: "partial",
      intent: { wantsHumor: false, wantsEngagement: true, subjectHint: "creator" },
      metricUsed: SCRIPT_INTELLIGENCE_METRIC,
      lookbackDays: 180,
      explicitCategories: { proposal: "tips" },
      resolvedCategories: {
        proposal: "tips",
        context: "career_work",
        format: "reel",
        tone: "educational",
        references: "pop_culture",
      },
      rankedCategories: { ...ranked },
      dnaProfile: {
        sampleSize: 2,
        hasEnoughEvidence: false,
        averageSentenceLength: 11,
        emojiDensity: 0,
        openingPatterns: ["ola criadores"],
        ctaPatterns: ["comentario"],
        recurringExpressions: ["criadores"],
        writingGuidelines: ["Use tom conversacional."],
      },
      captionEvidence: [
        {
          metricId: "m1",
          caption: "Legenda 1",
          interactions: 100,
          postDate: null,
          categories: { proposal: "tips" },
        },
        {
          metricId: "m2",
          caption: "Legenda 2",
          interactions: 200,
          postDate: null,
          categories: { proposal: "tips" },
        },
      ],
      relaxationLevel: 2,
      usedFallbackRules: true,
    };

    const snapshot = buildIntelligencePromptSnapshot(context);
    expect(snapshot?.intelligenceVersion).toBe(SCRIPT_INTELLIGENCE_VERSION);
    expect(snapshot?.metricUsed).toBe(SCRIPT_INTELLIGENCE_METRIC);
    expect(snapshot?.dnaEvidence.sampleSize).toBe(2);
    expect(snapshot?.dnaEvidence.avgInteractions).toBe(150);
    expect(snapshot?.dnaEvidence.usedFallbackRules).toBe(true);
  });
});
