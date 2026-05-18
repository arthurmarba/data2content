import {
  buildVideoNarrativeCreatorProfile,
  createEmptyVideoNarrativeCreatorProfile,
  hasUsefulVideoNarrativeCreatorProfile,
  mapDiagnosisSignalToCreatorProfileSignal,
  mergeVideoNarrativeCreatorProfileSignals,
  sanitizeVideoNarrativeCreatorProfileText,
  summarizeVideoNarrativeCreatorProfile,
  type VideoNarrativeCreatorProfileSignal,
} from "./videoNarrativeCreatorProfileContract";
import type { VideoNarrativeDiagnosisCreatorSignal } from "./videoNarrativeDiagnosisLearningModel";

const FORBIDDEN_TERMS = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar garantido",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
  "venceu",
  "perdeu",
  "treinado permanentemente",
];

function diagnosisSignal(
  type: VideoNarrativeDiagnosisCreatorSignal["type"],
  value = type,
  overrides: Partial<VideoNarrativeDiagnosisCreatorSignal> = {},
): VideoNarrativeDiagnosisCreatorSignal {
  return {
    id: `${type}-${value}`,
    type,
    value,
    source: "quiz_answer",
    confidence: "medium",
    evidence: "Resposta do quiz",
    shouldPersistLater: false,
    ...overrides,
  };
}

function profileSignal(
  signal: VideoNarrativeDiagnosisCreatorSignal,
  createdAt = "2026-05-17T00:00:00.000Z",
): VideoNarrativeCreatorProfileSignal {
  return mapDiagnosisSignalToCreatorProfileSignal({
    signal,
    diagnosisId: "diagnosis-1",
    createdAt,
  });
}

