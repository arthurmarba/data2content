import { isVideoNarrativeInternalEndpointEnabled } from "./videoNarrativeInternalEndpointFeatureFlag";

describe("videoNarrativeInternalEndpointFeatureFlag", () => {
  it("returns false by default", () => {
    expect(isVideoNarrativeInternalEndpointEnabled({})).toBe(false);
  });

  it("returns true only when VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED is true", () => {
    expect(
      isVideoNarrativeInternalEndpointEnabled({
        VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      isVideoNarrativeInternalEndpointEnabled({
        VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED: "1",
      }),
    ).toBe(false);
    expect(
      isVideoNarrativeInternalEndpointEnabled({
        VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED: "TRUE",
      }),
    ).toBe(false);
  });

  it("does not use NEXT_PUBLIC or the Gemini provider flag", () => {
    expect(
      isVideoNarrativeInternalEndpointEnabled({
        NEXT_PUBLIC_VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED: "true",
        VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
      }),
    ).toBe(false);
  });
});
