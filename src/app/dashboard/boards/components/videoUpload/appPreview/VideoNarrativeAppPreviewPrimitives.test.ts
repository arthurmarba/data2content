import {
  clampStep,
  formatAccessLabel,
  formatSignalLabel,
  formatStageLabel,
  isSafeVideoNarrativePreviewText,
} from "./VideoNarrativeAppPreviewPrimitives";
import fs from "fs";
import path from "path";

describe("VideoNarrativeAppPreviewPrimitives", () => {
  it("clampStep limits currentStep below 1", () => {
    expect(clampStep(0, 6)).toBe(1);
  });

  it("clampStep limits currentStep above total", () => {
    expect(clampStep(9, 6)).toBe(6);
  });

  it("formatAccessLabel maps free, premium and instagram_optimized", () => {
    expect(formatAccessLabel("free")).toBe("Free");
    expect(formatAccessLabel("premium")).toBe("Premium");
    expect(formatAccessLabel("instagram_optimized")).toBe("Instagram otimizado");
  });

  it("formatStageLabel maps known stages", () => {
    expect(formatStageLabel("upload_video")).toBe("Upload simulado");
    expect(formatStageLabel("analyzing_video")).toBe("Análise do vídeo");
    expect(formatStageLabel("diagnosis_ready")).toBe("Diagnóstico pronto");
  });

  it("formatSignalLabel turns snake case into readable label", () => {
    expect(formatSignalLabel("hook_preference")).toBe("Hook preference");
  });

  it("isSafeVideoNarrativePreviewText returns false for API key, base64 and signed URL", () => {
    expect(isSafeVideoNarrativePreviewText("AIza1234567890abcdef")).toBe(false);
    expect(isSafeVideoNarrativePreviewText("a".repeat(140))).toBe(false);
    expect(isSafeVideoNarrativePreviewText("https://cdn.test/video.mp4?token=abc")).toBe(false);
  });

  it("does not import forbidden integrations in preview runtime files", () => {
    const root = path.join(__dirname, "..");
    const files = [
      path.join(root, "VideoNarrativeAppPreview.tsx"),
      path.join(__dirname, "VideoNarrativeStageShell.tsx"),
      path.join(__dirname, "VideoNarrativeProgress.tsx"),
      path.join(__dirname, "VideoNarrativeLoadingBlock.tsx"),
      path.join(__dirname, "VideoNarrativeQuizCard.tsx"),
      path.join(__dirname, "VideoNarrativeDiagnosisBlocks.tsx"),
      path.join(__dirname, "VideoNarrativePromptCards.tsx"),
      path.join(__dirname, "VideoNarrativeAppPreviewPrimitives.ts"),
    ];
    const importLines = files
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n")
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of [
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "endpoint",
      "upload service",
      "storage provider",
      "analytics",
      "ffmpeg",
      "Stripe",
      "billing",
      "GoogleGenAI",
      "Instagram client",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "PostCreationFunnelState",
    ]) {
      expect(importLines).not.toContain(forbidden);
    }
  });
});
