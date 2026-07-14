import {
  VIDEO_NARRATIVE_MAX_DURATION_SECONDS,
  VIDEO_NARRATIVE_MAX_FILE_SIZE_BYTES,
  validateVideoNarrativeVerifiedMediaMetadata,
} from "./videoNarrativeMediaProbe";

describe("videoNarrativeMediaProbe limits", () => {
  const validate = (sizeBytes: number, durationSeconds: number) =>
    validateVideoNarrativeVerifiedMediaMetadata({
      sizeBytes,
      durationSeconds,
      mimeType: "video/mp4",
    });

  it("accepts exactly 300 MiB and exactly 90 seconds", () => {
    expect(validate(VIDEO_NARRATIVE_MAX_FILE_SIZE_BYTES, VIDEO_NARRATIVE_MAX_DURATION_SECONDS)).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it("rejects one byte above 300 MiB", () => {
    expect(validate(VIDEO_NARRATIVE_MAX_FILE_SIZE_BYTES + 1, 30)).toEqual(
      expect.objectContaining({ ok: false, code: "video_too_large" }),
    );
  });

  it("rejects any duration above 90 seconds", () => {
    expect(validate(1024, VIDEO_NARRATIVE_MAX_DURATION_SECONDS + 0.001)).toEqual(
      expect.objectContaining({ ok: false, code: "video_too_long" }),
    );
  });

  it("rejects missing or invalid verified metadata", () => {
    expect(validate(0, 30)).toEqual(expect.objectContaining({ ok: false, code: "invalid_media" }));
    expect(validate(1024, Number.NaN)).toEqual(expect.objectContaining({ ok: false, code: "invalid_media" }));
  });
});
