import { isVideoNarrativeAppPreviewEnabled } from "./videoNarrativeAppPreviewFeatureFlag";

describe("videoNarrativeAppPreviewFeatureFlag", () => {
  it("returns false by default", () => {
    expect(isVideoNarrativeAppPreviewEnabled({})).toBe(false);
  });

  it("returns true only when NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED is 1", () => {
    expect(isVideoNarrativeAppPreviewEnabled({ NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED: "1" })).toBe(true);
    expect(isVideoNarrativeAppPreviewEnabled({ NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED: "true" })).toBe(false);
  });

  it("does not depend on VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED", () => {
    expect(isVideoNarrativeAppPreviewEnabled({ VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED: "true" })).toBe(false);
  });

  it("does not depend on VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE", () => {
    expect(isVideoNarrativeAppPreviewEnabled({ VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE: "mock" })).toBe(false);
  });
});
