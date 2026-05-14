const VIDEO_UPLOAD_PREVIEW_ENV_FLAG = "NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED";

export function isVideoUploadPreviewEnabled(): boolean {
  return process.env[VIDEO_UPLOAD_PREVIEW_ENV_FLAG] === "1";
}
