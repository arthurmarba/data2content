import { isVideoNarrativePreviewEnabled } from "./videoNarrativePreviewFeatureFlag";

const originalEnvValue = process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED;

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED;
    return;
  }

  process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = originalEnvValue;
});

describe("videoNarrativePreviewFeatureFlag", () => {
  it("enables the video narrative preview when env flag is 1", () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    expect(isVideoNarrativePreviewEnabled()).toBe(true);
  });

  it("keeps the video narrative preview disabled when env flag is absent or off", () => {
    delete process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED;
    expect(isVideoNarrativePreviewEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "0";
    expect(isVideoNarrativePreviewEnabled()).toBe(false);
  });
});
