import { isVideoUploadPreviewEnabled } from "./videoUploadPreviewFeatureFlag";

const originalEnvValue = process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED;

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED;
    return;
  }

  process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = originalEnvValue;
});

describe("videoUploadPreviewFeatureFlag", () => {
  it("enables the video upload preview when env flag is 1", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "1";

    expect(isVideoUploadPreviewEnabled()).toBe(true);
  });

  it("keeps the video upload preview disabled when env flag is absent or off", () => {
    delete process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED;
    expect(isVideoUploadPreviewEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "0";
    expect(isVideoUploadPreviewEnabled()).toBe(false);
  });
});