describe("videoNarrativeCreatorProfileContract", () => {
  it("createEmptyVideoNarrativeCreatorProfile creates an empty profile", () => {
    const profile = createEmptyVideoNarrativeCreatorProfile();

    expect(profile.creatorId).toBeNull();
    expect(profile.signals).toHaveLength(0);
    expect(profile.summary.strongestContentGoals).toHaveLength(0);
  });

  it("maps content_goal to content_goals", () => {
    expect(profileSignal(diagnosisSignal("content_goal")).category).toBe("content_goals");
  });

  it("maps hook_preference to hook_preferences", () => {
    expect(profileSignal(diagnosisSignal("hook_preference")).category).toBe("hook_preferences");
  });

  it("maps format_preference to format_preferences", () => {
    expect(profileSignal(diagnosisSignal("format_preference")).category).toBe("format_preferences");
  });

  it("maps commercial_preference to commercial_preferences", () => {
    expect(profileSignal(diagnosisSignal("commercial_preference")).category).toBe("commercial_preferences");
  });

  it("maps brand_territory to brand_territories", () => {
    expect(profileSignal(diagnosisSignal("brand_territory")).category).toBe("brand_territories");
  });

  it("maps recurring_pain to recurring_pains", () => {
    expect(profileSignal(diagnosisSignal("recurring_pain")).category).toBe("recurring_pains");
  });

  it("keeps shouldPersistLater false when source signal is false", () => {
    expect(profileSignal(diagnosisSignal("content_goal", "validar pauta", {
      shouldPersistLater: false,
    })).shouldPersistLater).toBe(false);
  });

  it("creates high strength for high confidence", () => {
    expect(profileSignal(diagnosisSignal("content_goal", "validar pauta", {
      confidence: "high",
    })).strength).toBe("high");
  });

  it("creates weak status for low confidence", () => {
    expect(profileSignal(diagnosisSignal("content_goal", "validar pauta", {
      confidence: "low",
    })).status).toBe("weak");
  });

  it("starts new medium/high signal as emerging", () => {
    expect(profileSignal(diagnosisSignal("content_goal", "validar pauta", {
      confidence: "medium",
    })).status).toBe("emerging");
    expect(profileSignal(diagnosisSignal("content_goal", "validar pauta", {
      confidence: "high",
    })).status).toBe("emerging");
  });

  it("merges equal signals by category/type/value", () => {
    const merged = mergeVideoNarrativeCreatorProfileSignals({
      existingSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta"))],
      newSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta"))],
    });

    expect(merged).toHaveLength(1);
  });

  it("merge sums recurrenceCount", () => {
    const [merged] = mergeVideoNarrativeCreatorProfileSignals({
      existingSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta"))],
      newSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta"))],
    });

    expect(merged.recurrenceCount).toBe(2);
  });

  it("merge concatenates evidence without duplicating identical entries", () => {
    const signal = profileSignal(diagnosisSignal("content_goal", "validar pauta"));
    const [merged] = mergeVideoNarrativeCreatorProfileSignals({
      existingSignals: [signal],
      newSignals: [signal],
    });

    expect(merged.evidence).toHaveLength(1);
  });

  it("merge keeps highest confidence", () => {
    const [merged] = mergeVideoNarrativeCreatorProfileSignals({
      existingSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta", {
        confidence: "low",
      }))],
      newSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta", {
        confidence: "high",
      }))],
    });

    expect(merged.confidence).toBe("high");
  });

  it("merge recalculates active when recurrenceCount is at least 2", () => {
    const [merged] = mergeVideoNarrativeCreatorProfileSignals({
      existingSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta", {
        confidence: "medium",
      }))],
      newSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta", {
        confidence: "medium",
      }))],
    });

    expect(merged.status).toBe("active");
  });

  it("merge keeps oldest firstSeenAt", () => {
    const [merged] = mergeVideoNarrativeCreatorProfileSignals({
      existingSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta"), "2026-05-17T00:00:00.000Z")],
      newSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta"), "2026-05-18T00:00:00.000Z")],
    });

    expect(merged.firstSeenAt).toBe("2026-05-17T00:00:00.000Z");
  });

  it("merge uses newest lastSeenAt", () => {
    const [merged] = mergeVideoNarrativeCreatorProfileSignals({
      existingSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta"), "2026-05-17T00:00:00.000Z")],
      newSignals: [profileSignal(diagnosisSignal("content_goal", "validar pauta"), "2026-05-18T00:00:00.000Z")],
    });

    expect(merged.lastSeenAt).toBe("2026-05-18T00:00:00.000Z");
  });

  it("buildVideoNarrativeCreatorProfile creates profile from newSignals", () => {
    const profile = buildVideoNarrativeCreatorProfile({
      creatorId: "creator-1",
      newSignals: [diagnosisSignal("content_goal", "validar pauta")],
      createdAt: "2026-05-17T00:00:00.000Z",
    });

    expect(profile.creatorId).toBe("creator-1");
    expect(profile.signals).toHaveLength(1);
  });

  it("buildVideoNarrativeCreatorProfile merges with existingProfile", () => {
    const existingProfile = buildVideoNarrativeCreatorProfile({
      creatorId: "creator-1",
      newSignals: [diagnosisSignal("content_goal", "validar pauta")],
      createdAt: "2026-05-17T00:00:00.000Z",
    });
    const profile = buildVideoNarrativeCreatorProfile({
      existingProfile,
      newSignals: [diagnosisSignal("content_goal", "validar pauta")],
      createdAt: "2026-05-18T00:00:00.000Z",
    });

    expect(profile.signals).toHaveLength(1);
    expect(profile.signals[0].recurrenceCount).toBe(2);
  });

  it("summary fills strongestContentGoals", () => {
    const summary = summarizeVideoNarrativeCreatorProfile([
      profileSignal(diagnosisSignal("content_goal", "validar pauta")),
    ]);

    expect(summary.strongestContentGoals).toContain("validar pauta");
  });

  it("summary fills recurringPainPoints", () => {
    const summary = summarizeVideoNarrativeCreatorProfile([
      profileSignal(diagnosisSignal("recurring_pain", "melhorar gancho")),
    ]);

    expect(summary.recurringPainPoints).toContain("melhorar gancho");
  });

  it("summary fills preferredFormats", () => {
    const summary = summarizeVideoNarrativeCreatorProfile([
      profileSignal(diagnosisSignal("format_preference", "reels direto")),
    ]);

    expect(summary.preferredFormats).toContain("reels direto");
  });

  it("summary fills preferredHookDirections", () => {
    const summary = summarizeVideoNarrativeCreatorProfile([
      profileSignal(diagnosisSignal("hook_preference", "mais direta")),
    ]);

    expect(summary.preferredHookDirections).toContain("mais direta");
  });

  it("summary fills preferredBrandTerritories", () => {
    const summary = summarizeVideoNarrativeCreatorProfile([
      profileSignal(diagnosisSignal("brand_territory", "beleza")),
    ]);

    expect(summary.preferredBrandTerritories).toContain("beleza");
  });

  it("summary limits arrays to 5 items", () => {
    const signals = Array.from({ length: 7 }, (_, index) =>
      profileSignal(diagnosisSignal("content_goal", `objetivo ${index}`)),
    );

    expect(summarizeVideoNarrativeCreatorProfile(signals).strongestContentGoals).toHaveLength(5);
  });

  it("hasUsefulVideoNarrativeCreatorProfile returns false for empty profile", () => {
    expect(hasUsefulVideoNarrativeCreatorProfile(createEmptyVideoNarrativeCreatorProfile())).toBe(false);
  });

  it("hasUsefulVideoNarrativeCreatorProfile returns true with useful signals", () => {
    const profile = buildVideoNarrativeCreatorProfile({
      newSignals: [diagnosisSignal("content_goal", "validar pauta")],
    });

    expect(hasUsefulVideoNarrativeCreatorProfile(profile)).toBe(true);
  });

  it("sanitizeVideoNarrativeCreatorProfileText redacts AIza and env API keys", () => {
    expect(sanitizeVideoNarrativeCreatorProfileText("AIza1234567890abcdef")).toBe("[redigido]");
    expect(sanitizeVideoNarrativeCreatorProfileText("GEMINI_API_KEY=abc")).toBe("[redigido]");
    expect(sanitizeVideoNarrativeCreatorProfileText("GOOGLE_GENAI_API_KEY=abc")).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeCreatorProfileText redacts long base64", () => {
    expect(sanitizeVideoNarrativeCreatorProfileText("A".repeat(140))).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeCreatorProfileText redacts signed URL token", () => {
    expect(sanitizeVideoNarrativeCreatorProfileText("https://example.com/video.mp4?token=abc")).toBe("[redigido]");
  });

  it("keeps safe language across profile, signals, evidence and summary", () => {
    const profile = buildVideoNarrativeCreatorProfile({
      newSignals: [
        diagnosisSignal("content_goal", "viralizar garantido", {
          evidence: "resposta correta",
        }),
      ],
    });
    const content = JSON.stringify(profile).toLowerCase();

    FORBIDDEN_TERMS.forEach((term) => {
      expect(content).not.toMatch(new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i"));
    });
  });

  it("does not import forbidden runtime integrations", () => {
    const source = require("fs").readFileSync(
      "src/app/dashboard/boards/videoUpload/videoNarrativeCreatorProfileContract.ts",
      "utf8",
    ) as string;
    const forbidden = [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "componentes",
      "hooks",
      "route",
      "upload service",
      "storage provider",
      "analytics provider",
      "ffmpeg",
      "UI",
      "Stripe",
      "billing",
      "@google/genai",
    ];

    forbidden.forEach((term) => {
      expect(source).not.toContain(`from "${term}`);
      expect(source).not.toContain(`from '${term}`);
    });
  });
});
