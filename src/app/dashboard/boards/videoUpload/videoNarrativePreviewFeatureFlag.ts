const VIDEO_NARRATIVE_PREVIEW_ENV_FLAG = "NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED";

export function isVideoNarrativePreviewEnabled(): boolean {
  return process.env[VIDEO_NARRATIVE_PREVIEW_ENV_FLAG] === "1";
}
