/** @jest-environment node */

import { sanitizeMcpVideoDiagnosisDocument, sanitizeMcpWeeklyPayload } from "./creatorIntelligence";

describe("MCP creator intelligence sanitization", () => {
  const safeFlags = {
    sanitized: true,
    containsSignedUrl: false,
    containsObjectKey: false,
    containsRawModelResponse: false,
    containsLongTranscript: false,
    containsPersistedVideoReference: false,
  };

  it("blocks a diagnosis that has not passed the persisted safety contract", () => {
    expect(sanitizeMcpVideoDiagnosisDocument({
      diagnosisId: "unsafe",
      safetyFlags: { ...safeFlags, containsSignedUrl: true },
    })).toBeNull();
  });

  it("keeps strategic evidence and outcomes without media storage metadata", () => {
    const result = sanitizeMcpVideoDiagnosisDocument({
      diagnosisId: "safe",
      safetyFlags: safeFlags,
      videoMetadata: {
        durationSeconds: 42,
        analyzedAt: new Date("2026-08-25T12:00:00.000Z"),
        originalFileNameSanitized: "private-name.mp4",
        thumbnailUrl: "https://signed.example.test/private",
      },
      videoReading: { mainNarrative: "IA para creators" },
      evidenceAnchors: { speechQuotes: [{ quote: "Gancho" }], sceneAnchors: [] },
      hookRecommendation: { primary: { spokenLine: "Comece pela tensão" } },
      hookOutcome: { pattern: "tension", openingMatchScore: 0.9 },
      scriptAdjustmentRecommendation: { pattern: "contrast" },
      scriptAdjustmentOutcome: { pattern: "contrast", selectedStepIds: ["step-1"] },
    });
    expect(result).toMatchObject({
      diagnosisId: "safe",
      durationSeconds: 42,
      hookRecommendation: { primary: { spokenLine: "Comece pela tensão" } },
      hookOutcome: { pattern: "tension", openingMatchScore: 0.9 },
      scriptAdjustmentOutcome: { selectedStepIds: ["step-1"] },
    });
    expect(JSON.stringify(result)).not.toContain("private-name.mp4");
    expect(JSON.stringify(result)).not.toContain("signed.example.test");
    expect(JSON.stringify(result)).not.toContain("safetyFlags");
  });

  it("separates closed-week publication count from 90-day pattern support", () => {
    const result = sanitizeMcpWeeklyPayload({
      period: { startsAt: "2026-08-17T03:00:00.000Z", endsAt: "2026-08-24T02:59:59.999Z" },
      coverage: { postsWeek: 3, posts90d: 16, postsWithScene: 15, scenePercent: 94 },
      overview: { numbers: [{ value: "3", label: "posts" }] },
      details: [{
        id: "scene",
        groups: [{
          id: "objects",
          items: [{ id: "microfone", label: "microfone", nPosts: 7, index: 2, weeklyOccurrences: 0 }],
        }],
      }],
    });

    expect(result?.coverage).toEqual({
      publishedInClosedWeek: 3,
      baselinePublishedCount: 16,
      sceneAnalyzedInBaseline: 15,
      sceneCoveragePercentInBaseline: 94,
    });
    expect(result?.overview.numbers[0].label).toBe("publicações na semana fechada");
    expect(result?.details[0].groups[0].items[0]).toMatchObject({
      supportingPostsInBaseline: 7,
      occurrencesInClosedWeek: 0,
    });
    expect(JSON.stringify(result)).not.toContain('"nPosts"');
    expect(JSON.stringify(result)).not.toContain('"postsWeek"');
  });
});
