export function isVideoNarrativeAppPreviewEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED === "1";
}
