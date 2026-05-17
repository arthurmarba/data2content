export function isVideoNarrativeInternalEndpointEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED === "true";
}
