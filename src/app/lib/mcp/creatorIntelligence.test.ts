/** @jest-environment node */

import { sanitizeMcpVideoDiagnosisDocument } from "./creatorIntelligence";

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
});
